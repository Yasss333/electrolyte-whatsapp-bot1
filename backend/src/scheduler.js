const cron = require('node-cron');
const { sendTaskReminder, sendEscalation } = require('./whatsapp');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const { parseAndUpsertCSV } = require('./csvParser');

const REMINDER_COOLDOWN_HOURS = 6;
const ESCALATION_DAYS_THRESHOLD = 7;
const SUPERVISOR_PHONE = process.env.SUPERVISOR_PHONE || '';

function shouldRemind(lastRemindedAt) {
  if (!lastRemindedAt) return true;
  const last = new Date(lastRemindedAt);
  const now = new Date();
  const hoursDiff = (now - last) / (1000 * 60 * 60);
  return hoursDiff >= REMINDER_COOLDOWN_HOURS;
}

function startScheduler() {
  cron.schedule(process.env.CRON_SCHEDULE || '0 9,13,18 * * *', async () => {
    console.log('Cron triggered — sending reminders...');

    const csvPath = path.join(__dirname, '../data/input.csv');
    if (!fs.existsSync(csvPath)) return console.log('No CSV found');

    const pendingTasks = await parseAndUpsertCSV(csvPath);
    const technicians = db.prepare('SELECT * FROM technicians').all();

    for (const task of pendingTasks) {
      const tech = technicians.find(
        (t) => t.name.toLowerCase() === task.technicianName.toLowerCase()
      );
      if (!tech) continue;

      const dbTask = db.prepare('SELECT * FROM tasks WHERE case_number = ?').get(task.caseNumber);

      // Send reminder only if cooldown passed
      if (shouldRemind(dbTask?.last_reminded_at)) {
        await sendTaskReminder(task, tech.phone);
      }

      // Escalate if overdue beyond threshold
      if (task.daysPending >= ESCALATION_DAYS_THRESHOLD && SUPERVISOR_PHONE) {
        const alreadyEscalated = db.prepare(
          'SELECT * FROM escalations WHERE case_number = ? AND date(escalated_at) = date(?)'
        ).get(task.caseNumber, new Date().toISOString());

        if (!alreadyEscalated) {
          await sendEscalation(task, SUPERVISOR_PHONE);
        }
      }
    }
  });

  console.log('Scheduler started');
}

module.exports = { startScheduler };