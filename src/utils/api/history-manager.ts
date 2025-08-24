import { nanoid } from "nanoid";
import type { HistoryItem, ResearchSession } from "./types";

// Global storage that persists across Edge Runtime requests
// Using globalThis to ensure persistence across Edge Runtime requests
if (!(globalThis as any).__historyStorage) {
  (globalThis as any).__historyStorage = new Map<string, HistoryItem>();
}
const historyStorage = (globalThis as any).__historyStorage as Map<string, HistoryItem>;

// Direct functions using module-level storage
async function getHistoryItem(historyId: string): Promise<HistoryItem | null> {
  return historyStorage.get(historyId) || null;
}

async function setHistoryItem(historyId: string, item: HistoryItem): Promise<void> {
  historyStorage.set(historyId, item);
}

async function deleteHistoryItem(historyId: string): Promise<void> {
  historyStorage.delete(historyId);
}

async function listHistory(userId?: string): Promise<HistoryItem[]> {
  const items = Array.from(historyStorage.values());
  const filtered = userId ? items.filter((item) => item.userId === userId) : items;

  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function findHistoryBySession(sessionId: string): Promise<HistoryItem | null> {
  for (const item of historyStorage.values()) {
    if (item.sessionId === sessionId) {
      return item;
    }
  }
  return null;
}

export class HistoryManager {
  private static instance: HistoryManager;

  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  async save(
    sessionData: ResearchSession,
    title?: string,
    tags: string[] = [],
    userId?: string
  ): Promise<HistoryItem> {
    // Check if this session is already saved
    const existingItem = await findHistoryBySession(sessionData.id);

    if (existingItem) {
      // Update existing history item
      const updatedItem: HistoryItem = {
        ...existingItem,
        title: title || existingItem.title,
        tags: tags.length > 0 ? tags : existingItem.tags,
        sessionData: {
          ...sessionData,
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          expiresAt: sessionData.expiresAt,
        },
      };

      await setHistoryItem(existingItem.id, updatedItem);
      return updatedItem;
    }

    // Create new history item
    const historyItem: HistoryItem = {
      id: nanoid(),
      userId,
      sessionId: sessionData.id,
      title:
        title || sessionData.title || sessionData.topic || `Research ${sessionData.id.slice(0, 8)}`,
      tags,
      sessionData: {
        ...sessionData,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        expiresAt: sessionData.expiresAt,
      },
      createdAt: new Date().toISOString(),
    };

    await setHistoryItem(historyItem.id, historyItem);
    return historyItem;
  }

  async get(historyId: string): Promise<HistoryItem | null> {
    return await getHistoryItem(historyId);
  }

  async list(userId?: string): Promise<HistoryItem[]> {
    return await listHistory(userId);
  }

  async delete(historyId: string): Promise<boolean> {
    const item = await getHistoryItem(historyId);
    if (!item) return false;

    await deleteHistoryItem(historyId);
    return true;
  }

  async validateOwnership(
    historyId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    const item = await getHistoryItem(historyId);
    if (!item) return false;

    return item.userId === userId;
  }

  async restore(
    historyId: string,
    expiresIn = 3600,
    userId?: string
  ): Promise<ResearchSession | null> {
    const item = await getHistoryItem(historyId);
    if (!item) return null;

    // Check ownership if user is authenticated
    if (userId && !(await this.validateOwnership(historyId, userId))) {
      return null;
    }

    // Create a new session based on the historical data
    const now = new Date();
    const restoredSession: ResearchSession = {
      ...item.sessionData,
      id: nanoid(), // Generate new session ID
      userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
      phase: "topic", // Reset to beginning of flow
      error: undefined, // Clear any previous errors
    };

    return restoredSession;
  }

  async updateTags(historyId: string, tags: string[]): Promise<HistoryItem | null> {
    const item = await getHistoryItem(historyId);
    if (!item) return null;

    const updatedItem: HistoryItem = {
      ...item,
      tags,
    };

    await setHistoryItem(historyId, updatedItem);
    return updatedItem;
  }

  async search(query: string, userId?: string): Promise<HistoryItem[]> {
    const items = await this.list(userId);
    const lowerQuery = query.toLowerCase();

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        item.sessionData.topic?.toLowerCase().includes(lowerQuery) ||
        item.sessionData.finalReport?.toLowerCase().includes(lowerQuery)
    );
  }

  async getByTag(tag: string, userId?: string): Promise<HistoryItem[]> {
    const items = await this.list(userId);
    return items.filter((item) => item.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
  }
}
