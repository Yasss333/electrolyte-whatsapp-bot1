const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateTasksCard(tasks, technicianName) {
  const safeName = technicianName || 'Technician';

  // Columns – no Days column, wider fields
  const cols = [
    { key: 'case_number', label: 'Case #', width: 100 },
    { key: 'customer_name', label: 'Customer', width: 180 },
    { key: 'city', label: 'City', width: 140 },
    { key: 'complaint', label: 'Complaint', width: 240 },
    { key: 'product_name', label: 'Product', width: 220 },
    { key: 'technician_assigned_date', label: 'Assigned', width: 160 },
  ];

  const margin = 30;
  const padding = 12;
  const rowHeight = 38;
  const headerHeight = 42;
  const tableWidth = 1140; // sum of column widths + padding
  const canvasWidth = 1200;

  const totalRows = tasks.length;
  const tableHeight = headerHeight + totalRows * rowHeight + 10;
  const titleHeight = 80;
  const footerHeight = 50;
  const canvasHeight = titleHeight + tableHeight + footerHeight + 30;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`📋 Pending Tasks for ${safeName}`, margin, 55);

  ctx.fillStyle = '#475569';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Total: ${tasks.length} task(s)`, margin, 82);

  let y = 110;

  // ---- Table header ----
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(margin, y, tableWidth, headerHeight);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, y, tableWidth, headerHeight);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 15px sans-serif';
  let x = margin + padding;
  for (const col of cols) {
    ctx.fillText(col.label, x, y + 28);
    x += col.width;
  }
  y += headerHeight;

  // ---- Table rows ----
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const isEven = i % 2 === 0;
    ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
    ctx.fillRect(margin, y, tableWidth, rowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(margin, y, tableWidth, rowHeight);

    ctx.fillStyle = '#0f172a';
    ctx.font = '14px sans-serif';
    let xPos = margin + padding;
    for (const col of cols) {
      let value = task[col.key] || '';
      // Show full values – no truncation (canvas will clip if too long, but we have width)
      // We'll allow up to 30 chars; if longer, we reduce font slightly
      if (value.length > 35) {
        ctx.font = '13px sans-serif';
      } else {
        ctx.font = '14px sans-serif';
      }
      ctx.fillText(value, xPos, y + 26);
      xPos += col.width;
    }
    y += rowHeight;
  }

  // ---- Footer ----
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText('Electrolyte Solutions — Automated Reminder', margin, canvasHeight - 16);

  const dir = path.join(__dirname, '../generated-images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fileName = `tasks_${safeName.replace(/\s+/g, '_')}_${Date.now()}.png`;
  const filePath = path.join(dir, fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

module.exports = { generateTasksCard };