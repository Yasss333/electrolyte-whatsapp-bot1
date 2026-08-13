const path = require('path');
const fs = require('fs');
const { Client, RemoteAuth, LocalAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

let qrCodeBase64 = null;
let isReady = false;
let qrGenerated = false;
let connectionState = 'initializing';
let lastError = null;
let mongoConnected = false;

// === MongoDB Connection ===
async function connectMongo() {
  if (mongoConnected) return;
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI not set, falling back to LocalAuth');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    mongoConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
}

// === Create Client (without auth strategy yet) ===
const client = new Client({
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
});

// === Override initialize to set auth strategy dynamically ===
const originalInit = client.initialize.bind(client);
client.initialize = async function() {
  // Determine auth strategy now
  let authStrategy;
  if (process.env.MONGODB_URI) {
    await connectMongo();
    const store = new MongoStore({ mongoose });
    authStrategy = new RemoteAuth({
      store,
      clientId: 'electrolyte-bot',
      backupSyncIntervalMs: 60000, // required
    });
    console.log('✅ Using RemoteAuth (MongoDB)');
  } else {
    const sessionPath = process.env.SESSION_DATA_PATH || path.join(__dirname, '../data/session');
    fs.mkdirSync(sessionPath, { recursive: true });
    authStrategy = new LocalAuth({ dataPath: sessionPath });
    console.log(`⚠️ Using LocalAuth at ${sessionPath}`);
  }

  // Set the auth strategy on the client
  this.options.authStrategy = authStrategy;

  // Now call the original initialize
  await originalInit();
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

// === sendTaskReminders (text-only) ===
async function sendTaskReminders(tasks, phone) {
  const technicianName = tasks[0].technician_name;
  const chatId = `91${phone}@c.us`;

  const taskList = tasks.map(t =>
    `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
  ).join('\n');

  const caption = `Hi ${technicianName}, you have ${tasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. — Electrolyte Solutions`;

  try {
    await Promise.race([
      client.sendMessage(chatId, caption),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), 60000))
    ]);
    console.log(`✅ Sent ${tasks.length} tasks to ${technicianName} (${phone})`);
    await new Promise(res => setTimeout(res, 4000));
  } catch (err) {
    console.error(`❌ Failed to send to ${technicianName}:`, err.message);
    throw err;
  }
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

module.exports = {
  client,
  sendTaskReminders,
  getQRCode,
  getStatus,
  getConnectionState,
  getLastError,
  resetSession,
};