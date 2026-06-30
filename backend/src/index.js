require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { client, sendTaskReminders, getQRCode, getStatus } = require('./whatsapp');
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

// Upload task CSV – clear existing tasks first
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
    // Clear all existing tasks (only keep the new data)
    db.prepare('DELETE FROM tasks').run();
    const tasks = await parseAndUpsertCSV(dest);
    res.json({ success: true, pendingCount: tasks.length });
  } catch (err) {
    console.error('CSV parsing error:', err.message);
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
});


// Export pending tasks as Excel
// app.get('/api/export-tasks', async (req, res) => {
//   try {
//     // Fetch all pending tasks with status 'New'
//     const tasks = db.prepare(`
//       SELECT 
//         case_number,
//         technician_name,
//         customer_name,
//         city,
//         street,
//         zip,
//         complaint,
//         product_name,
//         line_item_status
//       FROM tasks 
//       WHERE resolved_at IS NULL AND line_item_status = 'New'
//       ORDER BY case_number ASC
//     `).all();

//     // Create workbook and worksheet
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Pending Tasks');

//     // Define columns (matching the requested fields)
//     worksheet.columns = [
//       { header: 'Case #', key: 'case_number', width: 15 },
//       { header: 'Technician', key: 'technician_name', width: 25 },
//       { header: 'Customer', key: 'customer_name', width: 25 },
//       { header: 'City', key: 'city', width: 20 },
//       { header: 'Street', key: 'street', width: 30 },
//       { header: 'Zip', key: 'zip', width: 15 },
//       { header: 'Complaint', key: 'complaint', width: 30 },
//       { header: 'Product', key: 'product_name', width: 25 },
//       { header: 'Status', key: 'line_item_status', width: 15 },
//     ];

//     // Add rows
//     tasks.forEach(task => {
//       worksheet.addRow({
//         case_number: task.case_number || '',
//         technician_name: task.technician_name || '',
//         customer_name: task.customer_name || '',
//         city: task.city || '',
//         street: task.street || '',
//         zip: task.zip || '',
//         complaint: task.complaint || '',
//         product_name: task.product_name || '',
//         line_item_status: task.line_item_status || '',
//       });
//     });

//     // Style header row (optional)
//     worksheet.getRow(1).font = { bold: true };
//     worksheet.getRow(1).fill = {
//       type: 'pattern',
//       pattern: 'solid',
//       fgColor: { argb: 'FFf97316' },
//     };
//     worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };

//     // Generate file name with current date
//     const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
//     const fileName = `pending_tasks_${today}.xlsx`;

//     // Set response headers for download
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     // Write to response
//     await workbook.xlsx.write(res);
//     res.end();
//   } catch (err) {
//     console.error('Export error:', err.message);
//     res.status(500).json({ error: 'Failed to generate export' });
//   }
// });
// const ExcelJS = require('exceljs');

// Export pending tasks as Excel with two sheets
app.get('/api/export-tasks', async (req, res) => {
  try {
    // Fetch all pending tasks with status 'New'
    const tasks = db.prepare(`
      SELECT 
        case_number,
        technician_name,
        customer_name,
        city,
        street,
        zip,
        complaint,
        product_name,
        line_item_status
      FROM tasks 
      WHERE resolved_at IS NULL AND line_item_status = 'New'
      ORDER BY technician_name, case_number ASC
    `).all();

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // ---------- Sheet 1: Tasks List ----------
    const listSheet = workbook.addWorksheet('Tasks List');
    listSheet.columns = [
      { header: 'Case #', key: 'case_number', width: 15 },
      { header: 'Technician', key: 'technician_name', width: 25 },
      { header: 'Customer', key: 'customer_name', width: 25 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'Street', key: 'street', width: 30 },
      { header: 'Zip', key: 'zip', width: 15 },
      { header: 'Complaint', key: 'complaint', width: 30 },
      { header: 'Product', key: 'product_name', width: 25 },
      { header: 'Status', key: 'line_item_status', width: 15 },
    ];

    tasks.forEach(task => {
      listSheet.addRow({
        case_number: task.case_number || '',
        technician_name: task.technician_name || '',
        customer_name: task.customer_name || '',
        city: task.city || '',
        street: task.street || '',
        zip: task.zip || '',
        complaint: task.complaint || '',
        product_name: task.product_name || '',
        line_item_status: task.line_item_status || '',
      });
    });

    // Style header
    const listHeader = listSheet.getRow(1);
    listHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    listHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf97316' } };

    // ---------- Sheet 2: Summary (Pivot) ----------
    const summarySheet = workbook.addWorksheet('Summary');

    // Get distinct statuses (LineItem Status) from tasks
    const statuses = db.prepare(`
      SELECT DISTINCT line_item_status FROM tasks 
      WHERE resolved_at IS NULL AND line_item_status IS NOT NULL AND line_item_status != ''
      ORDER BY line_item_status
    `).all().map(r => r.line_item_status);

    // Get technicians with counts per status
    const techRows = db.prepare(`
      SELECT 
        technician_name,
        line_item_status,
        COUNT(*) as cnt
      FROM tasks
      WHERE resolved_at IS NULL AND line_item_status = 'New'
      GROUP BY technician_name, line_item_status
      ORDER BY technician_name
    `).all();

    // Build pivot: technician_name -> status -> count
    const pivot = {};
    const allTechs = [];
    for (const row of techRows) {
      const tech = row.technician_name;
      if (!pivot[tech]) {
        pivot[tech] = {};
        allTechs.push(tech);
      }
      pivot[tech][row.line_item_status] = row.cnt;
    }

    // Add a row for totals per status
    const statusTotals = {};
    // Also add a Grand Total column
    let grandTotal = 0;

    // Build the table header: Row Labels | status1 | status2 | ... | Grand Total
    const headerRow = ['Technician', ...statuses, 'Total'];
    summarySheet.addRow(headerRow);

    // Add data rows
    for (const tech of allTechs) {
      const rowData = [tech];
      let techTotal = 0;
      for (const status of statuses) {
        const cnt = pivot[tech]?.[status] || 0;
        rowData.push(cnt);
        techTotal += cnt;
        statusTotals[status] = (statusTotals[status] || 0) + cnt;
      }
      rowData.push(techTotal);
      grandTotal += techTotal;
      summarySheet.addRow(rowData);
    }

    // Add Grand Total row
    const totalRow = ['Grand Total'];
    for (const status of statuses) {
      totalRow.push(statusTotals[status] || 0);
    }
    totalRow.push(grandTotal);
    summarySheet.addRow(totalRow);

    // Style the summary sheet
    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf97316' } };

    // Make the Grand Total row bold
    const lastRowNum = summarySheet.rowCount;
    const grandTotalRow = summarySheet.getRow(lastRowNum);
    grandTotalRow.font = { bold: true };
    grandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe2e8f0' } };

    // Auto-width for summary columns
    summarySheet.columns.forEach(col => {
      col.width = Math.max(15, col.header?.length || 10);
    });

    // ---------- Generate file ----------
    const today = new Date().toISOString().split('T')[0];
    const fileName = `pending_tasks_${today}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});
// Upload phones CSV (bulk technician import)
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

// Delete all unresolved tasks (clear)
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

// ----- Technician CRUD with Edit & Delete -----
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

app.put('/api/technicians/:id', (req, res) => {
  const { name, phone } = req.body;
  const { id } = req.params;
  db.prepare(`UPDATE technicians SET name = ?, phone = ? WHERE id = ?`).run(name, phone, id);
  res.json({ success: true });
});

app.delete('/api/technicians/:id', (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM technicians WHERE id = ?`).run(id);
  res.json({ success: true });
});

// Bulk send – group tasks by technician, send one image per technician
app.post('/api/send', async (req, res) => {
  const pendingTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE resolved_at IS NULL AND line_item_status = 'New'
  `).all();
  const technicians = db.prepare('SELECT * FROM technicians').all();

  // Group tasks by technician name (using a smart match)
  const groups = new Map();
  for (const task of pendingTasks) {
    const techName = task.technician_name;
    // Find best matching technician from directory
    const matched = findBestMatch(techName, technicians);
    if (matched) {
      if (!groups.has(matched.id)) {
        groups.set(matched.id, { ...matched, tasks: [] });
      }
      groups.get(matched.id).tasks.push(task);
    }
  }

  let sent = 0;
  const skipped = [];

  for (const [techId, techData] of groups) {
    try {
      await sendTaskReminders(techData.tasks, techData.phone);
      sent++;
    } catch (err) {
      skipped.push({
        technician: techData.name,
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

// Helper: find best match for technician name
function findBestMatch(name, technicians) {
  const normalized = name.trim().toLowerCase();
  // exact match
  let found = technicians.find(t => t.name.trim().toLowerCase() === normalized);
  if (found) return found;
  // partial match (contains)
  found = technicians.find(t => t.name.trim().toLowerCase().includes(normalized) || normalized.includes(t.name.trim().toLowerCase()));
  return found || null;
}

// Dashboard stats (unchanged, but now pending only from current data)
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