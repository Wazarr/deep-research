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
      return withRateLimit(req, "sessions:results", async (authReq: AuthenticatedRequest) => {
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

          const results = {
            sessionId,
            phase: session.phase,
            topic: session.topic,
            questions: session.questions,
            feedback: session.feedback,
            reportPlan: session.reportPlan,
            tasks: session.tasks,
            results: session.results,
            finalReport: session.finalReport,
            error: session.error,
            progress: {
              hasQuestions: !!session.questions,
              hasFeedback: !!session.feedback,
              hasPlan: !!session.reportPlan,
              hasResults: !!session.results,
              isCompleted: session.phase === "completed",
              isError: session.phase === "error",
            },
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          };

          return createSuccessResponse(results);
        } catch (err) {
          console.error("Results retrieval error:", err);
          return createErrorResponse("Failed to retrieve results", 500);
        }
      });
    })
  );
}
