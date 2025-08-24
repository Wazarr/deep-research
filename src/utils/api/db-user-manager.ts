import { eq } from "drizzle-orm";
import { db, type NewUser, users } from "../../db";
import { generateApiKey } from "./auth";
import type { AuthResponse, UserProfile, UserSettings } from "./types";

// Default user settings
const defaultSettings: UserSettings = {
  provider: "openai",
  thinkingModel: "gpt-4",
  taskModel: "gpt-4",
  searchProvider: "tavily",
  theme: "light",
  language: "en",
  enableSearch: true,
  searchMaxResult: 10,
  parallelSearch: 3,
  enableCitationImage: true,
  enableReferences: true,
  maxSessionDuration: 3600,
  defaultExpirationTime: 3600,
};

export class DatabaseUserManager {
  private static instance: DatabaseUserManager;

  static getInstance(): DatabaseUserManager {
    if (!DatabaseUserManager.instance) {
      DatabaseUserManager.instance = new DatabaseUserManager();
    }
    return DatabaseUserManager.instance;
  }

  async register(email?: string, settings?: Partial<UserSettings>): Promise<AuthResponse> {
    const userId = generateApiKey();
    const now = new Date().toISOString();

    const newUser: NewUser = {
      id: userId,
      email,
      settings: JSON.stringify({ ...defaultSettings, ...settings }),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

    return {
      userId,
      apiKey: userId,
      expiresAt,
    };
  }

  async get(userId: string): Promise<UserProfile | null> {
    try {
      const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (result.length === 0) {
        return null;
      }

      const user = result[0];
      return {
        userId: user.id,
        email: user.email || undefined,
        settings: user.settings ? JSON.parse(user.settings as string) : defaultSettings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  async list(): Promise<UserProfile[]> {
    try {
      const result = await db.select().from(users);

      return result.map(
        (user): UserProfile => ({
          userId: user.id,
          email: user.email || undefined,
          settings: user.settings ? JSON.parse(user.settings as string) : defaultSettings,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error listing users:", error);
      return [];
    }
  }

  async updateSettings(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<UserProfile | null> {
    try {
      const user = await this.get(userId);
      if (!user) return null;

      const updatedSettings = { ...(user.settings || defaultSettings), ...settings };
      const now = new Date().toISOString();

      await db
        .update(users)
        .set({
          settings: JSON.stringify(updatedSettings),
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      return {
        ...user,
        settings: updatedSettings,
        updatedAt: now,
      };
    } catch (error) {
      console.error("Error updating user settings:", error);
      return null;
    }
  }

  async delete(userId: string): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, userId));
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async refreshToken(userId: string): Promise<AuthResponse | null> {
    try {
      const user = await this.get(userId);
      if (!user) return null;

      // Generate new API key
      const newApiKey = generateApiKey();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

      // Update user with new API key (which serves as userId)
      await db
        .update(users)
        .set({
          id: newApiKey,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      return {
        userId: newApiKey,
        apiKey: newApiKey,
        expiresAt,
      };
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  }

  // Cleanup expired users (optional - for maintenance)
  async cleanup(): Promise<number> {
    try {
      // This is a placeholder - we don't have expiration logic for users yet
      // but we could add it based on last activity or explicit expiration
      return 0;
    } catch (error) {
      console.error("Error during user cleanup:", error);
      return 0;
    }
  }
}
