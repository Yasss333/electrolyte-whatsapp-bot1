const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { generateTasksCard } = require('./imageGenerator');

let qrCodeBase64 = null;
let isReady = false;
let qrGenerated = false;
let connectionState = 'initializing';
let lastError = null;

// === Path: exactly the session folder ===
const sessionBasePath = process.env.SESSION_DATA_PATH || path.join(__dirname, '../data/session');
const sessionPath = path.resolve(sessionBasePath);
fs.mkdirSync(sessionPath, { recursive: true });

console.log(`🧹 CLEAN LOCK FILES EXECUTED AT ${new Date().toISOString()}`);
console.log(`WhatsApp session path: ${sessionPath}`);

// === Clean lock files ===
function cleanLockFiles() {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const file of lockFiles) {
        const filePath = path.join(sessionPath, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🧹 Removed stale lock file: ${file}`);
            } catch (err) {
                console.log(`⚠️ Could not remove ${file}:`, err.message);
            }
        }
    }
}
cleanLockFiles();

// === Delete entire session (for reset) ===
function deleteSessionFolder() {
    try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted entire session folder: ${sessionPath}`);
    } catch (err) {
        console.error(`❌ Failed to delete session folder: ${err.message}`);
    }
}

// === Client – NO `clientId`, uses `sessionPath` directly ===
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: sessionPath }),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    protocolTimeout: 600000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
        '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--max_old_space_size=4096', // allocate 4GB memory to Chrome
    ],
  },
});

// === Retry with auto‑delete if lock error persists ===
const originalInit = client.initialize.bind(client);
client.initialize = async function() {
  cleanLockFiles();
  try {
    await originalInit();
  } catch (err) {
    if (err.message && err.message.includes('profile appears to be in use')) {
      console.log('🔁 Lock error – deleting session and retrying...');
      deleteSessionFolder();
      fs.mkdirSync(sessionPath, { recursive: true });
      cleanLockFiles();
      await originalInit(); // retry once
    } else {
      throw err;
    }
  }
};

// === Event handlers ===
client.on('qr', async (qr) => {
  if (!qrGenerated) {
    qrcode.generate(qr, { small: true });
    qrCodeBase64 = await QRCode.toDataURL(qr);
    qrGenerated = true;
    isReady = false;
    connectionState = 'qr';
    lastError = null;
    console.log('QR generated and stored');
  } else {
    console.log('QR regenerated, ignoring');
  }
});

client.on('ready', () => {
  isReady = true;
  qrCodeBase64 = null;
  qrGenerated = false;
  connectionState = 'ready';
  lastError = null;
  console.log('WhatsApp client ready');
});

// ═══════════════════════════════════════════════════════════
// 🔥 THE FIX: Set isReady = true on authenticated event
// ═══════════════════════════════════════════════════════════
client.on('authenticated', () => {
  connectionState = 'authenticated';
  isReady = true;   // <-- THIS IS THE KEY FIX
  lastError = null;
  console.log('WhatsApp client authenticated (ready state set)');
});

client.on('auth_failure', (message) => {
  connectionState = 'auth_failure';
  lastError = message || 'Authentication failed';
  isReady = false;
  console.error('WhatsApp authentication failed:', message);
});

client.on('disconnected', (reason) => {
  isReady = false;
  connectionState = 'disconnected';
  lastError = reason || 'Disconnected';
  console.log('WhatsApp disconnected');
});

// === Helper: Wait for client to be ready (now always returns true quickly) ===
async function waitForReady(timeout = 30000) {
  // isReady is now set on authenticated, so this will return immediately
  if (isReady) return true;
  // fallback: wait up to 5 seconds for authentication
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Client not ready within timeout')), timeout);
    const check = setInterval(() => {
      if (isReady) {
        clearInterval(check);
        clearTimeout(timer);
        resolve(true);
      }
    }, 500);
  });
}

// === sendTaskReminders with readiness check ===
async function sendTaskReminders(tasks, phone) {
  try {
    await waitForReady(30000);
    const technicianName = tasks[0].technician_name;
    // const imagePath = generateTasksCard(tasks, technicianName);
    // const media = MessageMedia.fromFilePath(imagePath);
    const chatId = `91${phone}@c.us`;

    const taskList = tasks.map(t =>
      `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
    ).join('\n');

    const caption = `Hi ${technicianName}, you have ${tasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. — Electrolyte Solutions`;

    await Promise.race([
      // client.sendMessage(chatId, media, { caption }),
      client.sendMessage(chatId,  { caption }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), 60000))
    ]);

    console.log(`✅ Sent ${tasks.length} tasks to ${technicianName} (${phone})`);
    await new Promise((res) => setTimeout(res, 4000));
  } catch (err) {
    console.error(`❌ Failed to send to ${tasks[0]?.technician_name || 'unknown'}:`, err.message);
    throw err;
  }
}

// === Exports ===
function getQRCode() { return qrCodeBase64; }
function getStatus() { return isReady; }
function getConnectionState() { return connectionState; }
function getLastError() { return lastError; }
function resetSession() {
  deleteSessionFolder();
  fs.mkdirSync(sessionPath, { recursive: true });
  qrCodeBase64 = null;
  isReady = false;
  qrGenerated = false;
  connectionState = 'initializing';
  lastError = null;
  console.log('🔁 Session reset. Please scan QR again.');
}

module.exports = { client, sendTaskReminders, getQRCode, getStatus, getConnectionState, getLastError, resetSession };