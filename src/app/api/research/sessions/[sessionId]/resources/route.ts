import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getKnowledgeManager, getSessionManager } from "@/utils/api/storage-factory";
import { type APIResponse, AttachResourcesSchema } from "@/utils/api/types";

export const runtime = "nodejs";

// POST /api/research/sessions/[sessionId]/resources - Attach resources
export async function POST(
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
    const { knowledgeIds } = AttachResourcesSchema.parse(body);

    // Validate that all knowledge items exist and are accessible
    const knowledgeManager = getKnowledgeManager();
    const resources: Resource[] = [];
    for (const knowledgeId of knowledgeIds) {
      const knowledge = await knowledgeManager.get(knowledgeId);

      if (!knowledge) {
        const response: APIResponse = {
          success: false,
          error: `Knowledge ${knowledgeId} not found`,
        };
        return NextResponse.json(response, { status: 404 });
      }

      // Check ownership if user is authenticated
      if (userId && !(await knowledgeManager.validateOwnership(knowledgeId, userId))) {
        const response: APIResponse = {
          success: false,
          error: `Access denied to knowledge ${knowledgeId}`,
        };
        return NextResponse.json(response, { status: 403 });
      }

      resources.push({
        id: knowledge.id,
        name: knowledge.title,
        type: knowledge.type,
        size: knowledge.size,
        status: knowledge.status === "completed" ? "completed" : "processing",
      });
    }

    // Add resources to session
    const currentResources = session.resources || [];
    const existingIds = new Set(currentResources.map((r: any) => r.id));
    const newResources = resources.filter((r: any) => !existingIds.has(r.id));

    const updatedSession = await sessionManager.update(sessionId, {
      resources: [...currentResources, ...newResources],
    });

    const response: APIResponse = {
      success: true,
      data: {
        session: updatedSession,
        attached: newResources.length,
        total: (updatedSession?.resources || []).length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Resource attachment error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to attach resources",
    };
    return NextResponse.json(response, { status: 400 });
  }
}

// GET /api/research/sessions/[sessionId]/resources - List session resources
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
        resources: session.resources || [],
        total: (session.resources || []).length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get session resources",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
