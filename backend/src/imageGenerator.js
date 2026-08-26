const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const configuredTasksPerCard = Number.parseInt(process.env.MAX_TASKS_PER_CARD || '15', 10);
const MAX_TASKS_PER_CARD = Number.isFinite(configuredTasksPerCard) && configuredTasksPerCard > 0
  ? configuredTasksPerCard
  : 25;
const IMAGE_RETENTION_DAYS = 7;

function wrapText(ctx, value, maxWidth) {
  const words = String(value || '-').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}
//Manual clean up later can be done through a  nodecron when scale needed 
function cleanupGeneratedImages(dir) {
  const cutoff = Date.now() - IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.png')) continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.rmSync(filePath, { force: true });
  }
}

function generateTasksCard(tasks, technicianName, part = 1, totalParts = 1, totalTasks = tasks.length) {
  const safeName = technicianName || 'Technician';
  const cols = [
    { key: 'case_number', label: 'Case #', width: 90 },
    { key: 'days_pending', label: 'Days', width: 55 },
    { key: 'street', label: 'Address', width: 300 },
    { key: 'customer_name', label: 'Customer', width: 150 },
    { key: 'zip', label: 'Zip', width: 75 },
    { key: 'complaint', label: 'Complaint', width: 210 },
    { key: 'line_item_status', label: 'Status', width: 75 },
  ];
  const margin = 25;
  const padding = 8;
  const headerHeight = 38;
  const titleHeight = 78;
  const footerHeight = 35;
  const tableWidth = cols.reduce((sum, col) => sum + col.width, 0) + padding * 2;
  const measureContext = { measureText: (text) => ({ width: text.length * 7 }) };
  const rowData = tasks.map((task) => {
    const addressLines = wrapText(measureContext, task.street, cols[2].width - padding * 2);
    const complaintLines = wrapText(measureContext, task.complaint, cols[5].width - padding * 2);
    return { task, addressLines, complaintLines, height: Math.max(52, Math.max(addressLines.length, complaintLines.length) * 18 + 18) };
  });
  const canvasWidth = tableWidth + margin * 2;
  const tableHeight = headerHeight + rowData.reduce((sum, row) => sum + row.height, 0) + 5;
  const canvasHeight = titleHeight + tableHeight + footerHeight + 20;
  const imageScale = 1.5;
  const canvas = createCanvas(Math.ceil(canvasWidth * imageScale), Math.ceil(canvasHeight * imageScale));
  const ctx = canvas.getContext('2d');
  ctx.scale(imageScale, imageScale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Pending Tasks for ${safeName}`, margin + 4, 42);
  ctx.fillStyle = '#475569';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Total: ${totalTasks} task(s) | Part ${part} of ${totalParts}`, margin + 6, 68);

  let y = titleHeight;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(margin, y, tableWidth, headerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  let x = margin + padding;
  for (const col of cols) {
    ctx.fillText(col.label, x, y + 25);
    x += col.width;
  }
  y += headerHeight;

  rowData.forEach(({ task, addressLines, complaintLines, height }, index) => {
    ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(margin, y, tableWidth, height);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(margin, y, tableWidth, height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '13px sans-serif';
    let xPos = margin + padding;
    const values = [
      [task.case_number || '-'],
      [task.days_pending ? `${task.days_pending}d` : '-'],
      addressLines,
      [task.customer_name || '-'],
      [task.zip || '-'],
      complaintLines,
      [task.line_item_status || '-']
    ];
    cols.forEach((col, colIndex) => {
      values[colIndex].forEach((line, lineIndex) => ctx.fillText(String(line), xPos, y + 21 + lineIndex * 18));
      xPos += col.width;
    });
    y += height;
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('Electrolyte Solutions - Automated Reminder', margin + 4, canvasHeight - 10);

  const dir = path.join(__dirname, '../generated-images');
  fs.mkdirSync(dir, { recursive: true });
  cleanupGeneratedImages(dir);
  const fileName = `tasks_${safeName.replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}_${part}.png`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  return filePath;
}

function generateTasksCards(tasks, technicianName) {
  const totalParts = Math.max(1, Math.ceil(tasks.length / MAX_TASKS_PER_CARD));
  return Array.from({ length: totalParts }, (_, index) => generateTasksCard(
    tasks.slice(index * MAX_TASKS_PER_CARD, (index + 1) * MAX_TASKS_PER_CARD),
    technicianName,
    index + 1,
    totalParts,
    tasks.length
  ));
}

module.exports = { generateTasksCard, generateTasksCards, MAX_TASKS_PER_CARD };
