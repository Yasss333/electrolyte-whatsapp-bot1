const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateTaskCard(task) {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Top accent bar
  ctx.fillStyle = '#f97316';
  ctx.fillRect(0, 0, width, 8);

  // Header
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('⚠ PENDING TASK REMINDER', 40, 55);

  // Divider
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 75);
  ctx.lineTo(760, 75);
  ctx.stroke();

  // Fields
  const fields = [
    ['Technician', task.technicianName],
    ['Case Number', task.caseNumber],
    ['Customer', task.customerName],
    ['Location', `${task.city}, ${task.state} - ${task.zip}`],
    ['Complaint', task.complaint],
    ['Product', task.productName],
    ['Assigned Date', task.technicianAssignedDate],
    ['Status', task.lineItemStatus || task.woStatus],
  ];

  let y = 110;
  fields.forEach(([label, value]) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(label + ':', 40, y);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(value || 'N/A', 220, y);

    y += 38;
  });

  // Footer
  ctx.fillStyle = '#475569';
  ctx.font = '13px sans-serif';
  ctx.fillText('Electrolyte Solutions — Automated Reminder System', 40, 400);

  // Save image
  const fileName = `task_${task.caseNumber}_${Date.now()}.png`;
  const filePath = path.join(__dirname, '../generated-images', fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

module.exports = { generateTaskCard };