import type { NextRequest } from "next/server";
import {
  type AuthenticatedRequest,
  handleOptions,
  withAuth,
  withCORS,
  withRateLimit,
} from "@/utils/api/middleware";
import { SessionManager } from "@/utils/api/session-manager";
import {
  createErrorResponse,
  createSuccessResponse,
  sanitizeSessionForResponse,
  validateSessionId,
} from "@/utils/api/validation";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const sessionManager = SessionManager.getInstance();

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withCORS(
    await withAuth(request, async (req: AuthenticatedRequest) => {
      return withRateLimit(req, "sessions:get", async (authReq: AuthenticatedRequest) => {
        const { sessionId } = await params;

        if (!validateSessionId(sessionId)) {
          return createErrorResponse("Invalid session ID", 400);
        }

        try {
          const session = await sessionManager.get(sessionId);
          if (!session) {
            return createErrorResponse("Session not found", 404);
          }

          const hasAccess = await sessionManager.validateOwnership(sessionId, authReq.auth.userId);
          if (!hasAccess) {
            return createErrorResponse("Access denied", 403);
          }

          return createSuccessResponse(sanitizeSessionForResponse(session));
        } catch (err) {
          console.error("Session get error:", err);
          return createErrorResponse("Failed to retrieve session", 500);
        }
      });
    })
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withCORS(
    await withAuth(request, async (req: AuthenticatedRequest) => {
      return withRateLimit(req, "sessions:delete", async (authReq: AuthenticatedRequest) => {
        const { sessionId } = await params;

        if (!validateSessionId(sessionId)) {
          return createErrorResponse("Invalid session ID", 400);
        }

        try {
          const session = await sessionManager.get(sessionId);
          if (!session) {
            return createErrorResponse("Session not found", 404);
          }

          const hasAccess = await sessionManager.validateOwnership(sessionId, authReq.auth.userId);
          if (!hasAccess) {
            return createErrorResponse("Access denied", 403);
          }

          const deleted = await sessionManager.delete(sessionId);
          if (!deleted) {
            return createErrorResponse("Failed to delete session", 500);
          }

          return createSuccessResponse(null, "Session deleted successfully");
        } catch (err) {
          console.error("Session delete error:", err);
          return createErrorResponse("Failed to delete session", 500);
        }
      });
    })
  );
}
