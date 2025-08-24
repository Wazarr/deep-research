import { DatabaseHistoryManager } from "./db-history-manager";
import { DatabaseKnowledgeManager } from "./db-knowledge-manager";
import { DatabaseSessionManager } from "./db-session-manager";
import { DatabaseUserManager } from "./db-user-manager";
import { HistoryManager } from "./history-manager";
import { KnowledgeManager } from "./knowledge-manager";
import { SessionManager } from "./session-manager";
import { UserManager } from "./user-manager";

export type StorageType = "memory" | "database";

export function getStorageType(): StorageType {
  return process.env.STORAGE_TYPE === "database" ? "database" : "memory";
}

export function getUserManager() {
  const storageType = getStorageType();

  if (storageType === "database") {
    return DatabaseUserManager.getInstance();
  } else {
    return UserManager.getInstance();
  }
}

export function getSessionManager() {
  const storageType = getStorageType();

  if (storageType === "database") {
    return DatabaseSessionManager.getInstance();
  } else {
    return SessionManager.getInstance();
  }
}

export function getKnowledgeManager() {
  const storageType = getStorageType();

  if (storageType === "database") {
    return DatabaseKnowledgeManager.getInstance();
  } else {
    return KnowledgeManager.getInstance();
  }
}

export function getHistoryManager() {
  const storageType = getStorageType();

  if (storageType === "database") {
    return DatabaseHistoryManager.getInstance();
  } else {
    return HistoryManager.getInstance();
  }
}

// Utility function to check if database is available and working
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    if (getStorageType() !== "database") {
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
