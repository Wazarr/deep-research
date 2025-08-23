import { nanoid } from "nanoid";
import type { ResearchSession, ResearchSettings } from "./types";

interface SessionStore {
  get(sessionId: string): Promise<ResearchSession | null>;
  set(sessionId: string, session: ResearchSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
  list(userId?: string): Promise<ResearchSession[]>;
  cleanup(): Promise<number>;
}

class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, ResearchSession>();

  async get(sessionId: string): Promise<ResearchSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async set(sessionId: string, session: ResearchSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(userId?: string): Promise<ResearchSession[]> {
    const sessions = Array.from(this.sessions.values());
    return sessions.filter((session) => {
      if (session.expiresAt < new Date()) {
        this.sessions.delete(session.id);
        return false;
      }
      return userId ? session.userId === userId : true;
    });
  }

  async cleanup(): Promise<number> {
    let cleaned = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < new Date()) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export class SessionManager {
  private store: SessionStore;
  private static instance: SessionManager;

  constructor() {
    // For edge runtime, always use in-memory store
    this.store = new InMemorySessionStore();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async create(
    settings: ResearchSettings,
    expiresIn = 3600,
    userId?: string
  ): Promise<ResearchSession> {
    const now = new Date();
    const session: ResearchSession = {
      id: nanoid(),
      userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
      phase: "topic",
      settings,
    };

    await this.store.set(session.id, session);
    return session;
  }

  async get(sessionId: string): Promise<ResearchSession | null> {
    return await this.store.get(sessionId);
  }

  async update(
    sessionId: string,
    updates: Partial<Omit<ResearchSession, "id" | "createdAt">>
  ): Promise<ResearchSession | null> {
    const session = await this.store.get(sessionId);
    if (!session) return null;

    const updatedSession: ResearchSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    await this.store.set(sessionId, updatedSession);
    return updatedSession;
  }

  async delete(sessionId: string): Promise<boolean> {
    const session = await this.store.get(sessionId);
    if (!session) return false;

    await this.store.delete(sessionId);
    return true;
  }

  async list(userId?: string): Promise<ResearchSession[]> {
    return await this.store.list(userId);
  }

  async cleanup(): Promise<number> {
    return await this.store.cleanup();
  }

  async validateOwnership(
    sessionId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    const session = await this.store.get(sessionId);
    if (!session) return false;

    return session.userId === userId;
  }

  async extendExpiration(
    sessionId: string,
    additionalSeconds = 3600
  ): Promise<ResearchSession | null> {
    const session = await this.store.get(sessionId);
    if (!session) return null;

    const newExpiresAt = new Date(session.expiresAt.getTime() + additionalSeconds * 1000);
    return await this.update(sessionId, { expiresAt: newExpiresAt });
  }
}
