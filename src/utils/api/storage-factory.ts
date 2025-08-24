// Conditional imports for database managers
let DatabaseHistoryManager: any = null;
let DatabaseKnowledgeManager: any = null;
let DatabaseSessionManager: any = null;
let DatabaseUserManager: any = null;

// Only import database managers if not in serverless environment
try {
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.NETLIFY) {
    DatabaseHistoryManager = require("./db-history-manager").DatabaseHistoryManager;
    DatabaseKnowledgeManager = require("./db-knowledge-manager").DatabaseKnowledgeManager;
    DatabaseSessionManager = require("./db-session-manager").DatabaseSessionManager;
    DatabaseUserManager = require("./db-user-manager").DatabaseUserManager;
  }
} catch (error) {
  console.warn("Database managers not available:", error);
}

import { HistoryManager } from "./history-manager";
import { KnowledgeManager } from "./knowledge-manager";
import { SessionManager } from "./session-manager";
import { UserManager } from "./user-manager";

export type StorageType = "memory" | "database";

export function getStorageType(): StorageType {
  // Force memory storage in serverless environments like Vercel
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return "memory";
  }
  return process.env.STORAGE_TYPE === "database" ? "database" : "memory";
}

// Helper function to check if a specific manager type should use database
export function shouldUseDatabaseForManager(
  managerType: "user" | "session" | "knowledge" | "history"
): boolean {
  // All database managers are now fully implemented
  const databaseReadyManagers = ["user", "session", "knowledge", "history"];
  return getStorageType() === "database" && databaseReadyManagers.includes(managerType);
}

export function getUserManager() {
  if (shouldUseDatabaseForManager("user") && DatabaseUserManager) {
    return DatabaseUserManager.getInstance();
  } else {
    return UserManager.getInstance();
  }
}

export function getSessionManager() {
  if (shouldUseDatabaseForManager("session") && DatabaseSessionManager) {
    return DatabaseSessionManager.getInstance();
  } else {
    return SessionManager.getInstance();
  }
}

export function getKnowledgeManager() {
  if (shouldUseDatabaseForManager("knowledge") && DatabaseKnowledgeManager) {
    return DatabaseKnowledgeManager.getInstance();
  } else {
    return KnowledgeManager.getInstance();
  }
}

export function getHistoryManager() {
  if (shouldUseDatabaseForManager("history") && DatabaseHistoryManager) {
    return DatabaseHistoryManager.getInstance();
  } else {
    return HistoryManager.getInstance();
  }
}

// Utility function to check if database is available and working
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    if (getStorageType() !== "database" || !DatabaseUserManager) {
      return false;
    }

    const userManager = DatabaseUserManager.getInstance();
    // Try to perform a simple operation
    await userManager.list();
    return true;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}

// Utility to get storage stats
export async function getStorageStats() {
  const storageType = getStorageType();
  const userManager = getUserManager();
  const sessionManager = getSessionManager();
  const knowledgeManager = getKnowledgeManager();
  const historyManager = getHistoryManager();

  try {
    const [users, sessions, knowledge, history] = await Promise.all([
      userManager.list(),
      sessionManager.list(),
      knowledgeManager.list(),
      historyManager.list(),
    ]);

    return {
      storageType,
      counts: {
        users: users.length,
        sessions: sessions.length,
        knowledge: knowledge.length,
        history: history.length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting storage stats:", error);
    return {
      storageType,
      counts: {
        users: 0,
        sessions: 0,
        knowledge: 0,
        history: 0,
      },
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}
