import { nanoid } from "nanoid";
import type { NextRequest } from "next/server";

export interface AuthContext {
  userId?: string;
  apiKey?: string;
  isAuthenticated: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  limit: number;
}

class InMemoryRateLimiter {
  private limits = new Map<string, { count: number; resetTime: number }>();

  check(key: string, limit = 100, windowMs = 3600000): RateLimitInfo {
    const now = Date.now();
    const current = this.limits.get(key);

    if (!current || now > current.resetTime) {
      const resetTime = now + windowMs;
      this.limits.set(key, { count: 1, resetTime });
      return { remaining: limit - 1, resetTime, limit };
    }

    if (current.count >= limit) {
      return { remaining: 0, resetTime: current.resetTime, limit };
    }

    current.count++;
    this.limits.set(key, current);
    return { remaining: limit - current.count, resetTime: current.resetTime, limit };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.limits.entries()) {
      if (now > value.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

export class RateLimiter {
  private limiter: InMemoryRateLimiter;

  constructor() {
    // For edge runtime, always use in-memory limiter
    this.limiter = new InMemoryRateLimiter();
  }

  async check(key: string, limit = 100, windowMs = 3600000): Promise<RateLimitInfo> {
    return this.limiter.check(key, limit, windowMs);
  }

  cleanup() {
    this.limiter.cleanup();
  }
}

export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return request.headers.get("X-API-Key") || null;
}

export function generateApiKey(): string {
  return `dr_${nanoid(32)}`;
}

export async function authenticateRequest(request: NextRequest): Promise<AuthContext> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return { isAuthenticated: false };
  }

  if (apiKey.startsWith("dr_") && apiKey.length === 35) {
    return {
      userId: apiKey,
      apiKey,
      isAuthenticated: true,
    };
  }

  return { isAuthenticated: false };
}

export async function checkRateLimit(
  rateLimiter: RateLimiter,
  userId: string,
  endpoint: string
): Promise<RateLimitInfo> {
  const key = `${userId}:${endpoint}`;

  const limits: Record<string, { limit: number; windowMs: number }> = {
    "sessions:create": { limit: 10, windowMs: 3600000 }, // 10 sessions per hour
    "sessions:get": { limit: 1000, windowMs: 3600000 }, // 1000 gets per hour
    "sessions:execute": { limit: 50, windowMs: 3600000 }, // 50 executions per hour
    default: { limit: 100, windowMs: 3600000 }, // 100 requests per hour default
  };

  const config = limits[endpoint] || limits.default;
  return await rateLimiter.check(key, config.limit, config.windowMs);
}
