import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/utils/api/auth";
import { type APIResponse, UpdateSettingsSchema } from "@/utils/api/types";
import { UserManager } from "@/utils/api/user-manager";

const userManager = UserManager.getInstance();

export const runtime = "edge";

// GET /api/auth/settings - Get user settings
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

    const settings = await userManager.getUserSettings(userId);

    if (!settings) {
      const response: APIResponse = {
        success: false,
        error: "User not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: APIResponse = {
      success: true,
      data: settings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get settings error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/auth/settings - Update settings
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, isAuthenticated } = await authenticateRequest(request);

    if (!isAuthenticated || !userId) {
      const response: APIResponse = {
        success: false,
        error: "Authentication required",
      };
      return NextResponse.json(response, { status: 401 });
    }

    const body = await request.json();
    const validatedSettings = UpdateSettingsSchema.parse(body);

    const updatedUser = await userManager.updateSettings(userId, validatedSettings);

    if (!updatedUser) {
      const response: APIResponse = {
        success: false,
        error: "User not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: APIResponse = {
      success: true,
      data: updatedUser.settings,
      message: "Settings updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Update settings error:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    };
    return NextResponse.json(response, { status: 400 });
  }
}
