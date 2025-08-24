import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { HistoryManager } from "@/utils/api/history-manager";
import type { APIResponse } from "@/utils/api/types";

const historyManager = HistoryManager.getInstance();

export const runtime = "edge";

// GET /api/history/[id] - Get specific research
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: historyId } = await params;

    const historyItem = await historyManager.get(historyId);

    if (!historyItem) {
      const response: APIResponse = {
        success: false,
        error: "History item not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await historyManager.validateOwnership(historyId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: APIResponse = {
      success: true,
      data: historyItem,
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get history item",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/history/[id] - Remove from history
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: historyId } = await params;

    const historyItem = await historyManager.get(historyId);

    if (!historyItem) {
      const response: APIResponse = {
        success: false,
        error: "History item not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await historyManager.validateOwnership(historyId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    await historyManager.delete(historyId);

    const response: APIResponse = {
      success: true,
      message: "History item deleted successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete history item",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/history/[id] - Update history item (tags, title)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: historyId } = await params;

    const historyItem = await historyManager.get(historyId);

    if (!historyItem) {
      const response: APIResponse = {
        success: false,
        error: "History item not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check ownership if user is authenticated
    if (userId && !(await historyManager.validateOwnership(historyId, userId))) {
      const response: APIResponse = {
        success: false,
        error: "Access denied",
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const { tags } = body;

    if (tags && Array.isArray(tags)) {
      const updatedItem = await historyManager.updateTags(historyId, tags);

      const response: APIResponse = {
        success: true,
        data: updatedItem,
        message: "History item updated successfully",
      };

      return NextResponse.json(response);
    } else {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body. Expected { tags: string[] }",
      };
      return NextResponse.json(response, { status: 400 });
    }
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update history item",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
