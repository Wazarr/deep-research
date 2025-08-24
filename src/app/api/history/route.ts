import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { type APIResponse, type ListHistoryResponse, SaveHistorySchema } from "@/utils/api/types";

export const runtime = "nodejs";

// GET /api/history - List research history
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);

    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const tag = url.searchParams.get("tag");

    let history;

    if (query) {
      history = await historyManager.search(query, userId);
    } else if (tag) {
      history = await historyManager.getByTag(tag, userId);
    } else {
      history = await historyManager.list(userId);
    }

    const response: APIResponse<ListHistoryResponse> = {
      success: true,
      data: {
        history,
        total: history.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list history",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/history - Save research to history
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);

    const body = await request.json();
    const { sessionId, title, tags } = SaveHistorySchema.parse(body);

    // Get the session to save
    const session = await sessionManager.get(sessionId);
    if (!session) {
      const response: APIResponse = {
        success: false,
        error: "Session not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await sessionManager.validateOwnership(sessionId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    const historyItem = await historyManager.save(session, title, tags || [], userId);

    const response: APIResponse = {
      success: true,
      data: historyItem,
      message: "Research saved to history",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Save history error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save to history",
    };
    return NextResponse.json(response, { status: 400 });
  }
}
