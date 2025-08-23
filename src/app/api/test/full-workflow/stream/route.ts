import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getAIProviderApiKey,
  getAIProviderBaseURL,
  getSearchProviderApiKey,
  getSearchProviderBaseURL,
} from "@/app/api/utils";
import { authenticateRequest } from "@/utils/api/auth";
import DeepResearch from "@/utils/deep-research";
import { multiApiKeyPolling } from "@/utils/model";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface StreamConfig {
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
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return new NextResponse("Authentication required", { status: 401 });
    }

    // Parse request body for configuration
    let config: StreamConfig = {};
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
      topic = "Planning a weekend trip to Barcelona",
      provider = "google",
      thinkingModel = "gemini-2.0-flash-thinking-exp",
      taskModel = "gemini-2.0-flash-exp",
      searchProvider = "tavily",
      language = "en",
      maxResults = 10,
      enableReferences = true,
      enableCitationImage = true,
    } = config;

    if (mode === "mock") {
      // Quick mock response for testing
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const events = [
            { event: "progress", data: { step: "questions", status: "start" } },
            { event: "message", data: { content: "Generating research questions..." } },
            { event: "progress", data: { step: "questions", status: "end" } },
            { event: "progress", data: { step: "feedback", status: "start" } },
            { event: "message", data: { content: "Processing user feedback..." } },
            { event: "progress", data: { step: "feedback", status: "end" } },
            { event: "progress", data: { step: "report-plan", status: "start" } },
            { event: "message", data: { content: "Creating research plan..." } },
            { event: "progress", data: { step: "report-plan", status: "end" } },
            { event: "progress", data: { step: "search", status: "start" } },
            { event: "message", data: { content: "Searching for information..." } },
            { event: "progress", data: { step: "search", status: "end" } },
            { event: "progress", data: { step: "final-report", status: "start" } },
            { event: "message", data: { content: "Writing final report..." } },
            {
              event: "message",
              data: {
                content: `# ${topic}\n\n## Research Results\n\nThis is a mock report for testing the streaming interface.\n\n**Configuration Used:**\n- Mode: ${mode}\n- Provider: ${provider}\n- Thinking Model: ${thinkingModel}\n- Task Model: ${taskModel}\n- Max Results: ${maxResults}\n\n**Mock Findings:**\n- Sample finding 1\n- Sample finding 2\n- Sample finding 3\n\nThis demonstrates the streaming output functionality.`,
              },
            },
            { event: "progress", data: { step: "final-report", status: "end" } },
          ];

          let index = 0;
          const sendNext = () => {
            if (index < events.length) {
              const { event, data } = events[index];
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
              );
              index++;
              setTimeout(sendNext, 500); // 500ms delay between events
            } else {
              controller.close();
            }
          };

          sendNext();
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Real mode - use actual streaming research
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start: async (controller) => {
        console.log("Starting real research stream");
        controller.enqueue(
          encoder.encode(
            `event: info\ndata: ${JSON.stringify({
              mode: "real",
              topic,
              provider,
              thinkingModel,
              taskModel,
            })}\n\n`
          )
        );

        const aiApiKey = multiApiKeyPolling(getAIProviderApiKey(provider));
        const searchApiKey = multiApiKeyPolling(getSearchProviderApiKey(searchProvider));

        const deepResearch = new DeepResearch({
          language,
          AIProvider: {
            baseURL: getAIProviderBaseURL(provider),
            ...(aiApiKey && { apiKey: aiApiKey }),
            provider,
            thinkingModel,
            taskModel,
          },
          searchProvider: {
            baseURL: getSearchProviderBaseURL(searchProvider),
            ...(searchApiKey && { apiKey: searchApiKey }),
            provider: searchProvider,
            maxResult: maxResults,
          },
          onMessage: (event, data) => {
            if (event === "progress") {
              console.log(`[${data.step}]: ${data.name ? `"${data.name}" ` : ""}${data.status}`);
              if (data.step === "final-report" && data.status === "end") {
                controller.close();
              }
            } else if (event === "error") {
              console.error(data);
              controller.close();
            }
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          },
        });

        request.signal.addEventListener("abort", () => {
          controller.close();
        });

        try {
          await deepResearch.start(topic, enableCitationImage, enableReferences);
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" })}\n\n`
            )
          );
        }
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Streaming research error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
