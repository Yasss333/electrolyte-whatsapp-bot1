const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../db/electrolyte.db'));

db.prepare(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technician_name TEXT,
  phone TEXT,
  case_number TEXT,
  sent_at TEXT,
  status TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  reply_text TEXT,
  received_at TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  phone TEXT
)`).run();

module.exports = db;