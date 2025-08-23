import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getAIProviderApiKey,
  getAIProviderBaseURL,
  getSearchProviderApiKey,
  getSearchProviderBaseURL,
} from "@/app/api/utils";
import { APIDeepResearch } from "@/utils/api/api-deep-research";
import { authenticateRequest } from "@/utils/api/auth";
import { SessionManager } from "@/utils/api/session-manager";
import { multiApiKeyPolling } from "@/utils/model";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return new NextResponse("Authentication required", { status: 401 });
    }

    // Create session manager instance for this test
    const sessionManager = new SessionManager();

    // Create a session with Google AI models
    const session = await sessionManager.create(
      {
        provider: "google",
        thinkingModel: "gemini-1.5-pro-latest",
        taskModel: "gemini-1.5-flash-latest",
        searchProvider: "tavily",
        language: "en",
        maxResults: 10,
        enableReferences: true,
        enableCitationImage: true,
      },
      3600,
      auth.userId
    );

    console.log("Test: Created session:", session.id);

    // Get API keys
    const { settings } = session;
    const aiApiKey = multiApiKeyPolling(getAIProviderApiKey(settings.provider));
    const searchApiKey = multiApiKeyPolling(getSearchProviderApiKey(settings.searchProvider));

    // Create APIDeepResearch instance
    const deepResearch = new APIDeepResearch(
      {
        language: settings.language,
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
          maxResult: settings.maxResults,
        },
      },
      sessionManager,
      session.id
    );

    // Test the complete flow
    console.log("Test: Starting Paris research flow");

    // 1. Generate questions for Paris romantic weekend
    const questions = await deepResearch.askQuestions("Planning a romantic weekend trip to Paris");
    console.log("Test: Generated questions");

    // 2. Process feedback
    const topic = "Planning a romantic weekend trip to Paris";
    const feedback =
      "Focus on unique romantic experiences, boutique hotels, and local hidden gems. Budget around €1000-1500 for the weekend.";
    await deepResearch.processFeedback(topic, questions, feedback);
    console.log("Test: Processed feedback");

    // 3. Generate report plan
    const reportPlan = await deepResearch.writeReportPlan(
      "Planning a romantic weekend trip to Paris"
    );
    console.log("Test: Generated report plan");

    // 4. Get updated session to see tasks
    const updatedSession = await sessionManager.get(session.id);
    if (!updatedSession || !updatedSession.tasks) {
      throw new Error("Failed to generate tasks");
    }

    // 5. Execute research
    console.log("Test: Executing research tasks");
    const results = await deepResearch.runSearchTask(
      updatedSession.tasks,
      settings.enableReferences ?? true
    );

    // 6. Generate final report
    console.log("Test: Generating final report");
    const finalReport = await deepResearch.writeFinalReport(
      reportPlan,
      results,
      settings.enableCitationImage ?? true,
      settings.enableReferences ?? true
    );

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        phase: "completed",
        questions,
        feedback,
        reportPlan,
        finalReport,
        resultsCount: results.length,
        message: "Paris romantic weekend research completed successfully!",
      },
    });
  } catch (err) {
    console.error("Paris research test error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
