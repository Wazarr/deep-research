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
import { PlanRequestSchema } from "@/utils/api/types";
import {
  createErrorResponse,
  createSuccessResponse,
  validateRequestBody,
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
      return withRateLimit(req, "sessions:plan", async (authReq: AuthenticatedRequest) => {
        const { sessionId } = await params;

        if (!validateSessionId(sessionId)) {
          return createErrorResponse("Invalid session ID", 400);
        }

        const { data, error } = await validateRequestBody(authReq, PlanRequestSchema);
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

          if (!["questions", "feedback"].includes(session.phase)) {
            return createErrorResponse("Session is not in a valid phase for planning", 400);
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

          const finalTopic = data.feedback
            ? `${data.topic}\n\nRefinements: ${data.feedback}`
            : data.topic;

          const reportPlan = await deepResearch.writeReportPlan(finalTopic);
          const tasks = await deepResearch.generateSERPQuery(reportPlan);

          return createSuccessResponse({
            reportPlan,
            tasks,
            sessionId,
            phase: "planning",
          });
        } catch (err) {
          console.error("Plan generation error:", err);
          await sessionManager.update(sessionId, {
            phase: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
          return createErrorResponse("Failed to generate plan", 500);
        }
      });
    })
  );
}
