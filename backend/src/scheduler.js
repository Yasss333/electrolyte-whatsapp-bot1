const cron = require('node-cron');
const { sendTaskReminder } = require('./whatsapp');
const { parseCSV } = require('./csvParser');
const db = require('./db');
const path = require('path');
const fs = require('fs');

function startScheduler() {
  cron.schedule(process.env.CRON_SCHEDULE || '0 9,13,18 * * *', async () => {
    console.log('Cron triggered — sending reminders...');
    const csvPath = path.join(__dirname, '../data/input.csv');
    if (!fs.existsSync(csvPath)) return console.log('No CSV found');

    const pendingTasks = await parseCSV(csvPath);
    const technicians = db.prepare('SELECT * FROM technicians').all();

    for (const task of pendingTasks) {
      const tech = technicians.find(
        (t) => t.name.toLowerCase() === task.technicianName.toLowerCase()
      );
      if (tech) await sendTaskReminder(task, tech.phone);
    }
  });

  console.log('Scheduler started');
}

module.exports = { startScheduler };