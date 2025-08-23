import type { NextRequest } from "next/server";
import {
  type AuthenticatedRequest,
  handleOptions,
  withAuth,
  withCORS,
  withRateLimit,
} from "@/utils/api/middleware";
import { SessionManager } from "@/utils/api/session-manager";
import { CreateSessionSchema, type SessionListResponse } from "@/utils/api/types";
import {
  createErrorResponse,
  createSuccessResponse,
  sanitizeSessionForResponse,
  validateRequestBody,
} from "@/utils/api/validation";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const sessionManager = SessionManager.getInstance();

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  return withCORS(
    await withAuth(request, async (req: AuthenticatedRequest) => {
      return withRateLimit(req, "sessions:create", async (authReq: AuthenticatedRequest) => {
        const { data, error } = await validateRequestBody(authReq, CreateSessionSchema);
        if (error) return error;

        try {
          const session = await sessionManager.create(
            data.settings,
            data.expiresIn || 3600,
            authReq.auth.userId
          );

          return createSuccessResponse(
            sanitizeSessionForResponse(session),
            "Session created successfully",
            201
          );
        } catch (err) {
          console.error("Session creation error:", err);
          return createErrorResponse("Failed to create session", 500);
        }
      });
    })
  );
}

export async function GET(request: NextRequest) {
  return withCORS(
    await withAuth(request, async (req: AuthenticatedRequest) => {
      return withRateLimit(req, "sessions:get", async (authReq: AuthenticatedRequest) => {
        try {
          const sessions = await sessionManager.list(authReq.auth.userId);

          const response: SessionListResponse = {
            sessions: sessions.map((session) => ({
              id: session.id,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
              phase: session.phase,
              topic: session.topic,
            })),
            total: sessions.length,
          };

          return createSuccessResponse(response);
        } catch (err) {
          console.error("Session list error:", err);
          return createErrorResponse("Failed to retrieve sessions", 500);
        }
      });
    })
  );
}
