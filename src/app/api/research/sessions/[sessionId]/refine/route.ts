import type { NextRequest } from "next/server";
import {
  type AuthenticatedRequest,
  handleOptions,
  withAuth,
  withCORS,
  withRateLimit,
} from "@/utils/api/middleware";
import { RefineRequestSchema } from "@/utils/api/types";
import {
  createErrorResponse,
  createSuccessResponse,
  validateRequestBody,
  validateSessionId,
} from "@/utils/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withCORS(
    await withAuth(request, async (req: AuthenticatedRequest) => {
      return withRateLimit(req, "sessions:refine", async (authReq: AuthenticatedRequest) => {
        const { sessionId } = await params;

        if (!validateSessionId(sessionId)) {
          return createErrorResponse("Invalid session ID", 400);
        }

        const { data, error } = await validateRequestBody(authReq, RefineRequestSchema);
        if (error) return error;

        try {
          const session = await sessionManager.get(sessionId);
          if (!session) {
            return createErrorResponse("Session not found", 404);
          }

          const hasAccess = await sessionManager.validateOwnership(sessionId, authReq.auth.userId);
          if (!hasAccess) {
            return createErrorResponse("Access denied", 403);
          }

          if (session.phase === "completed" || session.phase === "error") {
            return createErrorResponse("Cannot refine completed or error sessions", 400);
          }

          const updates: any = {
            phase: data.phase,
          };

          switch (data.phase) {
            case "questions":
              updates.questions = data.refinement;
              break;
            case "feedback":
              updates.feedback = data.refinement;
              break;
            case "planning":
              updates.reportPlan = data.refinement;
              break;
            case "executing":
              return createErrorResponse("Cannot refine during execution phase", 400);
          }

          const updatedSession = await sessionManager.update(sessionId, updates);
          if (!updatedSession) {
            return createErrorResponse("Failed to update session", 500);
          }

          return createSuccessResponse({
            sessionId,
            phase: updatedSession.phase,
            message: "Session refined successfully",
          });
        } catch (err) {
          console.error("Session refinement error:", err);
          return createErrorResponse("Failed to refine session", 500);
        }
      });
    })
  );
}
