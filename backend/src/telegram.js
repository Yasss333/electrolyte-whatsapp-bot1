const fs = require('fs');
const path = require('path');
const { generateTasksCards, MAX_TASKS_PER_CARD } = require('./imageGenerator');
const db = require('./db');

const API_ROOT = 'https://api.telegram.org';
const POLLING_LOCK_PATH = process.env.TELEGRAM_POLLING_LOCK_PATH || path.join(__dirname, '../data/telegram-polling.lock');
const POLLING_LOCK_STALE_MS = 30_000;
let connectionState = 'unconfigured';
let lastError = null;
let botUsername = null;
let pollingTimer = null;
let pollingLockFd = null;
let pollingLockHeartbeat = null;
let pollingDisabled = false;
let initializationPromise = null;
let pollInProgress = false;
let updateOffset = 0;
const activePolls = new Set();

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim();
}

function acquirePollingLock() {
  fs.mkdirSync(path.dirname(POLLING_LOCK_PATH), { recursive: true });
  try {
    pollingLockFd = fs.openSync(POLLING_LOCK_PATH, 'wx');
    fs.writeFileSync(pollingLockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    pollingLockHeartbeat = setInterval(() => {
      try { fs.utimesSync(POLLING_LOCK_PATH, new Date(), new Date()); } catch { /* Lock ownership is checked by the poller. */ }
    }, 5_000);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      if (Date.now() - fs.statSync(POLLING_LOCK_PATH).mtimeMs > POLLING_LOCK_STALE_MS) {
        fs.unlinkSync(POLLING_LOCK_PATH);
        return acquirePollingLock();
      }
    } catch (lockError) {
      if (lockError.code === 'ENOENT') return acquirePollingLock();
    }
    return false;
  }
}

function releasePollingLock() {
  if (pollingLockHeartbeat) clearInterval(pollingLockHeartbeat);
  pollingLockHeartbeat = null;
  if (pollingLockFd === null) return;
  fs.closeSync(pollingLockFd);
  pollingLockFd = null;
  try { fs.unlinkSync(POLLING_LOCK_PATH); } catch (error) {
    if (error.code !== 'ENOENT') console.error('Telegram polling lock cleanup failed:', error.message);
  }
}

async function telegramRequest(method, body) {
  const token = getToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`${API_ROOT}/bot${token}/${method}`, { method: 'POST', body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API request failed (${response.status})`);
  }
  return result.result;
}

async function initializeBot() {
  if (initializationPromise) return initializationPromise;
  initializationPromise = initializeBotOnce();
  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

async function initializeBotOnce() {
  if (!getToken()) {
    connectionState = 'unconfigured';
    lastError = 'Set TELEGRAM_BOT_TOKEN to enable messaging.';
    return false;
  }
  if (pollingTimer || pollingLockFd !== null) return true;
  if (!acquirePollingLock()) {
    connectionState = 'error';
    lastError = 'Telegram polling is already running in another backend instance.';
    console.error('Telegram polling not started: another backend instance owns the polling lock.');
    return false;
  }
  pollingDisabled = false;
  connectionState = 'checking';
  try {
    const bot = await telegramRequest('getMe');
    botUsername = bot.username || null;
    connectionState = 'ready';
    lastError = null;
    startCommandPolling();
    console.log(`Telegram bot @${botUsername || bot.id} is ready`);
    return true;
  } catch (error) {
    releasePollingLock();
    connectionState = 'error';
    lastError = error.message;
    console.error('Telegram bot initialization failed:', error.message);
    return false;
  }
}

async function sendMessage(chatId, text) {
  const body = new URLSearchParams({ chat_id: String(chatId), text });
  return telegramRequest('sendMessage', body);
}

function findTechnician(chatId) {
  return db.prepare('SELECT * FROM technicians WHERE chat_id = ?').get(String(chatId));
}

async function handleCommand(message) {
  const chatId = String(message.chat.id);
  const text = String(message.text || '').trim();
  const command = text.split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, '');
  const technician = findTechnician(chatId);

  if (command === '/start') {
    return sendMessage(chatId, technician
      ? `Welcome back, ${technician.name}! Use /tasks to view your pending work.`
      : 'Your Telegram account is not registered yet. Please contact your administrator so they can add your chat ID.');
  }
  if (command === '/help') {
    return sendMessage(chatId, 'Available commands:\n/tasks – View your pending tasks\n/done CASE_ID – Mark a task as completed\n/item DESCRIPTION – Request a spare part or equipment\n/help – Show this message');
  }
  if (!technician) {
    return sendMessage(chatId, 'Your Telegram account is not registered. Please contact your administrator.');
  }
  if (command === '/tasks') {
    const tasks = db.prepare(`SELECT case_number, city, days_pending FROM tasks
      WHERE technician_name = ? AND line_item_status = 'New' AND resolved_at IS NULL
      ORDER BY days_pending DESC, case_number`).all(technician.name);
    if (!tasks.length) return sendMessage(chatId, '🎉 You have no pending tasks.');
    const list = tasks.map((task, index) => `${index + 1}. Case #${task.case_number} (${task.city || 'Unknown city'}) – ${task.days_pending || 0} days pending`).join('\n');
    return sendMessage(chatId, `📋 Your Pending Tasks:\n${list}\n\nReply with /done CASE_ID to mark as completed.`);
  }
  if (command === '/done') {
    const caseNumber = text.slice(command.length).trim();
    if (!caseNumber) return sendMessage(chatId, 'Usage: /done CASE_ID');
    const result = db.prepare(`UPDATE tasks SET resolved_at = ?, line_item_status = 'Completed', updated_at = ?
      WHERE case_number = ? AND technician_name = ? AND line_item_status = 'New' AND resolved_at IS NULL`)
      .run(new Date().toISOString(), new Date().toISOString(), caseNumber, technician.name);
    return sendMessage(chatId, result.changes
      ? `✅ Case #${caseNumber} marked as completed!`
      : `I couldn't find an open Case #${caseNumber} assigned to you.`);
  }
  if (command === '/item') {
    const description = text.slice(command.length).trim();
    if (!description) return sendMessage(chatId, 'Usage: /item DESCRIPTION');
    db.prepare(`INSERT INTO item_requests (technician_name, item_description, status, requested_at)
      VALUES (?, ?, 'pending', ?)`).run(technician.name, description, new Date().toISOString());
    return sendMessage(chatId, '📦 Request submitted! Admin will review it.');
  }
  return sendMessage(chatId, 'I did not understand that command. Use /help to see available commands.');
}

async function pollForCommands() {
  if (pollInProgress || pollingDisabled || !getToken() || connectionState !== 'ready') return;
  pollInProgress = true;
  try {
    const updates = await telegramRequest('getUpdates', new URLSearchParams({ offset: String(updateOffset), timeout: '0', allowed_updates: JSON.stringify(['message']) }));
    for (const update of updates) {
      updateOffset = update.update_id + 1;
      if (update.message?.text?.startsWith('/')) {
        await handleCommand(update.message).catch((error) => console.error('Telegram command error:', error.message));
      }
    }
  } catch (error) {
    lastError = error.message;
    console.error('Telegram polling error:', error.message);
    if (/conflict: terminated by other getUpdates request/i.test(error.message)) {
      pollingDisabled = true;
      connectionState = 'error';
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = null;
      releasePollingLock();
      console.error('Telegram polling stopped because another instance is using this bot token.');
    }
  } finally {
    pollInProgress = false;
  }
}

function startCommandPolling() {
  if (pollingTimer || pollingDisabled || pollingLockFd === null) return;
  const runPoll = () => {
    const poll = pollForCommands();
    activePolls.add(poll);
    poll.finally(() => activePolls.delete(poll));
  };
  runPoll();
  pollingTimer = setInterval(runPoll, 2500);
}

async function stopCommandPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  await Promise.all(activePolls);
  releasePollingLock();
}

function getStatus() { return connectionState === 'ready'; }
function getConnectionState() { return connectionState; }
function getLastError() { return lastError; }
function getBotUsername() { return botUsername; }

function buildCaption(tasks, technicianName, part, totalParts) {
  const shownTasks = tasks.slice(0, MAX_TASKS_PER_CARD);
  const taskList = shownTasks.map((task) =>
    `• Case #${task.case_number || 'N/A'} (${task.city || 'Unknown'}) — ${task.days_pending || 0} days`
  ).join('\n');
  const continuation = totalParts > 1 ? `\n\nPart ${part} of ${totalParts}` : '';
  return `Hi ${technicianName || 'Technician'}, you have ${tasks.length} pending task(s):\n${taskList}${continuation}\n\nPlease update your status today. — Electrolyte Solutions`;
}

async function sendPhoto(chatId, imagePath, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([fs.readFileSync(imagePath)], { type: 'image/png' }), 'pending-tasks.png');
  form.append('caption', caption);
  await telegramRequest('sendPhoto', form);
}

async function sendTaskReminders(tasks, chatId) {
  if (!tasks.length) return 0;
  if (!getStatus() && !(await initializeBot())) {
    throw new Error(lastError || 'Telegram bot is unavailable');
  }

  const technicianName = tasks[0].technician_name;
  const imagePaths = generateTasksCards(tasks, technicianName);
  const insertMessage = db.prepare(
    'INSERT INTO messages (technician_name, chat_id, case_number, sent_at, status) VALUES (?, ?, ?, ?, ?)'
  );
  const markSent = db.transaction((sentTasks) => sentTasks.forEach((task) => {
    if (!db.prepare('SELECT 1 FROM messages WHERE case_number = ? AND status = ? LIMIT 1').get(task.case_number, 'sent')) {
      insertMessage.run(technicianName, String(chatId), task.case_number, new Date().toISOString(), 'sent');
    }
  }));

  for (const [index, imagePath] of imagePaths.entries()) {
    const cardTasks = tasks.slice(index * MAX_TASKS_PER_CARD, (index + 1) * MAX_TASKS_PER_CARD);
    await sendPhoto(chatId, imagePath, buildCaption(cardTasks, technicianName, index + 1, imagePaths.length));
    markSent(cardTasks);
  }

  console.log(`Sent ${tasks.length} tasks to ${technicianName} (chat ${chatId})`);
  return tasks.length;
}

module.exports = { sendTaskReminders, getStatus, getConnectionState, getLastError, getBotUsername, initializeBot, stopCommandPolling };
