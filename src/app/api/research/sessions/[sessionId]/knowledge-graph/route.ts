import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { SessionManager } from "@/utils/api/session-manager";
import { type APIResponse, UpdateKnowledgeGraphSchema } from "@/utils/api/types";

const sessionManager = SessionManager.getInstance();

export const runtime = "edge";

// PUT /api/research/sessions/[sessionId]/knowledge-graph - Update knowledge graph
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { sessionId } = await params;

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
    const { knowledgeGraph } = UpdateKnowledgeGraphSchema.parse(body);

    const updatedSession = await sessionManager.update(sessionId, {
      knowledgeGraph,
    });

    const response: APIResponse = {
      success: true,
      data: updatedSession,
      message: "Knowledge graph updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Knowledge graph update error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update knowledge graph",
    };
    return NextResponse.json(response, { status: 400 });
  }
}

// GET /api/research/sessions/[sessionId]/knowledge-graph - Get current knowledge graph
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { sessionId } = await params;

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
        knowledgeGraph: session.knowledgeGraph || "",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get knowledge graph",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
