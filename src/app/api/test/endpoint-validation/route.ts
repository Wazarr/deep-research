import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { SessionManager } from "@/utils/api/session-manager";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create session manager instance for this test
    const sessionManager = new SessionManager();

    const testResults = [];

    // Test 1: Create session
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
    testResults.push({ test: "Create session", status: "✅ PASS", sessionId: session.id });

    // Test 2: Retrieve session (should work since same instance)
    const retrievedSession = await sessionManager.get(session.id);
    testResults.push({
      test: "Retrieve session",
      status: retrievedSession ? "✅ PASS" : "❌ FAIL",
      found: !!retrievedSession,
    });

    // Test 3: Update session (simulate questions phase)
    const updatedSession = await sessionManager.update(session.id, {
      phase: "questions",
      topic: "Planning a romantic weekend trip to Paris",
      questions:
        "1. What's your budget range?\n2. Do you prefer luxury or boutique hotels?\n3. Are you interested in museums or outdoor activities?",
    });
    testResults.push({
      test: "Update session to questions phase",
      status: updatedSession ? "✅ PASS" : "❌ FAIL",
      phase: updatedSession?.phase,
    });

    // Test 4: Update session (simulate feedback phase)
    const feedbackSession = await sessionManager.update(session.id, {
      phase: "feedback",
      feedback:
        "Budget €1000-1500, prefer boutique hotels, interested in romantic restaurants and Seine river activities",
    });
    testResults.push({
      test: "Update session to feedback phase",
      status: feedbackSession ? "✅ PASS" : "❌ FAIL",
      phase: feedbackSession?.phase,
    });

    // Test 5: Update session (simulate planning phase)
    const planningSession = await sessionManager.update(session.id, {
      phase: "planning",
      reportPlan:
        "# Paris Romantic Weekend Guide\n\n## 1. Accommodation Research\n## 2. Dining Experiences\n## 3. Romantic Activities\n## 4. Transportation Tips",
      tasks: [
        {
          query: "best boutique hotels Paris romantic weekend 2024",
          researchGoal: "Unique romantic accommodations under €300/night",
        },
        {
          query: "romantic restaurants Paris Seine river views",
          researchGoal: "Fine dining with romantic atmosphere",
        },
        {
          query: "romantic activities Paris couples weekend hidden gems",
          researchGoal: "Unique experiences beyond typical tourist spots",
        },
      ],
    });
    testResults.push({
      test: "Update session to planning phase",
      status: planningSession ? "✅ PASS" : "❌ FAIL",
      phase: planningSession?.phase,
      tasksCount: planningSession?.tasks?.length,
    });

    // Test 6: Validate ownership
    const hasAccess = await sessionManager.validateOwnership(session.id, auth.userId);
    testResults.push({
      test: "Validate session ownership",
      status: hasAccess ? "✅ PASS" : "❌ FAIL",
      hasAccess,
    });

    // Test 7: List sessions
    const sessions = await sessionManager.list(auth.userId);
    testResults.push({
      test: "List user sessions",
      status: sessions.length > 0 ? "✅ PASS" : "❌ FAIL",
      sessionsCount: sessions.length,
    });

    // Test 8: Complete session (simulate final phase)
    const completedSession = await sessionManager.update(session.id, {
      phase: "completed",
      finalReport:
        "# Your Perfect Romantic Paris Weekend\n\n*This would contain the complete research report...*",
    });
    testResults.push({
      test: "Update session to completed phase",
      status: completedSession ? "✅ PASS" : "❌ FAIL",
      phase: completedSession?.phase,
    });

    // Test 9: Delete session
    const deleted = await sessionManager.delete(session.id);
    testResults.push({
      test: "Delete session",
      status: deleted ? "✅ PASS" : "❌ FAIL",
      deleted,
    });

    const passedTests = testResults.filter((t) => t.status.includes("✅")).length;
    const totalTests = testResults.length;

    return NextResponse.json({
      success: true,
      data: {
        message: `API Endpoint Validation Complete: ${passedTests}/${totalTests} tests passed`,
        testResults,
        sessionFlow: {
          topic: "Planning a romantic weekend trip to Paris",
          phases: ["topic", "questions", "feedback", "planning", "executing", "completed"],
          apiEndpoints: [
            "POST /api/research/sessions",
            "GET /api/research/sessions",
            "GET /api/research/sessions/{id}",
            "POST /api/research/sessions/{id}/questions",
            "POST /api/research/sessions/{id}/feedback",
            "POST /api/research/sessions/{id}/plan",
            "POST /api/research/sessions/{id}/execute",
            "GET /api/research/sessions/{id}/stream",
            "DELETE /api/research/sessions/{id}",
          ],
        },
      },
    });
  } catch (err) {
    console.error("Endpoint validation test error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
