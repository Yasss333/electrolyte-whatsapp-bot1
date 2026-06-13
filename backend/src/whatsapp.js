const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { generateTaskCard } = require('./imageGenerator');
const db = require('./db');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', (qr) => {
  console.log('Scan this QR code in WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp client ready');
});

client.on('message', (msg) => {
  const from = msg.from.replace('@c.us', '');
  const body = msg.body;
  db.prepare(
    `INSERT INTO replies (phone, reply_text, received_at) VALUES (?, ?, ?)`
  ).run(from, body, new Date().toISOString());
  console.log(`Reply from ${from}: ${body}`);
});

async function sendTaskReminder(task, phone) {
  try {
    const imagePath = generateTaskCard(task);
    const media = MessageMedia.fromFilePath(imagePath);
    const chatId = `91${phone}@c.us`;

    await client.sendMessage(chatId, media, {
      caption: `Hi ${task.technicianName}, you have a pending task (Case #${task.caseNumber}) at ${task.city}. Please update your status today.`,
    });

    db.prepare(
      `INSERT INTO messages (technician_name, phone, case_number, sent_at, status) VALUES (?, ?, ?, ?, ?)`
    ).run(task.technicianName, phone, task.caseNumber, new Date().toISOString(), 'sent');

    console.log(`Sent to ${task.technicianName} (${phone})`);

    // Delay between messages
    await new Promise((res) => setTimeout(res, 4000));
  } catch (err) {
    console.error(`Failed to send to ${task.technicianName}:`, err.message);
  }
}

module.exports = { client, sendTaskReminder };