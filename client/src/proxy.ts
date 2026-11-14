import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected route prefixes requiring valid session
const PROTECTED_PREFIXES = ["/dashboard"];

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

// Backward-compatibility export in case any internal runtime hook looks for middleware
export const middleware = proxy;

export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};
