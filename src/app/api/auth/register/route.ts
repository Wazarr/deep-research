import { type NextRequest, NextResponse } from "next/server";
import { getUserManager } from "@/utils/api/storage-factory";
import { type APIResponse, RegisterUserSchema } from "@/utils/api/types";

export const runtime = "nodejs";

// POST /api/auth/register - Create account
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = RegisterUserSchema.parse(body);

    const userManager = getUserManager();
    const authResponse = await userManager.register(validatedData.email, validatedData.settings);

    console.log("🔍 DEBUG - User registered with ID:", authResponse.userId);
    console.log("🔍 DEBUG - Total users in storage:", await userManager.list());

    const response: APIResponse = {
      success: true,
      data: authResponse,
      message: "User registered successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("User registration error:", error);

    let statusCode = 500;
    let errorMessage = "Registration failed";

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes("already exists")) {
        statusCode = 409; // Conflict
      } else if (error.message.includes("validation")) {
        statusCode = 400; // Bad Request
      }
    }

    const response: APIResponse = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: statusCode });
  }
}
