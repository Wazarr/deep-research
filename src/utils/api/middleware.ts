import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type AuthContext, authenticateRequest, checkRateLimit, RateLimiter } from "./auth";
import { createErrorResponse } from "./validation";

const rateLimiter = new RateLimiter();

export interface AuthenticatedRequest extends NextRequest {
  auth: AuthContext;
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated) {
      return createErrorResponse(
        "Authentication required. Provide a valid API key via Authorization header (Bearer token) or X-API-Key header.",
        401
      );
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.auth = auth;

    return await handler(authenticatedRequest);
  } catch (error) {
    console.error("Auth middleware error:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

export async function withRateLimit(
  request: AuthenticatedRequest,
  endpoint: string,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === "development") {
      return await handler(request);
    }

    if (!request.auth.userId) {
      return createErrorResponse("User ID required for rate limiting", 400);
    }

    const rateLimitInfo = await checkRateLimit(rateLimiter, request.auth.userId, endpoint);

    if (rateLimitInfo.remaining <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitInfo.limit.toString(),
            "X-RateLimit-Remaining": rateLimitInfo.remaining.toString(),
            "X-RateLimit-Reset": Math.ceil(rateLimitInfo.resetTime / 1000).toString(),
            "Retry-After": Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const response = await handler(request);

    response.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
    response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitInfo.resetTime / 1000).toString());

    return response;
  } catch (error) {
    console.error("Rate limit middleware error:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

export function withCORS(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export async function handleOptions(): Promise<NextResponse> {
  return withCORS(new NextResponse(null, { status: 200 }));
}
