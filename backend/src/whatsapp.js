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
console.log('🧹 CLEAN LOCK FILES FUNCTION EXECUTED AT ' + new Date().toISOString());
const sessionBasePath = process.env.SESSION_DATA_PATH || path.join(__dirname, '../data/session');
const sessionPath = path.resolve(sessionBasePath);
cleanLockFiles(sessionBasePath);

// Ensure the session directory exists
fs.mkdirSync(sessionPath, { recursive: true });

// const sessionPath = path.join(__dirname, '../data/session');
// fs.mkdirSync(sessionPath, { recursive: true });

//cleanup function for railways deployment or any container based deployment  , this is wriitenn to lockout the session f
// from previos session also a prestart commans is added 
// Clean up Chromium lock files before starting
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

console.log(`WhatsApp session path: ${sessionPath}`);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: sessionPath }),
  puppeteer: {
     executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    protocolTimeout: 300000,
    // 5 minutes adjust this as need beaucse this is 
    //done beacuse for bundelling  the parser so that pupter does not timeout during the parsing 
    args: ['--no-sandbox', '--disable-setuid-sandbox',  "--disable-dev-shm-usage",
      "--disable-gpu"],
  },
});

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
  qrCodeBase64 = null;   // clear QR after successful connection
  qrGenerated = false;   // allow new QR if disconnected later
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

// Technician responses are intentionally ignored per request — do not store or process replies.
// client.on('message', (msg) => {
//   // ignore status and broadcast messages
//   if (msg.from === 'status@broadcast') return;
//   if (msg.isStatus) return;
//   // deliberately do nothing with inbound messages from technicians
// });
async function sendTaskReminders(tasks, phone) {
  try {
    const technicianName = tasks[0].technician_name;
    const imagePath = generateTasksCard(tasks, technicianName);
    const media = MessageMedia.fromFilePath(imagePath);
    const chatId = `91${phone}@c.us`;

   // Inside sendTaskReminders, replace the caption part:
const taskList = tasks.map(t => 
  `Case #${t.case_number || 'N/A'} (${t.city || 'Unknown'}) - ${t.days_pending || 0} days`
).join('\n');

const caption = `Hi ${technicianName}, you have ${tasks.length} pending task(s):\n${taskList}\n\nPlease update your status today. — Electrolyte Solutions`;

    await client.sendMessage(chatId, media, { caption });

    // Log each sent message
    // for (const task of tasks) {
    //   const caseNum = task.case_number || task.caseNumber || null;
    //   db.prepare(
    //     `INSERT INTO messages (technician_name, phone, case_number, sent_at, status) VALUES (?, ?, ?, ?, ?)`
    //   ).run(technicianName, phone, caseNum, new Date().toISOString(), 'sent');
    //   db.prepare(`UPDATE tasks SET last_reminded_at = ? WHERE case_number = ?`)
    //     .run(new Date().toISOString(), caseNum);
    // }
    console.log(`Sent ${tasks.length} tasks to ${technicianName} (${phone})`);
    await new Promise((res) => setTimeout(res, 4000));
  } catch (err) {
    console.error(`Failed to send to ${tasks[0]?.technician_name || 'unknown'}:`, err.message);
    // Rethrow so callers (index.js) can record the failure
    throw err;
  }
}

// async function sendEscalation(task, supervisorPhone) {
//   try {
//     const chatId = `91${supervisorPhone}@c.us`;
//     await client.sendMessage(chatId,
//       `⚠️ *ESCALATION ALERT*\n\nCase #${task.caseNumber} assigned to *${task.technicianName}* has been pending for *${task.daysPending} days*.\n\nCustomer: ${task.customerName}\nLocation: ${task.city}\nIssue: ${task.complaint}\n\nImmediate attention required. — Electrolyte Solutions`
//     );

//     db.prepare(
//       `INSERT INTO escalations (case_number, technician_name, escalated_at, days_pending) VALUES (?, ?, ?, ?)`
//     ).run(task.caseNumber, task.technicianName, new Date().toISOString(), task.daysPending);

//     console.log(`Escalation sent for case ${task.caseNumber}`);
//   } catch (err) {
//     console.error(`Escalation failed for ${task.caseNumber}:`, err.message);
//   }
// }

function getQRCode() { return qrCodeBase64; }
function getStatus() { return isReady; }
function getConnectionState() { return connectionState; }
function getLastError() { return lastError; }

module.exports = { client, sendTaskReminders, getQRCode, getStatus, getConnectionState, getLastError };