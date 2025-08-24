import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getSessionManager } from "@/utils/api/storage-factory";
import { addStream, removeStream } from "@/utils/api/stream-manager";
import { validateSessionId } from "@/utils/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!validateSessionId(sessionId)) {
    return new NextResponse("Invalid session ID", { status: 400 });
  }

  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated) {
    return new NextResponse("Authentication required", { status: 401 });
  }

  try {
    const sessionManager = getSessionManager();
    const session = await sessionManager.get(sessionId);
    if (!session) {
      return new NextResponse("Session not found", { status: 404 });
    }

    const hasAccess = await sessionManager.validateOwnership(sessionId, auth.userId);
    if (!hasAccess) {
      return new NextResponse("Access denied", { status: 403 });
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start: async (controller) => {
        console.log(`SSE client connected to session ${sessionId}`);

        addStream(sessionId, controller);

        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({
              sessionId,
              phase: session.phase,
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        );

        if (session.phase === "completed" && session.finalReport) {
          controller.enqueue(
            encoder.encode(
              `event: final-report\ndata: ${JSON.stringify({
                finalReport: session.finalReport,
                phase: "completed",
              })}\n\n`
            )
          );
          controller.close();
        } else if (session.phase === "error") {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: session.error,
                phase: "error",
              })}\n\n`
            )
          );
          controller.close();
        }

        request.signal.addEventListener("abort", () => {
          console.log(`SSE client disconnected from session ${sessionId}`);
          removeStream(sessionId, controller);
          controller.close();
        });
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  } catch (err) {
    console.error("Stream setup error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
