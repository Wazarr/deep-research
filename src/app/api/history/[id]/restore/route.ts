import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getHistoryManager, getSessionManager } from "@/utils/api/storage-factory";
import { type APIResponse, RestoreHistorySchema } from "@/utils/api/types";

export const runtime = "nodejs";

// POST /api/history/[id]/restore - Create new session from history
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);
    const { id: historyId } = await params;

    const historyManager = getHistoryManager();
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

    const body = await request.json().catch(() => ({}));
    const { expiresIn } = RestoreHistorySchema.parse(body);

    // Restore the session
    const restoredSessionData = await historyManager.restore(historyId, expiresIn || 3600, userId);

    if (!restoredSessionData) {
      const response: APIResponse = {
        success: false,
        error: "Failed to restore session from history",
      };
      return NextResponse.json(response, { status: 500 });
    }

    // Create the new session in the session manager
    // We need to create a new session properly through the manager
    const sessionManager = getSessionManager();
    const newSession = await sessionManager.create(
      restoredSessionData.settings,
      expiresIn || 3600,
      userId
    );

    // Update it with the restored data (exclude immutable fields)
    const { id: _, createdAt: __, ...restorableData } = restoredSessionData;
    const finalSession = await sessionManager.update(newSession.id, {
      ...restorableData,
      expiresAt: newSession.expiresAt, // Keep the new expiration
    });

    const response: APIResponse = {
      success: true,
      data: {
        session: finalSession
          ? {
              ...finalSession,
              createdAt: finalSession.createdAt.toISOString(),
              updatedAt: finalSession.updatedAt.toISOString(),
              expiresAt: finalSession.expiresAt.toISOString(),
            }
          : newSession,
        restoredFrom: historyId,
      },
      message: "Session restored from history",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Restore history error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore from history",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
