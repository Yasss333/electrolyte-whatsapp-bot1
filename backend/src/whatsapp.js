const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { generateTasksCard } = require('./imageGenerator');
const db = require('./db');

let qrCodeBase64 = null;
let isReady = false;
let qrGenerated = false;
let connectionState = 'initializing';
let lastError = null;

// === Path and lock cleanup ===
function cleanLockFiles(sessionPath) {
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

const sessionBasePath = process.env.SESSION_DATA_PATH || path.join(__dirname, '../data/session');
const sessionPath = path.resolve(sessionBasePath);
fs.mkdirSync(sessionPath, { recursive: true });

// Clean locks once at startup
cleanLockFiles(sessionPath);
console.log(`🧹 CLEAN LOCK FILES EXECUTED AT ${new Date().toISOString()}`);
console.log(`WhatsApp session path: ${sessionPath}`);

// === Client with retry override ===
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: sessionPath }), // ❌ no clientId – avoids extra subfolder
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    protocolTimeout: 300000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

// 🔁 Override initialize to clean locks right before launch and retry once if needed
const originalInit = client.initialize.bind(client);
client.initialize = async function() {
  // Clean locks just before launch (catches any new lock files)
  cleanLockFiles(sessionPath);

  try {
    await originalInit();
  } catch (err) {
    if (err.message && err.message.includes('profile appears to be in use')) {
      console.log('🔁 Lock error – cleaning locks and retrying...');
      cleanLockFiles(sessionPath);
      // Retry once
      await originalInit();
    } else {
      throw err;
    }
  }
};

// === Event handlers (unchanged) ===
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

client.on('authenticated', () => {
  connectionState = 'authenticated';
  lastError = null;
});

client.on('auth_failure', (message) => {
  connectionState = 'auth_failure';
  lastError = message || 'Authentication failed';
  console.error('WhatsApp authentication failed:', message);
});

client.on('disconnected', (reason) => {
  isReady = false;
  connectionState = 'disconnected';
  lastError = reason || 'Disconnected';
  console.log('WhatsApp disconnected');
});

// === sendTaskReminders (unchanged) ===
async function sendTaskReminders(tasks, phone) {
  try {
    const technicianName = tasks[0].technician_name;
    const imagePath = generateTasksCard(tasks, technicianName);
    const media = MessageMedia.fromFilePath(imagePath);
    const chatId = `91${phone}@c.us`;

    const taskList = tasks.map(t =>
      `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
    ).join('\n');

    const caption = `Hi ${technicianName}, you have ${tasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. — Electrolyte Solutions`;

    await client.sendMessage(chatId, media, { caption });
    console.log(`Sent ${tasks.length} tasks to ${technicianName} (${phone})`);
    await new Promise((res) => setTimeout(res, 4000));
  } catch (err) {
    console.error(`Failed to send to ${tasks[0]?.technician_name || 'unknown'}:`, err.message);
    throw err;
  }
}

// === Exports ===
function getQRCode() { return qrCodeBase64; }
function getStatus() { return isReady; }
function getConnectionState() { return connectionState; }
function getLastError() { return lastError; }

module.exports = { client, sendTaskReminders, getQRCode, getStatus, getConnectionState, getLastError };