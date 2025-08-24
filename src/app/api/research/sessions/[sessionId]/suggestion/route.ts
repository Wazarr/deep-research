import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getSessionManager } from "@/utils/api/storage-factory";
import { type APIResponse, UpdateSuggestionSchema } from "@/utils/api/types";

export const runtime = "nodejs";

// PUT /api/research/sessions/[sessionId]/suggestion - Update suggestions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { sessionId } = await params;

    const sessionManager = getSessionManager();
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

    const body = await request.json();
    const { suggestion } = UpdateSuggestionSchema.parse(body);

    const updatedSession = await sessionManager.update(sessionId, {
      suggestion,
    });

    const response: APIResponse = {
      success: true,
      data: updatedSession,
      message: "Suggestions updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Suggestion update error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update suggestions",
    };
    return NextResponse.json(response, { status: 400 });
  }
}

// GET /api/research/sessions/[sessionId]/suggestion - Get current suggestions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { sessionId } = await params;

    const sessionManager = getSessionManager();
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

    const response: APIResponse = {
      success: true,
      data: {
        suggestion: session.suggestion || "",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get suggestions",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
