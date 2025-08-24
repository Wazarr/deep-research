import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { SessionManager } from "@/utils/api/session-manager";

export const runtime = "nodejs";
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

    const sessionManager = new SessionManager();
    const testLog = [];

    // Step 1: Create Session
    testLog.push("🏁 Creating new research session...");
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
    testLog.push(`✅ Session created: ${session.id}`);

    // Step 2: Questions Phase - Mock AI Response
    testLog.push("❓ Moving to questions phase...");
    const questionsUpdate = await sessionManager.update(session.id, {
      phase: "questions",
      topic: "Planning a romantic weekend trip to Paris",
      questions: `What's your budget range for the weekend?
Are you interested in luxury hotels or charming boutique accommodations?
Do you prefer fine dining or discovering local bistros?
Are you interested in museums and cultural sites or outdoor romantic activities?
What time of year are you planning to visit?`,
    });
    testLog.push(
      `✅ Questions generated: ${questionsUpdate?.questions?.split("\n").length} questions`
    );

    // Step 3: Feedback Phase - Process User Input
    testLog.push("💭 Processing user feedback...");
    await sessionManager.update(session.id, {
      phase: "feedback",
      feedback:
        "Budget €1000-1500, prefer boutique hotels with character, mix of fine dining and local experiences, interested in romantic Seine activities and hidden neighborhood gems, planning for late spring (May)",
    });
    testLog.push(`✅ Feedback processed and stored`);

    // Step 4: Planning Phase - Mock Research Plan
    testLog.push("📋 Generating research plan...");
    const planUpdate = await sessionManager.update(session.id, {
      phase: "planning",
      reportPlan: `# Your Perfect Romantic Paris Weekend Guide

## 1. Boutique Accommodation Research
- Charming hotels in romantic neighborhoods (Le Marais, Saint-Germain)
- Budget: €200-300/night
- Character properties with unique features

## 2. Culinary Experience Planning  
- Mix of fine dining and authentic bistros
- Seine-side restaurants with romantic views
- Local food markets and hidden gems

## 3. Romantic Activities & Experiences
- Seine river activities (boat tours, riverside walks)
- Hidden neighborhood exploration (Montmartre, Île Saint-Louis)
- Unique romantic experiences beyond typical tourist spots

## 4. Practical May Travel Tips
- Weather considerations for late spring
- Local transportation and area recommendations
- Timing and reservation strategies`,
      tasks: [
        {
          query: "best boutique hotels Paris romantic weekend May 2024 budget 200-300 euro",
          researchGoal: "Charming accommodations in Le Marais and Saint-Germain neighborhoods",
        },
        {
          query: "romantic restaurants Paris Seine river view fine dining bistro recommendations",
          researchGoal: "Mix of upscale and authentic dining with romantic atmosphere",
        },
        {
          query: "romantic activities Paris couples hidden gems May spring weather",
          researchGoal: "Unique experiences beyond typical tourist attractions",
        },
        {
          query: "Paris May travel tips romantic weekend itinerary transportation",
          researchGoal: "Practical advice for late spring romantic getaway",
        },
      ],
    });
    testLog.push(`✅ Research plan created with ${planUpdate?.tasks?.length} search tasks`);

    // Step 5: Executing Phase - Mock Search Results
    testLog.push("🔍 Simulating research execution...");
    await sessionManager.update(session.id, {
      phase: "executing",
    });
    testLog.push(`✅ Research execution started`);

    // Step 6: Mock Final Results
    testLog.push("📝 Generating final report...");
    const finalUpdate = await sessionManager.update(session.id, {
      phase: "completed",
      finalReport: `# Your Perfect Romantic Paris Weekend 🗼💕

## 🏨 Boutique Accommodations

**Hotel des Grands Boulevards** (Le Marais)
- Charming 19th-century property with romantic courtyards
- €240/night, includes breakfast
- Walking distance to romantic Seine walks

**L'Hôtel Particulier Montmartre** 
- Hidden gem in secret Montmartre passage
- €280/night, garden suites available
- Perfect for intimate romantic escape

## 🍷 Romantic Dining Experiences

**Le Procope** (Saint-Germain)
- Historic bistro with intimate candlelit atmosphere
- Traditional French cuisine, budget €80-120 for two
- Reserve table by window for people-watching

**Sequana Restaurant** (Seine-side)
- Modern French with panoramic river views
- Perfect for sunset dinner, €150-200 for two
- Book 7pm slot for best light

## 💫 Unique Romantic Activities

**Seine Evening Boat Tour**
- Private 2-hour sunset cruise
- €150-200, includes champagne
- Best time: 7-9pm for magical light

**Marché des Enfants Rouges Food Tour**
- Oldest covered market in Paris
- Perfect for romantic morning exploration
- Sample local delicacies together

**Île Saint-Louis Secret Walk**
- Hidden romantic island in heart of Paris
- Free self-guided exploration
- Best for afternoon stroll with ice cream from Berthillon

## 🌸 May Travel Tips

**Weather**: Perfect spring weather (15-20°C), pack light jacket for evenings
**Transportation**: Walk when possible for romance, use Metro for longer distances
**Timing**: Book dinner reservations 1 week ahead, attractions less crowded weekday mornings

**Total Estimated Budget**: €1,200-1,400 for the weekend
**Best Romantic Moments**: Seine sunset, Montmartre morning coffee, late-night Saint-Germain walks

*Bon voyage! Your romantic Parisian adventure awaits.* ✨`,
    });
    testLog.push(`✅ Final report generated (${finalUpdate?.finalReport?.length} characters)`);

    // Final Session State
    const finalSession = await sessionManager.get(session.id);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        testLog,
        sessionFlow: {
          phases: ["topic", "questions", "feedback", "planning", "executing", "completed"],
          currentPhase: finalSession?.phase,
          topic: finalSession?.topic,
          questionsCount: finalSession?.questions?.split("\n").length,
          hasFeedback: !!finalSession?.feedback,
          hasReportPlan: !!finalSession?.reportPlan,
          tasksCount: finalSession?.tasks?.length,
          hasFinalReport: !!finalSession?.finalReport,
          finalReportLength: finalSession?.finalReport?.length,
        },
        summary: {
          topic: "Planning a romantic weekend trip to Paris",
          budget: "€1000-1500",
          focus: "Boutique hotels, romantic dining, Seine activities, hidden gems",
          timeframe: "May (late spring)",
          status: "✅ COMPLETED SUCCESSFULLY",
        },
      },
    });
  } catch (err) {
    console.error("Mock Paris flow test error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
