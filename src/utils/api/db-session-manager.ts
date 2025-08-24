import { eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, type NewSession, type Session, sessions } from "../../db";
import type { ResearchSession, ResearchSettings } from "./types";

export class DatabaseSessionManager {
  private static instance: DatabaseSessionManager;

  static getInstance(): DatabaseSessionManager {
    if (!DatabaseSessionManager.instance) {
      DatabaseSessionManager.instance = new DatabaseSessionManager();
    }
    return DatabaseSessionManager.instance;
  }

  async create(
    settings: ResearchSettings,
    expiresIn: number = 3600,
    userId?: string
  ): Promise<ResearchSession> {
    const now = new Date();

    const sessionData: NewSession = {
      id: nanoid(),
      userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      phase: "topic",
      settings: JSON.stringify(settings),

      // Initialize enhanced fields
      resources: JSON.stringify([]),
      requirement: "",
      suggestion: "",
      knowledgeGraph: "",
      images: JSON.stringify([]),
      sources: JSON.stringify([]),
      title: "",
      query: "",
      version: 1,
      metadata: JSON.stringify({}),

      // Core fields initialized as null/empty
      topic: null,
      questions: null,
      feedback: null,
      reportPlan: null,
      tasks: JSON.stringify([]),
      results: JSON.stringify([]),
      finalReport: null,
      error: null,
    };

    await db.insert(sessions).values(sessionData);

    return this.convertDbSessionToResearchSession(sessionData);
  }

  async get(sessionId: string): Promise<ResearchSession | null> {
    try {
      const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

      if (result.length === 0) {
        return null;
      }

      const dbSession = result[0];

      // Check if session is expired
      if (new Date(dbSession.expiresAt) <= new Date()) {
        await this.delete(sessionId);
        return null;
      }

      return this.convertDbSessionToResearchSession(dbSession);
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  async update(
    sessionId: string,
    updates: Partial<Omit<ResearchSession, "id" | "createdAt">>
  ): Promise<ResearchSession | null> {
    try {
      const now = new Date().toISOString();

      // Convert ResearchSession updates to database format
      const dbUpdates: Partial<Session> = {
        updatedAt: now,
      };

      // Map fields from ResearchSession to database schema
      if (updates.userId !== undefined) dbUpdates.userId = updates.userId;
      if (updates.expiresAt !== undefined) dbUpdates.expiresAt = updates.expiresAt.toISOString();
      if (updates.phase !== undefined) dbUpdates.phase = updates.phase;
      if (updates.topic !== undefined) dbUpdates.topic = updates.topic;
      if (updates.questions !== undefined) dbUpdates.questions = updates.questions;
      if (updates.feedback !== undefined) dbUpdates.feedback = updates.feedback;
      if (updates.reportPlan !== undefined) dbUpdates.reportPlan = updates.reportPlan;
      if (updates.finalReport !== undefined) dbUpdates.finalReport = updates.finalReport;
      if (updates.error !== undefined) dbUpdates.error = updates.error;

      // JSON fields
      if (updates.settings !== undefined) dbUpdates.settings = JSON.stringify(updates.settings);
      if (updates.tasks !== undefined) dbUpdates.tasks = JSON.stringify(updates.tasks);
      if (updates.results !== undefined) dbUpdates.results = JSON.stringify(updates.results);
      if (updates.resources !== undefined) dbUpdates.resources = JSON.stringify(updates.resources);
      if (updates.images !== undefined) dbUpdates.images = JSON.stringify(updates.images);
      if (updates.sources !== undefined) dbUpdates.sources = JSON.stringify(updates.sources);
      if (updates.metadata !== undefined) dbUpdates.metadata = JSON.stringify(updates.metadata);

      // String fields
      if (updates.requirement !== undefined) dbUpdates.requirement = updates.requirement;
      if (updates.suggestion !== undefined) dbUpdates.suggestion = updates.suggestion;
      if (updates.knowledgeGraph !== undefined) dbUpdates.knowledgeGraph = updates.knowledgeGraph;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.query !== undefined) dbUpdates.query = updates.query;
      if (updates.version !== undefined) dbUpdates.version = updates.version;

      await db.update(sessions).set(dbUpdates).where(eq(sessions.id, sessionId));

      return await this.get(sessionId);
    } catch (error) {
      console.error("Error updating session:", error);
      return null;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      const result = await db.delete(sessions).where(eq(sessions.id, sessionId));
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  async list(
    userId?: string
  ): Promise<Pick<ResearchSession, "id" | "createdAt" | "updatedAt" | "phase" | "topic">[]> {
    try {
      const result = userId
        ? await db
            .select({
              id: sessions.id,
              createdAt: sessions.createdAt,
              updatedAt: sessions.updatedAt,
              phase: sessions.phase,
              topic: sessions.topic,
            })
            .from(sessions)
            .where(eq(sessions.userId, userId))
        : await db
            .select({
              id: sessions.id,
              createdAt: sessions.createdAt,
              updatedAt: sessions.updatedAt,
              phase: sessions.phase,
              topic: sessions.topic,
            })
            .from(sessions);

      return result.map((session) => ({
        id: session.id,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        phase: session.phase as ResearchSession["phase"],
        topic: session.topic || undefined,
      }));
    } catch (error) {
      console.error("Error listing sessions:", error);
      return [];
    }
  }

  async cleanup(): Promise<number> {
    try {
      const result = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date().toISOString()));

      return result.changes;
    } catch (error) {
      console.error("Error during session cleanup:", error);
      return 0;
    }
  }

  async validateOwnership(
    sessionId: string,
    userId: string | undefined = undefined
  ): Promise<boolean> {
    try {
      const session = await this.get(sessionId);
      if (!session) return false;
      return session.userId === userId;
    } catch (error) {
      console.error("Error validating session ownership:", error);
      return false;
    }
  }

  async extendExpiration(
    sessionId: string,
    additionalSeconds = 3600
  ): Promise<ResearchSession | null> {
    try {
      const session = await this.get(sessionId);
      if (!session) return null;

      const newExpiresAt = new Date(session.expiresAt.getTime() + additionalSeconds * 1000);
      return await this.update(sessionId, { expiresAt: newExpiresAt });
    } catch (error) {
      console.error("Error extending session expiration:", error);
      return null;
    }
  }

  // Helper method to convert database session to ResearchSession
  private convertDbSessionToResearchSession(dbSession: Session | NewSession): ResearchSession {
    return {
      id: dbSession.id,
      userId: dbSession.userId || undefined,
      createdAt: new Date(dbSession.createdAt || new Date().toISOString()),
      updatedAt: new Date(dbSession.updatedAt || new Date().toISOString()),
      expiresAt: new Date(dbSession.expiresAt || new Date().toISOString()),
      phase: dbSession.phase as ResearchSession["phase"],

      // Core session data
      topic: dbSession.topic || undefined,
      questions: dbSession.questions || undefined,
      feedback: dbSession.feedback || undefined,
      reportPlan: dbSession.reportPlan || undefined,
      finalReport: dbSession.finalReport || undefined,
      error: dbSession.error || undefined,

      // JSON fields - parse with fallbacks
      settings: JSON.parse((dbSession.settings as string) || "{}"),
      tasks: JSON.parse((dbSession.tasks as string) || "[]"),
      results: JSON.parse((dbSession.results as string) || "[]"),
      resources: JSON.parse((dbSession.resources as string) || "[]"),
      images: JSON.parse((dbSession.images as string) || "[]"),
      sources: JSON.parse((dbSession.sources as string) || "[]"),
      metadata: JSON.parse((dbSession.metadata as string) || "{}"),

      // Enhanced fields
      requirement: (dbSession.requirement as string) || "",
      suggestion: (dbSession.suggestion as string) || "",
      knowledgeGraph: (dbSession.knowledgeGraph as string) || "",
      title: (dbSession.title as string) || "",
      query: (dbSession.query as string) || "",
      version: (dbSession.version as number) || 1,
    };
  }
}
