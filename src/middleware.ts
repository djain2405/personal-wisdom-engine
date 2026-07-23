import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Hard guarantee for MVP: /login never traps you if personal mode env is missing in Edge
  const personal =
    (process.env.NEXT_PUBLIC_PERSONAL_MODE ||
      process.env.PERSONAL_MODE ||
      "true"
    ).toLowerCase() !== "false";

  if (personal) {
    if (request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
