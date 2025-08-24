import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getUserManager } from "@/utils/api/storage-factory";
import type { APIResponse } from "@/utils/api/types";

export const runtime = "nodejs";

// POST /api/auth/token/refresh - Refresh token
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, isAuthenticated } = await authenticateRequest(request);

    if (!isAuthenticated || !userId) {
      const response: APIResponse = {
        success: false,
        error: "Authentication required",
      };
      return NextResponse.json(response, { status: 401 });
    }

    const userManager = getUserManager();
    const authResponse = await userManager.refreshToken(userId);

    if (!authResponse) {
      const response: APIResponse = {
        success: false,
        error: "User not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: APIResponse = {
      success: true,
      data: authResponse,
      message: "Token refreshed successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Token refresh error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refresh token",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
