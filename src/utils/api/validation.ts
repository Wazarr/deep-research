import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import type { APIResponse } from "./types";

export function createErrorResponse(
  message: string,
  status = 400,
  details?: any
): NextResponse<APIResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<APIResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        data: null,
        error: createErrorResponse("Invalid request body", 400, result.error.errors),
      };
    }

    return { data: result.data, error: null };
  } catch (_error) {
    return {
      data: null,
      error: createErrorResponse("Invalid JSON in request body", 400),
    };
  }
}

export function validateSessionId(sessionId: string): boolean {
  return typeof sessionId === "string" && sessionId.length > 0 && sessionId.length <= 100;
}

export function sanitizeSessionForResponse(session: any) {
  // biome-ignore lint/correctness/noUnusedVariables: userId is intentionally extracted and discarded
  const { userId, ...sessionData } = session;
  return sessionData;
}
