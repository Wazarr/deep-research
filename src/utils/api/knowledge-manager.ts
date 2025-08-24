import { nanoid } from "nanoid";
import type { KnowledgeResponse } from "./types";

// Global storage that persists across Edge Runtime requests
// Using globalThis to ensure persistence across Edge Runtime requests
if (!(globalThis as any).__knowledgeStorage) {
  (globalThis as any).__knowledgeStorage = new Map<string, KnowledgeResponse>();
}
const knowledgeStorage = (globalThis as any).__knowledgeStorage as Map<string, KnowledgeResponse>;

// Direct functions using module-level storage
async function getKnowledge(knowledgeId: string): Promise<KnowledgeResponse | null> {
  return knowledgeStorage.get(knowledgeId) || null;
}

async function setKnowledge(knowledgeId: string, knowledge: KnowledgeResponse): Promise<void> {
  knowledgeStorage.set(knowledgeId, knowledge);
}

async function deleteKnowledge(knowledgeId: string): Promise<void> {
  knowledgeStorage.delete(knowledgeId);
}

async function listKnowledge(userId?: string): Promise<KnowledgeResponse[]> {
  const items = Array.from(knowledgeStorage.values());
  return userId ? items.filter((item) => item.userId === userId) : items;
}

export class KnowledgeManager {
  private static instance: KnowledgeManager;

  static getInstance(): KnowledgeManager {
    if (!KnowledgeManager.instance) {
      KnowledgeManager.instance = new KnowledgeManager();
    }
    return KnowledgeManager.instance;
  }

  async create(
    type: "file" | "url" | "knowledge",
    title: string,
    content?: string,
    url?: string,
    userId?: string,
    fileMeta?: {
      name: string;
      size: number;
      type: string;
      lastModified: number;
    }
  ): Promise<KnowledgeResponse> {
    const now = new Date();
    const knowledge: KnowledgeResponse = {
      id: nanoid(),
      title,
      type,
      size: content?.length || fileMeta?.size || 0,
      status: "processing",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      userId,
      url,
      fileMeta,
    };

    await setKnowledge(knowledge.id, knowledge);

    // Simulate processing
    setTimeout(async () => {
      await this.update(knowledge.id, { status: "completed" });
    }, 1000);

    return knowledge;
  }

  async get(knowledgeId: string): Promise<KnowledgeResponse | null> {
    return await getKnowledge(knowledgeId);
  }

  async update(
    knowledgeId: string,
    updates: Partial<Omit<KnowledgeResponse, "id" | "createdAt">>
  ): Promise<KnowledgeResponse | null> {
    const knowledge = await getKnowledge(knowledgeId);
    if (!knowledge) return null;

    const updatedKnowledge: KnowledgeResponse = {
      ...knowledge,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await setKnowledge(knowledgeId, updatedKnowledge);
    return updatedKnowledge;
  }

  async delete(knowledgeId: string): Promise<boolean> {
    const knowledge = await getKnowledge(knowledgeId);
    if (!knowledge) return false;

    await deleteKnowledge(knowledgeId);
    return true;
  }

  async list(userId?: string): Promise<KnowledgeResponse[]> {
    return await listKnowledge(userId);
  }

  async validateOwnership(
    knowledgeId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    const knowledge = await getKnowledge(knowledgeId);
    if (!knowledge) return false;

    return knowledge.userId === userId;
  }

  async processFile(file: File, userId?: string): Promise<KnowledgeResponse> {
    // For now, just store the file metadata
    // In a real implementation, you'd process the file content
    const content = await file.text();

    return await this.create("file", file.name, content, undefined, userId, {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });
  }

  async processUrl(url: string, title?: string, userId?: string): Promise<KnowledgeResponse> {
    // In a real implementation, you'd crawl the URL content
    return await this.create("url", title || url, undefined, url, userId);
  }

  async processText(text: string, title: string, userId?: string): Promise<KnowledgeResponse> {
    return await this.create("knowledge", title, text, undefined, userId);
  }
}
