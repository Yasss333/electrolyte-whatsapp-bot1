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
const dbPath = path.join(dbDir, "electrolyte.db");

// Open (or create) the database
const db = new Database(dbPath);

// console.log("Database path:", dbPath);

db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_number TEXT UNIQUE,
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
  chat_id TEXT,
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
  phone TEXT,
  chat_id TEXT
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
  chat_id TEXT,
  case_number TEXT,
  reason TEXT,
  suggestion TEXT,
  type TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT,
  chat_id TEXT,
  updated_at TEXT
)`).run();

db.prepare(`INSERT OR IGNORE INTO admins (email, password, updated_at) VALUES (?, ?, ?)`)
  .run('admin@ec.com', 'admin123', new Date().toISOString());

db.prepare(`CREATE TABLE IF NOT EXISTS item_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technician_name TEXT,
  case_number TEXT,
  item_description TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TEXT,
  resolved_at TEXT
)`).run();

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

// Existing installations retain legacy phone data but all new delivery uses Telegram chat IDs.
ensureColumn('messages', 'chat_id', 'TEXT');
ensureColumn('technicians', 'chat_id', 'TEXT');
ensureColumn('send_reports', 'chat_id', 'TEXT');

db.prepare(`CREATE TABLE IF NOT EXISTS send_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  total INTEGER DEFAULT 0,
  sent INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  error TEXT,
  started_at TEXT,
  finished_at TEXT
)`).run();
//above table not used but can ne used to maintain a record for bulk sends

module.exports = db;
