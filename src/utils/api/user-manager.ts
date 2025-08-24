import { generateApiKey } from "./auth";
import type { AuthResponse, UserProfile, UserSettings } from "./types";

// Global storage that persists across Edge Runtime requests
// Using globalThis to ensure persistence across Edge Runtime requests
if (!(globalThis as any).__userStorage) {
  (globalThis as any).__userStorage = new Map<string, UserProfile>();
}
const userStorage = (globalThis as any).__userStorage as Map<string, UserProfile>;

// Direct functions using module-level storage
async function getUser(userId: string): Promise<UserProfile | null> {
  return userStorage.get(userId) || null;
}

async function setUser(userId: string, user: UserProfile): Promise<void> {
  userStorage.set(userId, user);
}

async function deleteUser(userId: string): Promise<void> {
  userStorage.delete(userId);
}

async function findUserByEmail(email: string): Promise<UserProfile | null> {
  for (const user of userStorage.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return null;
}

async function listUsers(): Promise<UserProfile[]> {
  return Array.from(userStorage.values());
}

export class UserManager {
  private static instance: UserManager;

  static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  private getDefaultSettings(): UserSettings {
    return {
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
  }

  async register(email?: string, settings?: Partial<UserSettings>): Promise<AuthResponse> {
    // Check if user with email already exists
    if (email) {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        throw new Error("User with this email already exists");
      }
    }

    const userId = generateApiKey(); // Use API key as user ID for simplicity
    const now = new Date();

    const userProfile: UserProfile = {
      userId,
      email,
      settings: { ...this.getDefaultSettings(), ...settings },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await setUser(userId, userProfile);

    // API key expires in 1 year
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return {
      userId,
      apiKey: userId, // API key is the same as user ID
      expiresAt: expiresAt.toISOString(),
    };
  }

  async get(userId: string): Promise<UserProfile | null> {
    return await getUser(userId);
  }

  async updateSettings(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<UserProfile | null> {
    const user = await getUser(userId);
    if (!user) return null;

    const updatedUser: UserProfile = {
      ...user,
      settings: { ...(user.settings || {}), ...settings } as UserSettings,
      updatedAt: new Date().toISOString(),
    };

    await setUser(userId, updatedUser);
    return updatedUser;
  }

  async delete(userId: string): Promise<boolean> {
    const user = await getUser(userId);
    if (!user) return false;

    await deleteUser(userId);
    return true;
  }

  async refreshToken(userId: string): Promise<AuthResponse | null> {
    const user = await getUser(userId);
    if (!user) return null;

    // For simplicity, we're not actually refreshing the token
    // In a real implementation, you'd generate a new token
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return {
      userId,
      apiKey: userId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async validateUser(userId: string): Promise<boolean> {
    const user = await getUser(userId);
    return !!user;
  }

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const user = await getUser(userId);
    return user?.settings || null;
  }

  async list(): Promise<UserProfile[]> {
    return await listUsers();
  }
}
