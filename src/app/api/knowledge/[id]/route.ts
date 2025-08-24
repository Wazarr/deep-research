import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getKnowledgeManager } from "@/utils/api/storage-factory";
import type { APIResponse } from "@/utils/api/types";

export const runtime = "nodejs";

// GET /api/knowledge/[id] - Get knowledge details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: knowledgeId } = await params;

    const knowledgeManager = getKnowledgeManager();
    const knowledge = await knowledgeManager.get(knowledgeId);

    if (!knowledge) {
      const response: APIResponse = {
        success: false,
        error: "Knowledge not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await knowledgeManager.validateOwnership(knowledgeId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: APIResponse = {
      success: true,
      data: knowledge,
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get knowledge",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/knowledge/[id] - Update knowledge
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: knowledgeId } = await params;

    const knowledgeManager = getKnowledgeManager();
    const knowledge = await knowledgeManager.get(knowledgeId);

    if (!knowledge) {
      const response: APIResponse = {
        success: false,
        error: "Knowledge not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await knowledgeManager.validateOwnership(knowledgeId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const updatedKnowledge = await knowledgeManager.update(knowledgeId, body);

    const response: APIResponse = {
      success: true,
      data: updatedKnowledge,
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update knowledge",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/knowledge/[id] - Remove knowledge
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: knowledgeId } = await params;

    const knowledgeManager = getKnowledgeManager();
    const knowledge = await knowledgeManager.get(knowledgeId);

    if (!knowledge) {
      const response: APIResponse = {
        success: false,
        error: "Knowledge not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await knowledgeManager.validateOwnership(knowledgeId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    await knowledgeManager.delete(knowledgeId);

    const response: APIResponse = {
      success: true,
      message: "Knowledge deleted successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete knowledge",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
