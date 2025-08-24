import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getSessionManager } from "@/utils/api/storage-factory";
import type { APIResponse } from "@/utils/api/types";

export const runtime = "nodejs";

// GET /api/research/sessions/[sessionId]/export - Export complete session data
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

    // Get the format from query params (default to JSON)
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";

    const exportData = {
      session: {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      format,
    };

    switch (format.toLowerCase()) {
      case "json":
        return NextResponse.json({
          success: true,
          data: exportData,
        });

      case "markdown": {
        const markdown = generateMarkdownReport(session);
        return new NextResponse(markdown, {
          headers: {
            "Content-Type": "text/markdown",
            "Content-Disposition": `attachment; filename="research-${sessionId}.md"`,
          },
        });
      }

      case "csv": {
        const csv = generateCSVReport(session);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="research-${sessionId}.csv"`,
          },
        });
      }

      default: {
        const response: APIResponse = {
          success: false,
          error: "Unsupported export format. Supported formats: json, markdown, csv",
        };
        return NextResponse.json(response, { status: 400 });
      }
    }
  } catch (error) {
    console.error("Session export error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export session",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

function generateMarkdownReport(session: any): string {
  return `# Research Session: ${session.title || session.topic || "Untitled"}

## Session Information
- **ID**: ${session.id}
- **Created**: ${session.createdAt}
- **Phase**: ${session.phase}
- **Status**: ${session.phase === "completed" ? "Completed" : "In Progress"}

## Research Topic
${session.topic || "No topic specified"}

## Questions
${session.questions || "No questions generated"}

## Feedback
${session.feedback || "No feedback provided"}

## Requirements
${session.requirement || "No specific requirements"}

## Suggestions
${session.suggestion || "No suggestions provided"}

## Report Plan
${session.reportPlan || "No plan generated"}

## Final Report
${session.finalReport || "Research not yet completed"}

## Knowledge Graph
${session.knowledgeGraph || "No knowledge graph generated"}

## Resources
${
  (session.resources || []).length > 0
    ? session.resources.map((r: any) => `- **${r.name}** (${r.type}) - ${r.status}`).join("\n")
    : "No resources attached"
}

## Sources
${
  (session.sources || []).length > 0
    ? session.sources.map((s: any) => `- [${s.title || "Untitled"}](${s.url})`).join("\n")
    : "No sources found"
}

---
*Exported on ${new Date().toISOString()}*
`;
}

function generateCSVReport(session: any): string {
  const headers = ["Field", "Value"];

  const rows = [
    ["ID", session.id],
    ["Title", session.title || ""],
    ["Topic", session.topic || ""],
    ["Phase", session.phase],
    ["Created", session.createdAt],
    ["Updated", session.updatedAt],
    ["Questions", session.questions || ""],
    ["Feedback", session.feedback || ""],
    ["Requirements", session.requirement || ""],
    ["Suggestions", session.suggestion || ""],
    ["Final Report", session.finalReport || ""],
    ["Knowledge Graph", session.knowledgeGraph || ""],
    ["Resources Count", (session.resources || []).length.toString()],
    ["Sources Count", (session.sources || []).length.toString()],
  ];

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
}
