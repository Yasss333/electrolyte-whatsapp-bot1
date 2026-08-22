const path = require('path');
const fs = require('fs');
const { Client, LocalAuth,MessageMedia  } = require('whatsapp-web.js');
const { generateTasksCards, MAX_TASKS_PER_CARD } = require('./imageGenerator');
const db = require('./db');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
let qrCodeBase64 = null;
let isReady = false;
let qrGenerated = false;
let connectionState = 'initializing';
let lastError = null;
let mongoConnected = false;
let initializePromise = null;

// === Create client with LocalAuth only (local session path) ===
const sessionPath = path.join(__dirname, '../data/session');
fs.mkdirSync(sessionPath, { recursive: true });
const client = new Client({
  puppeteer: {
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--max_old_space_size=4096',
    ],
  },
  authStrategy: new LocalAuth({ dataPath: sessionPath })
});

// === Event handlers ===
client.on('qr', async (qr) => {
  if (!qrGenerated) {
    qrcode.generate(qr, { small: true });
    qrCodeBase64 = await QRCode.toDataURL(qr);
    qrGenerated = true;
    isReady = false;
    connectionState = 'qr';
    lastError = null;
    console.log('📱 QR generated and stored');
  } else {
    console.log('♻️ QR regenerated, ignoring');
  }
});

client.on('ready', () => {
  isReady = true;
  qrCodeBase64 = null;
  qrGenerated = false;
  connectionState = 'ready';
  lastError = null;
  console.log('✅ WhatsApp client ready');
});

client.on('authenticated', () => {
  connectionState = 'authenticated';
  isReady = true;
  lastError = null;
  console.log('✅ WhatsApp authenticated');
});

client.on('auth_failure', (message) => {
  connectionState = 'auth_failure';
  lastError = message || 'Authentication failed';
  isReady = false;
  console.error('❌ Authentication failed:', message);
});

client.on('disconnected', (reason) => {
  isReady = false;
  connectionState = 'disconnected';
  lastError = reason || 'Disconnected';
  console.log('🔌 WhatsApp disconnected');
});

// === sendTaskReminders (testing rn) ===
// async function sendTaskReminders(tasks, phone) {
//   const technicianName = tasks[0].technician_name;
//   const chatId = `91${phone}@c.us`;

//   const taskList = tasks.map(t =>
//     `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
//   ).join('\n');

//   const caption = `Hi ${technicianName}, you have ${tasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. — Electrolyte Solutions`;

//   try {
//     await Promise.race([
//       client.sendMessage(chatId, caption),
//       new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), 60000))
//     ]);
//     console.log(`✅ Sent ${tasks.length} tasks to ${technicianName} (${phone})`);
//     await new Promise(res => setTimeout(res, 4000));
//   } catch (err) {
//     console.error(`❌ Failed to send to ${technicianName}:`, err.message);
//     throw err;
//   }
// }

//OG Mesage
// === sendTaskReminders with auto-reconnect ===
async function sendTaskReminders(tasks, phone) {
  const maxRetries = 1;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Check if client is ready
      if (!isReady) {
        console.log('⏳ Client not ready, waiting...');
        await waitForReady(30000);
      }

      const unsentTasks = tasks;
      if (!unsentTasks.length) return 0;
      const technicianName = unsentTasks[0].technician_name;
      const chatId = `91${phone}@c.us`;

      const taskList = unsentTasks.map(t =>
        `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
      ).join('\n');
      const caption = `Hi ${technicianName}, you have ${unsentTasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. - Electrolyte Solutions`;
      const imagePaths = generateTasksCards(unsentTasks, technicianName);
      const insertMessage = db.prepare('INSERT INTO messages (technician_name, phone, case_number, sent_at, status) VALUES (?, ?, ?, ?, ?)');
      const markSent = db.transaction((sentTasks) => sentTasks.forEach((task) => {
        if (!db.prepare('SELECT 1 FROM messages WHERE case_number = ? AND status = ? LIMIT 1').get(task.case_number, 'sent')) {
          insertMessage.run(technicianName, phone, task.case_number, new Date().toISOString(), 'sent');
        }
      }));

      for (const [index, imagePath] of imagePaths.entries()) {
        await Promise.race([
          client.sendMessage(chatId, MessageMedia.fromFilePath(imagePath), { caption }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), 60000))
        ]);
        markSent(unsentTasks.slice(index * MAX_TASKS_PER_CARD, (index + 1) * MAX_TASKS_PER_CARD));
      }

      console.log(`Sent ${unsentTasks.length} tasks to ${technicianName} (${phone})`);
      await new Promise(res => setTimeout(res, 4000));
      return unsentTasks.length;

    } catch (err) {
      console.error(`❌ Attempt ${attempt+1} failed for ${tasks[0]?.technician_name}:`, err.message);

      // If it's a connection error, try to reconnect
      if (err.message.includes('getChat') || err.message.includes('Execution context') || err.message.includes('destroyed')) {
        console.log('🔄 Connection lost – reinitializing client...');
        try {
          // Destroy current client and reinitialize
          await client.destroy();
          await client.initialize();
          // Wait for ready
          await waitForReady(30000);
          attempt++;
          continue; // retry
        } catch (reconnectErr) {
          console.error('❌ Reconnect failed:', reconnectErr.message);
          throw reconnectErr;
        }
      } else {
        throw err; // non-connection error – propagate
      }
    }
  }
  throw new Error(`Failed after ${maxRetries+1} attempts`);
}

// === Helper: Wait for client to be ready ===
async function waitForReady(timeout = 30000) {
  if (isReady) return true;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Client readiness timeout')), timeout);
    const check = setInterval(() => {
      if (isReady) {
        clearInterval(check);
        clearTimeout(timer);
        resolve(true);
      }
    }, 500);
  });
}
// === Exports ===
function getQRCode() { return qrCodeBase64; }
function getStatus() { return isReady; }
function getConnectionState() { return connectionState; }
function getLastError() { return lastError; }
function resetSession() {
  qrCodeBase64 = null;
  isReady = false;
  qrGenerated = false;
  connectionState = 'initializing';
  lastError = null;
  console.log('🔁 Session reset');
}

async function initializeClient() {
  if (isReady) return;
  if (initializePromise) return initializePromise;

  connectionState = 'initializing';
  let retriedStaleLock = false;
  initializePromise = client.initialize()
    .catch(async (err) => {
      if (!retriedStaleLock && err.message.includes('browser is already running')) {
        retriedStaleLock = true;
        const browserProfilePath = path.join(sessionPath, 'session');
        for (const lockFile of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
          fs.rmSync(path.join(browserProfilePath, lockFile), { force: true });
        }
        console.warn('Removed stale WhatsApp browser locks; retrying initialization once.');
        return client.initialize();
      }
      throw err;
    })
    .catch((err) => {
      isReady = false;
      connectionState = 'error';
      lastError = err.message;
      throw err;
    })
    .finally(() => {
      initializePromise = null;
    });
  return initializePromise;
}

async function logoutClient() {
  initializePromise = null;
  isReady = false;
  connectionState = 'logging_out';
  try {
    if (client.info && client.logout) await client.logout();
  } catch (err) {
    console.warn('WhatsApp remote logout failed; clearing local session:', err.message);
  }
  try {
    await client.destroy();
  } catch (err) {
    console.warn('WhatsApp client destroy failed:', err.message);
  }
  fs.rmSync(sessionPath, { recursive: true, force: true });
  fs.mkdirSync(sessionPath, { recursive: true });
  resetSession();
  return initializeClient();
}

async function resetClientSession() {
  await logoutClient();
}

module.exports = {
  client,
  sendTaskReminders,
  getQRCode,
  getStatus,
  getConnectionState,
  getLastError,
  resetSession,
  initializeClient,
  logoutClient,
  resetClientSession,
};