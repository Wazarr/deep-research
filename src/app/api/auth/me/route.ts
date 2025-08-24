import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { getUserManager } from "@/utils/api/storage-factory";
import type { APIResponse } from "@/utils/api/types";

export const runtime = "nodejs";

// GET /api/auth/me - Get user profile
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, isAuthenticated } = await authenticateRequest(request);

    if (!isAuthenticated || !userId) {
      const response: APIResponse = {
        success: false,
        error: "Authentication required",
      };
      return NextResponse.json(response, { status: 401 });
    }

    console.log("🔍 DEBUG - Looking for user ID:", userId);

    const userManager = getUserManager();
    console.log("🔍 DEBUG - Total users in storage:", await userManager.list());

    const user = await userManager.get(userId);

    console.log("🔍 DEBUG - User found:", !!user);

    if (!user) {
      const response: APIResponse = {
        success: false,
        error: "User not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: APIResponse = {
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        settings: user.settings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get user profile error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get user profile",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
