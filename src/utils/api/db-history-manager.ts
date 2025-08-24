import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, type History, history, type NewHistory } from "../../db";
import type { HistoryItem, ResearchSession } from "./types";

export class DatabaseHistoryManager {
  private static instance: DatabaseHistoryManager;

  static getInstance(): DatabaseHistoryManager {
    if (!DatabaseHistoryManager.instance) {
      DatabaseHistoryManager.instance = new DatabaseHistoryManager();
    }
    return DatabaseHistoryManager.instance;
  }

  async save(
    sessionData: ResearchSession,
    title?: string,
    tags: string[] = [],
    userId?: string
  ): Promise<HistoryItem> {
    const now = new Date().toISOString();

    const historyData: NewHistory = {
      id: nanoid(),
      userId: userId,
      sessionId: sessionData.id,
      title: title || sessionData.topic || `Research ${sessionData.id.slice(0, 8)}`,
      tags: JSON.stringify(tags),
      sessionData: JSON.stringify(sessionData),
      createdAt: now,
    };

    await db.insert(history).values(historyData);

    return this.convertDbHistoryToHistoryItem(historyData);
  }

  async get(historyId: string): Promise<HistoryItem | null> {
    try {
      const result = await db.select().from(history).where(eq(history.id, historyId)).limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.convertDbHistoryToHistoryItem(result[0]);
    } catch (error) {
      console.error("Error getting history item:", error);
      return null;
    }
  }

  async list(userId?: string): Promise<HistoryItem[]> {
    try {
      let result;

      if (userId) {
        result = await db
          .select()
          .from(history)
          .where(eq(history.userId, userId))
          .orderBy(desc(history.createdAt));
      } else {
        result = await db.select().from(history).orderBy(desc(history.createdAt));
      }

      return result.map((h) => this.convertDbHistoryToHistoryItem(h));
    } catch (error) {
      console.error("Error listing history:", error);
      return [];
    }
  }

  async delete(historyId: string): Promise<boolean> {
    try {
      const result = await db.delete(history).where(eq(history.id, historyId));
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting history item:", error);
      return false;
    }
  }

  async update(
    historyId: string,
    updates: Partial<{
      title: string;
      tags: string[];
    }>
  ): Promise<HistoryItem | null> {
    try {
      const dbUpdates: Partial<History> = {};

      if (updates.title !== undefined) {
        dbUpdates.title = updates.title;
      }
      if (updates.tags !== undefined) {
        dbUpdates.tags = JSON.stringify(updates.tags);
      }

      await db.update(history).set(dbUpdates).where(eq(history.id, historyId));

      return await this.get(historyId);
    } catch (error) {
      console.error("Error updating history item:", error);
      return null;
    }
  }

  async search(query: string, userId?: string): Promise<HistoryItem[]> {
    try {
      const items = await this.list(userId);
      const lowerQuery = query.toLowerCase();

      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
          item.sessionData.topic?.toLowerCase().includes(lowerQuery) ||
          item.sessionData.finalReport?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error("Error searching history:", error);
      return [];
    }
  }

  async getByTag(tag: string, userId?: string): Promise<HistoryItem[]> {
    try {
      const items = await this.list(userId);
      return items.filter((item) => item.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    } catch (error) {
      console.error("Error getting history by tag:", error);
      return [];
    }
  }

  async getBySessionId(sessionId: string, userId?: string): Promise<HistoryItem[]> {
    try {
      const whereConditions = [eq(history.sessionId, sessionId)];

      if (userId) {
        whereConditions.push(eq(history.userId, userId));
      }

      const whereCondition =
        whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions)!;
      const result = await db.select().from(history).where(whereCondition);
      return result.map((h) => this.convertDbHistoryToHistoryItem(h));
    } catch (error) {
      console.error("Error getting history by session ID:", error);
      return [];
    }
  }

  async getAllTags(userId?: string): Promise<string[]> {
    try {
      const items = await this.list(userId);
      const tagSet = new Set<string>();

      items.forEach((item) => {
        item.tags.forEach((tag) => tagSet.add(tag));
      });

      return Array.from(tagSet).sort();
    } catch (error) {
      console.error("Error getting all tags:", error);
      return [];
    }
  }

  async validateOwnership(
    historyId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    try {
      const item = await this.get(historyId);
      if (!item) return false;
      return item.userId === userId;
    } catch (error) {
      console.error("Error validating history ownership:", error);
      return false;
    }
  }

  async restore(
    historyId: string,
    expiresIn = 3600,
    userId?: string
  ): Promise<ResearchSession | null> {
    try {
      const item = await this.get(historyId);
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
    } catch (error) {
      console.error("Error restoring from history:", error);
      return null;
    }
  }

  async updateTags(historyId: string, tags: string[]): Promise<HistoryItem | null> {
    try {
      const item = await this.get(historyId);
      if (!item) return null;

      const [updatedHistory] = await db
        .update(history)
        .set({
          tags: JSON.stringify(tags),
        })
        .where(eq(history.id, historyId))
        .returning();

      if (!updatedHistory) return null;

      return this.convertDbHistoryToHistoryItem(updatedHistory);
    } catch (error) {
      console.error("Error updating history tags:", error);
      return null;
    }
  }

  // Helper method to convert database history to HistoryItem
  private convertDbHistoryToHistoryItem(dbHistory: History | NewHistory): HistoryItem {
    return {
      id: dbHistory.id,
      userId: dbHistory.userId || undefined,
      sessionId: dbHistory.sessionId,
      title: dbHistory.title,
      tags: JSON.parse((dbHistory.tags as string) || "[]"),
      sessionData: JSON.parse((dbHistory.sessionData as string) || "{}"),
      createdAt: dbHistory.createdAt || new Date().toISOString(),
    };
  }
}
