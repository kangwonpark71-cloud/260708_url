import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'urls.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_key TEXT NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      click_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_urls_short_key ON urls(short_key);
  `);
}

export interface UrlRecord {
  id: number;
  short_key: string;
  original_url: string;
  created_at: string;
  click_count: number;
}

export function insertUrl(shortKey: string, originalUrl: string): UrlRecord {
  const stmt = getDb().prepare(
    'INSERT INTO urls (short_key, original_url) VALUES (?, ?)'
  );
  stmt.run(shortKey, originalUrl);
  return getByKey(shortKey)!;
}

export function getByKey(shortKey: string): UrlRecord | undefined {
  const stmt = getDb().prepare(
    'SELECT * FROM urls WHERE short_key = ?'
  );
  return stmt.get(shortKey) as UrlRecord | undefined;
}

export function incrementClickCount(shortKey: string): void {
  const stmt = getDb().prepare(
    'UPDATE urls SET click_count = click_count + 1 WHERE short_key = ?'
  );
  stmt.run(shortKey);
}
