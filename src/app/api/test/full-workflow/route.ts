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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParisTestConfig {
  mode?: "mock" | "real";
  topic?: string;
  feedback?: string;
  provider?: string;
  thinkingModel?: string;
  taskModel?: string;
  searchProvider?: string;
  language?: string;
  maxResults?: number;
  enableReferences?: boolean;
  enableCitationImage?: boolean;
  budget?: string;
  timeframe?: string;
  focus?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return new NextResponse("Authentication required", { status: 401 });
    }

    // Parse request body for configuration
    let config: ParisTestConfig = {};
    try {
      const body = await request.text();
      if (body) {
        config = JSON.parse(body);
      }
    } catch {
      // Use defaults if parsing fails
    }

    // Set defaults
    const {
      mode = "real",
      topic = "Planning a romantic weekend trip to Paris",
      feedback = "Focus on unique romantic experiences, boutique hotels, and local hidden gems. Budget around €1000-1500 for the weekend.",
      provider = "google",
      thinkingModel = "gemini-2.0-flash-thinking-exp",
      taskModel = "gemini-2.0-flash-exp",
      searchProvider = "tavily",
      language = "en",
      maxResults = 10,
      enableReferences = true,
      enableCitationImage = true,
      budget = "€1000-1500",
      timeframe = "May (late spring)",
      focus = "boutique hotels, romantic dining, Seine activities, hidden gems",
    } = config;

    // Create session manager instance for this test
    const sessionManager = new SessionManager();

    // Create a session with configurable AI models
    const session = await sessionManager.create(
      {
        provider,
        thinkingModel,
        taskModel,
        searchProvider,
        language,
        maxResults,
        enableReferences,
        enableCitationImage,
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
    console.log(`Test: Starting Paris research flow in ${mode} mode`);

    let questions: string;
    let reportPlan: string;
    let finalReport: string;
    let finalReportTitle: string = "";
    let results: any[] = [];

    if (mode === "mock") {
      // Mock mode - return predefined data quickly
      questions = `What's your budget range for the weekend?
Are you interested in luxury hotels or charming boutique accommodations?
Do you prefer fine dining or discovering local bistros?
Are you interested in museums and cultural sites or outdoor romantic activities?
What time of year are you planning to visit?`;

      reportPlan = `# Your Perfect Romantic Paris Weekend Guide

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
- Timing and reservation strategies`;

      finalReportTitle = "Your Perfect Romantic Paris Weekend";
      finalReport = `# Your Perfect Romantic Paris Weekend 🗼💕

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

*Bon voyage! Your romantic Parisian adventure awaits.* ✨`;

      results = [
        { source: "Mock Hotel Data", content: "Boutique hotel recommendations" },
        { source: "Mock Restaurant Data", content: "Romantic dining options" },
        { source: "Mock Activity Data", content: "Unique romantic experiences" },
        { source: "Mock Travel Data", content: "May travel practical tips" },
      ];
    } else {
      // Real mode - use actual AI and search APIs
      // 1. Generate questions for Paris romantic weekend
      questions = await deepResearch.askQuestions(topic);
      console.log("Test: Generated questions");

      // 2. Process feedback
      await deepResearch.processFeedback(topic, questions, feedback);
      console.log("Test: Processed feedback");

      // 3. Generate report plan
      reportPlan = await deepResearch.writeReportPlan(topic);
      console.log("Test: Generated report plan");

      // 4. Get updated session to see tasks
      const updatedSession = await sessionManager.get(session.id);
      if (!updatedSession || !updatedSession.tasks) {
        throw new Error("Failed to generate tasks");
      }

      // 5. Execute research
      console.log("Test: Executing research tasks");
      results = await deepResearch.runSearchTask(
        updatedSession.tasks,
        settings.enableReferences ?? true
      );

      // 6. Generate final report
      console.log("Test: Generating final report");
      const finalReportResult = await deepResearch.writeFinalReport(
        reportPlan,
        results,
        settings.enableCitationImage ?? true,
        settings.enableReferences ?? true
      );
      finalReport = finalReportResult.finalReport;
      finalReportTitle = finalReportResult.title;
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        phase: "completed",
        mode,
        config: {
          topic,
          feedback,
          budget,
          timeframe,
          focus,
          provider,
          thinkingModel,
          taskModel,
          searchProvider,
        },
        questions,
        reportPlan,
        finalReport,
        finalReportTitle,
        resultsCount: results.length,
        message: `Paris romantic weekend research completed successfully in ${mode} mode!`,
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
