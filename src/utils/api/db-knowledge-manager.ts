import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, type Knowledge, knowledge, type NewKnowledge } from "../../db";
import type { KnowledgeResponse } from "./types";

export class DatabaseKnowledgeManager {
  private static instance: DatabaseKnowledgeManager;

  static getInstance(): DatabaseKnowledgeManager {
    if (!DatabaseKnowledgeManager.instance) {
      DatabaseKnowledgeManager.instance = new DatabaseKnowledgeManager();
    }
    return DatabaseKnowledgeManager.instance;
  }

  async create(data: {
    title: string;
    type: "file" | "url" | "knowledge";
    userId?: string;
    content?: string;
    url?: string;
    fileMeta?: {
      name: string;
      size: number;
      type: string;
      lastModified: number;
    };
    size?: number;
  }): Promise<KnowledgeResponse> {
    const now = new Date().toISOString();

    const newKnowledge: NewKnowledge = {
      id: nanoid(),
      userId: data.userId,
      title: data.title,
      type: data.type,
      content: data.content,
      url: data.url,
      fileMeta: data.fileMeta ? JSON.stringify(data.fileMeta) : null,
      status: "processing",
      size: data.size || 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(knowledge).values(newKnowledge);

    return this.convertDbKnowledgeToResponse(newKnowledge);
  }

  async get(knowledgeId: string): Promise<KnowledgeResponse | null> {
    try {
      const result = await db
        .select()
        .from(knowledge)
        .where(eq(knowledge.id, knowledgeId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.convertDbKnowledgeToResponse(result[0]);
    } catch (error) {
      console.error("Error getting knowledge:", error);
      return null;
    }
  }

  async list(userId?: string): Promise<KnowledgeResponse[]> {
    try {
      const result = userId
        ? await db.select().from(knowledge).where(eq(knowledge.userId, userId))
        : await db.select().from(knowledge);
      return result.map((k) => this.convertDbKnowledgeToResponse(k));
    } catch (error) {
      console.error("Error listing knowledge:", error);
      return [];
    }
  }

  async update(
    knowledgeId: string,
    updates: Partial<{
      title: string;
      content: string;
      status: "processing" | "completed" | "failed";
      size: number;
    }>
  ): Promise<KnowledgeResponse | null> {
    try {
      const now = new Date().toISOString();

      const dbUpdates: Partial<Knowledge> = {
        updatedAt: now,
        ...updates,
      };

      await db.update(knowledge).set(dbUpdates).where(eq(knowledge.id, knowledgeId));

      return await this.get(knowledgeId);
    } catch (error) {
      console.error("Error updating knowledge:", error);
      return null;
    }
  }

  async delete(knowledgeId: string): Promise<boolean> {
    try {
      const result = await db.delete(knowledge).where(eq(knowledge.id, knowledgeId));
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting knowledge:", error);
      return false;
    }
  }

  async getByUser(userId: string): Promise<KnowledgeResponse[]> {
    return await this.list(userId);
  }

  async getByType(
    type: "file" | "url" | "knowledge",
    userId?: string
  ): Promise<KnowledgeResponse[]> {
    try {
      const whereConditions = [eq(knowledge.type, type)];

      if (userId) {
        whereConditions.push(eq(knowledge.userId, userId));
      }

      const whereCondition =
        whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions)!;
      const result = await db.select().from(knowledge).where(whereCondition);
      return result.map((k) => this.convertDbKnowledgeToResponse(k));
    } catch (error) {
      console.error("Error getting knowledge by type:", error);
      return [];
    }
  }

  async search(query: string, userId?: string): Promise<KnowledgeResponse[]> {
    try {
      // Simple search implementation - in production, you might want to use FTS
      const items = await this.list(userId);
      const lowerQuery = query.toLowerCase();

      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.url?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error("Error searching knowledge:", error);
      return [];
    }
  }

  async validateOwnership(
    knowledgeId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    try {
      const knowledge = await this.get(knowledgeId);
      if (!knowledge) return false;
      return knowledge.userId === userId;
    } catch (error) {
      console.error("Error validating knowledge ownership:", error);
      return false;
    }
  }

  async processFile(file: File, userId?: string): Promise<KnowledgeResponse> {
    // For now, just store the file metadata
    // In a real implementation, you'd process the file content
    const content = await file.text();

    return await this.create({
      type: "file",
      title: file.name,
      content,
      size: file.size,
      userId,
      fileMeta: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      },
    });
  }

  async processUrl(url: string, title?: string, userId?: string): Promise<KnowledgeResponse> {
    // In a real implementation, you'd crawl the URL content
    return await this.create({
      type: "url",
      title: title || url,
      url,
      userId,
    });
  }

  async processText(text: string, title: string, userId?: string): Promise<KnowledgeResponse> {
    return await this.create({
      type: "knowledge",
      title,
      content: text,
      userId,
    });
  }

  // Helper method to convert database knowledge to KnowledgeResponse
  private convertDbKnowledgeToResponse(dbKnowledge: Knowledge | NewKnowledge): KnowledgeResponse {
    return {
      id: dbKnowledge.id,
      title: dbKnowledge.title,
      type: dbKnowledge.type as "file" | "url" | "knowledge",
      size: dbKnowledge.size || 0,
      status: dbKnowledge.status as "processing" | "completed" | "failed",
      createdAt: dbKnowledge.createdAt || new Date().toISOString(),
      updatedAt: dbKnowledge.updatedAt || new Date().toISOString(),
      userId: dbKnowledge.userId || undefined,
      url: dbKnowledge.url || undefined,
      fileMeta: dbKnowledge.fileMeta ? JSON.parse(dbKnowledge.fileMeta as string) : undefined,
    };
  }
}
