import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname === "/" || pathname === "/login";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/consignments") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/settings");

  if (isProtected && !ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/consignments/:path*", "/customers/:path*", "/settings/:path*"],
};
