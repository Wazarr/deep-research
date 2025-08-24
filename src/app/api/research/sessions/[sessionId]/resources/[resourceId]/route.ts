import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getSessionManager } from "@/utils/api/storage-factory";
import type { APIResponse } from "@/utils/api/types";

export const runtime = "nodejs";

// DELETE /api/research/sessions/[sessionId]/resources/[resourceId] - Remove resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; resourceId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { sessionId, resourceId } = await params;

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

    const currentResources = session.resources || [];
    const resourceExists = currentResources.some((r: any) => r.id === resourceId);

    if (!resourceExists) {
      const response: APIResponse = {
        success: false,
        error: "Resource not found in session",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const updatedResources = currentResources.filter((r: any) => r.id !== resourceId);

    const updatedSession = await sessionManager.update(sessionId, {
      resources: updatedResources,
    });

    const response: APIResponse = {
      success: true,
      data: {
        session: updatedSession,
        removedResourceId: resourceId,
        total: updatedResources.length,
      },
      message: "Resource removed successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove resource",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
