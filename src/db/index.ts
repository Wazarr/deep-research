import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Database file path
const dbPath = process.env.DATABASE_PATH || "./data/research.db";

let db: any = null;

// Initialize database connection
function initializeDatabase() {
  // Skip database initialization in serverless environments
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    console.log("Skipping database initialization in serverless environment");
    return null;
  }

  try {
    // Dynamic import to avoid bundling issues in serverless
    const Database = require("better-sqlite3");
    const { drizzle } = require("drizzle-orm/better-sqlite3");

    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");

    db = drizzle(sqlite, { schema });

    // Run migrations
    runMigrations();

    return db;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    console.log("Falling back to memory storage");
    return null;
  }
}

// Run database migrations
function runMigrations() {
  if (!db) {
    console.log("No database instance available for migrations");
    return;
  }

  try {
    // Create tables if they don't exist
    db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        settings TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('file', 'url', 'knowledge')),
        content TEXT,
        url TEXT,
        file_meta TEXT,
        status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
        size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'topic' CHECK (phase IN ('topic', 'questions', 'feedback', 'planning', 'executing', 'completed', 'error')),
        
        topic TEXT,
        questions TEXT,
        feedback TEXT,
        report_plan TEXT,
        tasks TEXT DEFAULT '[]',
        results TEXT DEFAULT '[]',
        final_report TEXT,
        error TEXT,
        settings TEXT NOT NULL,
        
        resources TEXT DEFAULT '[]',
        requirement TEXT DEFAULT '',
        suggestion TEXT DEFAULT '',
        knowledge_graph TEXT DEFAULT '',
        images TEXT DEFAULT '[]',
        sources TEXT DEFAULT '[]',
        title TEXT DEFAULT '',
        query TEXT DEFAULT '',
        version INTEGER NOT NULL DEFAULT 1,
        metadata TEXT DEFAULT '{}'
      );
    `);

    db.run(sql`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        session_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes for better performance
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_user_id ON knowledge(user_id);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);`);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_history_session_id ON history(session_id);`);
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
}

// Create database directory if it doesn't exist
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Only create directory and initialize if not in serverless
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.NETLIFY) {
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch (_error) {
    // Directory might already exist
  }

  // Initialize on import
  db = initializeDatabase();
}

export { db };
export * from "./schema";
