import type { NextRequest } from "next/server";
import {
  getAIProviderApiKey,
  getAIProviderBaseURL,
  getSearchProviderApiKey,
  getSearchProviderBaseURL,
} from "@/app/api/utils";
import { APIDeepResearch } from "@/utils/api/api-deep-research";
import {
  type AuthenticatedRequest,
  handleOptions,
  withAuth,
  withCORS,
  withRateLimit,
} from "@/utils/api/middleware";
import {
  createErrorResponse,
  createSuccessResponse,
  validateSessionId,
} from "@/utils/api/validation";
import { multiApiKeyPolling } from "@/utils/model";

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
      return withRateLimit(req, "sessions:execute", async (authReq: AuthenticatedRequest) => {
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

          if (session.phase !== "planning") {
            return createErrorResponse("Session is not in planning phase", 400);
          }

          if (!session.reportPlan || !session.tasks) {
            return createErrorResponse("Session missing report plan or tasks", 400);
          }

          const { settings } = session;
          const aiApiKey = multiApiKeyPolling(getAIProviderApiKey(settings.provider));
          const searchApiKey = multiApiKeyPolling(getSearchProviderApiKey(settings.searchProvider));

          const deepResearch = new APIDeepResearch(
            {
              ...(settings.language && { language: settings.language }),
              AIProvider: {
                baseURL: getAIProviderBaseURL(settings.provider),
                ...(aiApiKey && { apiKey: aiApiKey }),
                provider: settings.provider,
                thinkingModel: settings.thinkingModel,
                taskModel: settings.taskModel,
              },
              searchProvider: {
                baseURL: getSearchProviderBaseURL(settings.searchProvider),
                ...(searchApiKey && { apiKey: searchApiKey }),
                provider: settings.searchProvider,
                ...(settings.maxResults && { maxResult: settings.maxResults }),
              },
            },
            sessionManager,
            sessionId
          );

          const results = await deepResearch.runSearchTask(
            session.tasks,
            settings.enableReferences ?? true
          );

          const finalReport = await deepResearch.writeFinalReport(
            session.reportPlan,
            results,
            settings.enableCitationImage ?? true,
            settings.enableReferences ?? true
          );

          return createSuccessResponse({
            finalReport,
            results,
            sessionId,
            phase: "completed",
          });
        } catch (err) {
          console.error("Research execution error:", err);
          await sessionManager.update(sessionId, {
            phase: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
          return createErrorResponse("Failed to execute research", 500);
        }
      });
    })
  );
}
