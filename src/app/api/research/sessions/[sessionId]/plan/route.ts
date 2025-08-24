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
import { getSessionManager } from "@/utils/api/storage-factory";
import { PlanRequestSchema } from "@/utils/api/types";
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
      return withRateLimit(req, "sessions:plan", async (authReq: AuthenticatedRequest) => {
        const { sessionId } = await params;

        if (!validateSessionId(sessionId)) {
          return createErrorResponse("Invalid session ID", 400);
        }

        // Plan requests can be empty - we'll get data from the session
        const requestBody = await authReq.text();
        let data: any = {};

        if (requestBody) {
          try {
            const parsedBody = JSON.parse(requestBody);
            const validation = PlanRequestSchema.safeParse(parsedBody);
            if (!validation.success) {
              return createErrorResponse("Invalid request body", 400);
            }
            data = validation.data;
          } catch {
            return createErrorResponse("Invalid JSON in request body", 400);
          }
        }

        try {
          const sessionManager = getSessionManager();
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

          // Use session data if not provided in request
          const topic = data.topic || session.topic;
          const feedback = data.feedback || session.feedback;

          if (!topic) {
            return createErrorResponse("No topic available for planning", 400);
          }

          const finalTopic = feedback ? `${topic}\n\nRefinements: ${feedback}` : topic;

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
          const sessionManager = getSessionManager();
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
