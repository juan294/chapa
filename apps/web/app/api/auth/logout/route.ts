import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/github";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
