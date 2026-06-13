require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { client, sendTaskReminder } = require('./whatsapp');
const { parseCSV } = require('./csvParser');
const { startScheduler } = require('./scheduler');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: path.join(__dirname, '../data/') });

// Start WhatsApp client
client.initialize();
startScheduler();

// Upload CSV
app.post('/api/upload', upload.single('csv'), (req, res) => {
  const dest = path.join(__dirname, '../data/input.csv');
  fs.renameSync(req.file.path, dest);
  res.json({ success: true, message: 'CSV uploaded' });
});

// Get pending tasks from CSV
app.get('/api/tasks', async (req, res) => {
  const csvPath = path.join(__dirname, '../data/input.csv');
  if (!fs.existsSync(csvPath)) return res.json([]);
  const tasks = await parseCSV(csvPath);
  res.json(tasks);
});

// Bulk send
app.post('/api/send', async (req, res) => {
  const csvPath = path.join(__dirname, '../data/input.csv');
  if (!fs.existsSync(csvPath)) return res.status(400).json({ error: 'No CSV uploaded' });

  const pendingTasks = await parseCSV(csvPath);
  const technicians = db.prepare('SELECT * FROM technicians').all();

  let sent = 0;
  for (const task of pendingTasks) {
    const tech = technicians.find(
      (t) => t.name.toLowerCase() === task.technicianName.toLowerCase()
    );
    if (tech) {
      await sendTaskReminder(task, tech.phone);
      sent++;
    }
  }

  res.json({ success: true, sent });
});

// Add/update technician phone
app.post('/api/technicians', (req, res) => {
  const { name, phone } = req.body;
  db.prepare(
    `INSERT INTO technicians (name, phone) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET phone=excluded.phone`
  ).run(name, phone);
  res.json({ success: true });
});

// Get all technicians
app.get('/api/technicians', (req, res) => {
  const technicians = db.prepare('SELECT * FROM technicians').all();
  res.json(technicians);
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const totalSent = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const replies = db.prepare('SELECT * FROM replies ORDER BY received_at DESC').all();
  const recentMessages = db.prepare('SELECT * FROM messages ORDER BY sent_at DESC LIMIT 50').all();
  res.json({ totalSent, replies, recentMessages });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Backend running on port ${process.env.PORT || 5000}`);
});