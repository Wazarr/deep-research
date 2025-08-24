import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getKnowledgeManager } from "@/utils/api/storage-factory";
import {
  type APIResponse,
  type ListKnowledgeResponse,
  UploadKnowledgeSchema,
} from "@/utils/api/types";

export const runtime = "nodejs";

// GET /api/knowledge - List knowledge
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);

    const knowledgeManager = getKnowledgeManager();
    const knowledge = await knowledgeManager.list(userId);

    const response: APIResponse<ListKnowledgeResponse> = {
      success: true,
      data: {
        knowledge,
        total: knowledge.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list knowledge",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/knowledge - Upload knowledge
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await authenticateRequest(request);

    const knowledgeManager = getKnowledgeManager();
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const title = formData.get("title") as string;

      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
      }

      const knowledge = await knowledgeManager.processFile(file, userId);
      if (title) {
        await knowledgeManager.update(knowledge.id, { title });
      }

      const response: APIResponse = {
        success: true,
        data: knowledge,
      };

      return NextResponse.json(response);
    } else {
      // Handle JSON request
      const body = await request.json();
      const validatedData = UploadKnowledgeSchema.parse(body);

      let knowledge;

      switch (validatedData.type) {
        case "file":
          throw new Error("File upload requires multipart/form-data");
        case "url":
          if (!validatedData.url) {
            throw new Error("URL is required for url type");
          }
          knowledge = await knowledgeManager.processUrl(
            validatedData.url,
            validatedData.title,
            userId
          );
          break;
        case "text":
          if (!validatedData.content) {
            throw new Error("Content is required for text type");
          }
          knowledge = await knowledgeManager.processText(
            validatedData.content,
            validatedData.title || "Untitled Knowledge",
            userId
          );
          break;
      }

      const response: APIResponse = {
        success: true,
        data: knowledge,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("Knowledge upload error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload knowledge",
    };
    return NextResponse.json(response, { status: 400 });
  }
}
