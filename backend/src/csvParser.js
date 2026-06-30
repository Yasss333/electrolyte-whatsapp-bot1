const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

function daysBetween(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 0;
  const assigned = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  const now = new Date();
  return Math.floor((now - assigned) / (1000 * 60 * 60 * 24));
}

function classifyReply(text) {
  const t = text.toLowerCase();
  if (['done', 'completed', 'finish', 'fixed', 'resolved'].some(w => t.includes(w))) return 'completed';
  if (['part', 'waiting', 'delay', 'pending', 'stuck'].some(w => t.includes(w))) return 'delayed';
  return 'unclassified';
}

function parseAndUpsertCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let rowCount = 0;
    let batch = [];
    const BATCH_SIZE = 500;

    const insertStmt = db.prepare(`
      INSERT INTO tasks (
        case_number, technician_name, customer_name, city, state, zip, street,
        complaint, product_name, wo_status, line_item_status,
        technician_assigned_date, created_date, end_date,
        days_pending, resolved_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(case_number) DO UPDATE SET
        wo_status=excluded.wo_status,
        line_item_status=excluded.line_item_status,
        days_pending=excluded.days_pending,
        resolved_at=CASE WHEN excluded.resolved_at IS NOT NULL THEN excluded.resolved_at ELSE tasks.resolved_at END,
        updated_at=excluded.updated_at
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        insertStmt.run(...row);
      }
    });

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        if (rowCount % 100 === 0) {
          console.log(`📄 Processing CSV row ${rowCount}...`);
        }

        let lineItemStatus = row['LineItem Status']?.trim();
        // Normalise status: treat any case of 'new' as 'New'
        if (lineItemStatus && lineItemStatus.toLowerCase() === 'new') {
          lineItemStatus = 'New';
        }

        const woStatus = row['WO Status']?.trim();
        const techName = row['Technician Name']?.trim();
        const caseNumber = row['Case Number']?.trim();
        const street = row['Street']?.trim() || '';

        if (!techName || !caseNumber) return;

        const isCompleted = lineItemStatus === 'Completed' || woStatus === 'Resolved';
        const daysPending = daysBetween(row['Technician Assigned Date']?.trim());

        // Prepare insert data (17 values)
        batch.push([
          caseNumber,
          techName,
          row['Customer Name']?.trim(),
          row['City']?.trim(),
          row['State/Province']?.trim(),
          row['Zip/Postal Code']?.trim(),
          street,
          row['Customer Complaint']?.trim(),
          row['Product Name']?.trim(),
          woStatus,
          lineItemStatus,
          row['Technician Assigned Date']?.trim(),
          row['Created Date']?.trim(),
          row['End Date']?.trim(),
          daysPending,
          isCompleted ? new Date().toISOString() : null,
          new Date().toISOString()
        ]);

        if (batch.length >= BATCH_SIZE) {
          insertMany(batch);
          batch = [];
        }

        // Collect pending tasks only if status is "New"
        if (!isCompleted && lineItemStatus === 'New') {
          results.push({
            caseNumber,
            case_number: caseNumber,
            technician_name: techName,
            customer_name: row['Customer Name']?.trim(),
            city: row['City']?.trim(),
            state: row['State/Province']?.trim(),
            zip: row['Zip/Postal Code']?.trim(),
            street: street,
            complaint: row['Customer Complaint']?.trim(),
            product_name: row['Product Name']?.trim(),
            woStatus,
            line_item_status: lineItemStatus,
            technician_assigned_date: row['Technician Assigned Date']?.trim(),
            days_pending: daysPending,
          });
        }
      })
      .on('end', () => {
        if (batch.length) {
          insertMany(batch);
        }
        console.log(`✅ CSV parsing finished. Total rows: ${rowCount}. Pending ('New') tasks found: ${results.length}`);
        resolve(results);
      })
      .on('error', reject);
  });
}

module.exports = { parseAndUpsertCSV, classifyReply };