const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Define the directory
const dbDir = path.join(__dirname, "../db");

// Create the directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Define the database path
const dbPath = process.env.DB_PATH || path.join(dbDir, "electrolyte.db");

// Open (or create) the database
const db = new Database(dbPath);

console.log("Database path:", dbPath);

db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_number TEXT,
  technician_name TEXT,
  customer_name TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  street TEXT,
  complaint TEXT,
  product_name TEXT,
  wo_status TEXT,
  line_item_status TEXT,
  technician_assigned_date TEXT,
  created_date TEXT,
  end_date TEXT,
  last_reminded_at TEXT,
  resolved_at TEXT,
  days_pending INTEGER DEFAULT 0,
  updated_at TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technician_name TEXT,
  phone TEXT,
  case_number TEXT,
  sent_at TEXT,
  status TEXT
)`).run();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`).run();

// db.prepare(`CREATE TABLE IF NOT EXISTS replies (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   phone TEXT,
//   reply_text TEXT,
//   received_at TEXT,
//   classification TEXT DEFAULT 'unclassified'
// )`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  phone TEXT
)`).run();

// db.prepare(`CREATE TABLE IF NOT EXISTS escalations (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   case_number TEXT,
//   technician_name TEXT,
//   escalated_at TEXT,
//   days_pending INTEGER
// )`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS send_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  technician_name TEXT,
  matched_name TEXT,
  phone TEXT,
  case_number TEXT,
  reason TEXT,
  suggestion TEXT,
  type TEXT
)`).run();

module.exports = db;