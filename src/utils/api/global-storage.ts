import type { HistoryItem, KnowledgeResponse, ResearchSession, UserProfile } from "./types";

// Centralized global storage using a single storage object
// This reduces the chance of Edge Runtime isolation issues
// Using globalThis to ensure persistence across Edge Runtime requests
if (!(globalThis as any).__apiStorage) {
  (globalThis as any).__apiStorage = {
    users: new Map<string, UserProfile>(),
    knowledge: new Map<string, KnowledgeResponse>(),
    history: new Map<string, HistoryItem>(),
    sessions: new Map<string, ResearchSession>(),
  };
}

const storage = (globalThis as any).__apiStorage as {
  users: Map<string, UserProfile>;
  knowledge: Map<string, KnowledgeResponse>;
  history: Map<string, HistoryItem>;
  sessions: Map<string, ResearchSession>;
};

// Export direct access to each store
export const userStorage = storage.users;
export const knowledgeStorage = storage.knowledge;
export const historyStorage = storage.history;
export const sessionStorage = storage.sessions;

// Debug function to check storage state
export function getStorageStats() {
  return {
    users: storage.users.size,
    knowledge: storage.knowledge.size,
    history: storage.history.size,
    sessions: storage.sessions.size,
    timestamp: new Date().toISOString(),
  };
}

// Function to clear all storage (for testing)
export function clearAllStorage() {
  storage.users.clear();
  storage.knowledge.clear();
  storage.history.clear();
  storage.sessions.clear();
}
