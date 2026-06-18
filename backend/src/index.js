require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { client, sendTaskReminder, getQRCode, getStatus } = require('./whatsapp');
const { parseAndUpsertCSV } = require('./csvParser');
const { startScheduler } = require('./scheduler');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: path.join(__dirname, '../data/tmp/') });

client.initialize();
startScheduler();

// Ensure data directories exist
fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '../data/tmp'), { recursive: true });

// QR Code endpoint
app.get('/api/qr', (req, res) => {
  res.json({
    qr: getQRCode(),
    connected: getStatus(),
  });
});

// Upload task CSV – with EPERM fix
app.post('/api/upload', upload.single('csv'), async (req, res) => {
  const dest = path.join(__dirname, '../data/input.csv');
  try {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('File handling error:', err.message);
    return res.status(500).json({ error: 'Failed to save uploaded file' });
  }

  try {
    const tasks = await parseAndUpsertCSV(dest);
    res.json({ success: true, pendingCount: tasks.length });
  } catch (err) {
    console.error('CSV parsing error:', err.message);
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
});

// Upload phones CSV
app.post('/api/upload-phones', upload.single('csv'), (req, res) => {
  const lines = fs.readFileSync(req.file.path, 'utf8').split('\n');
  let count = 0;
  lines.forEach((line, i) => {
    if (i === 0) return;
    const [name, phone] = line.split(',').map(s => s?.trim());
    if (name && phone) {
      db.prepare(`
        INSERT INTO technicians (name, phone) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET phone=excluded.phone
      `).run(name, phone);
      count++;
    }
  });
  fs.unlinkSync(req.file.path);
  res.json({ success: true, imported: count });
});

// Get pending tasks – only 'New' status
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE resolved_at IS NULL AND line_item_status = 'New'
    ORDER BY days_pending DESC
  `).all();
  res.json(tasks);
});

// Delete all unresolved tasks
app.delete('/api/tasks', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE resolved_at IS NULL').run();
  res.json({ success: true, deleted: info.changes });
});

// Debug endpoint to inspect statuses
app.get('/api/debug/statuses', (req, res) => {
  const rows = db.prepare(`
    SELECT line_item_status, COUNT(*) as count
    FROM tasks
    GROUP BY line_item_status
  `).all();
  res.json(rows);
});

// Bulk send – only for 'New' tasks
app.post('/api/send', async (req, res) => {
  const pendingTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE resolved_at IS NULL AND line_item_status = 'New'
  `).all();
  const technicians = db.prepare('SELECT * FROM technicians').all();

  let sent = 0;
  const skipped = [];

  for (const task of pendingTasks) {
    const tech = technicians.find(
      (t) => t.name.toLowerCase() === task.technician_name.toLowerCase()
    );
    if (!tech) {
      skipped.push({
        caseNumber: task.case_number,
        reason: `Technician "${task.technician_name}" not found in phone directory`
      });
      continue;
    }
    if (!tech.phone) {
      skipped.push({
        caseNumber: task.case_number,
        reason: `Technician "${task.technician_name}" has no phone number`
      });
      continue;
    }
    try {
      await sendTaskReminder({
        caseNumber: task.case_number,
        technicianName: task.technician_name,
        customerName: task.customer_name,
        city: task.city,
        complaint: task.complaint,
        productName: task.product_name,
        technicianAssignedDate: task.technician_assigned_date,
        lineItemStatus: task.line_item_status,
        daysPending: task.days_pending,
      }, tech.phone);
      sent++;
    } catch (err) {
      skipped.push({
        caseNumber: task.case_number,
        reason: `Send failed: ${err.message}`
      });
    }
  }

  res.json({
    success: true,
    sent,
    skipped: skipped.length,
    details: skipped.slice(0, 10)
  });
});

// Technician CRUD
app.post('/api/technicians', (req, res) => {
  const { name, phone } = req.body;
  db.prepare(`
    INSERT INTO technicians (name, phone) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET phone=excluded.phone
  `).run(name, phone);
  res.json({ success: true });
});

app.get('/api/technicians', (req, res) => {
  res.json(db.prepare('SELECT * FROM technicians').all());
});

// Dashboard stats – all queries fixed with single quotes
app.get('/api/stats', (req, res) => {
  const totalSent = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const totalPending = db.prepare(
    'SELECT COUNT(*) as count FROM tasks WHERE resolved_at IS NULL AND line_item_status = \'New\''
  ).get().count;
  const totalResolved = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE resolved_at IS NOT NULL').get().count;
  const resolvedToday = db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE date(resolved_at) = date(?)`
  ).get(new Date().toISOString()).count;
  const replies = db.prepare('SELECT * FROM replies ORDER BY received_at DESC LIMIT 50').all();
  const recentMessages = db.prepare('SELECT * FROM messages ORDER BY sent_at DESC LIMIT 50').all();
  const escalations = db.prepare('SELECT * FROM escalations ORDER BY escalated_at DESC LIMIT 20').all();

  // Per technician breakdown – only New tasks count as pending
  const techStats = db.prepare(`
    SELECT technician_name,
      COUNT(*) as total,
      SUM(CASE WHEN resolved_at IS NULL AND line_item_status = 'New' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
      AVG(days_pending) as avg_days_pending
    FROM tasks
    GROUP BY technician_name
    ORDER BY pending DESC
  `).all();

  const dailyVolume = db.prepare(`
    SELECT date(sent_at) as day, COUNT(*) as count
    FROM messages
    WHERE sent_at >= date('now', '-7 days')
    GROUP BY date(sent_at)
    ORDER BY day ASC
  `).all();

  const replyClassification = db.prepare(`
    SELECT classification, COUNT(*) as count FROM replies GROUP BY classification
  `).all();

  res.json({
    totalSent, totalPending, totalResolved, resolvedToday,
    replies, recentMessages, escalations,
    techStats, dailyVolume, replyClassification,
  });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Backend running on port ${process.env.PORT || 5000}`);
});