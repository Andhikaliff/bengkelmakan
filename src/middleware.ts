import { NextRequest, NextResponse } from "next/server";
import { getRoleFromSessionEdge, type Role } from "@/lib/auth-edge";

const SESSION_COOKIE = "canteen_admin_session";

function getPublicUrl(req: NextRequest, path: string) {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host");

  const proto =
    req.headers.get("x-forwarded-proto") ??
    "https";

  return new URL(path, `${proto}://${host}`);
}

export async function middleware(req: NextRequest) {
  const role = await getRoleFromSessionEdge(
    req.cookies.get(SESSION_COOKIE)?.value
  );

  const isLoginPage =
    req.nextUrl.pathname === "/admin/login";

  const isRoot =
    req.nextUrl.pathname === "/";

  const path = req.nextUrl.pathname;

  // Root path: redirect based on role or to login
  if (isRoot) {
    if (!role) {
      return NextResponse.redirect(
        getPublicUrl(req, "/admin/login")
      );
    }

    return NextResponse.redirect(
      getPublicUrl(
        req,
        role === "SCANNER"
          ? "/scanner"
          : "/admin/dashboard"
      )
    );
  }

  if (!role && !isLoginPage) {
    return NextResponse.redirect(
      getPublicUrl(req, "/admin/login")
    );
  }

  if (isLoginPage && role) {
    return NextResponse.redirect(
      getPublicUrl(
        req,
        role === "SCANNER"
          ? "/scanner"
          : "/admin/dashboard"
      )
    );
  }

  if (!role) {
    return NextResponse.next();
  }

  const allowed =
    path === "/scanner" ||
    path.startsWith("/scanner/")
      ? ["ADMIN", "SCANNER"]
      : path.startsWith("/admin/audit-logs")
      ? ["ADMIN"]
      : path.startsWith("/admin/employees")
      ? ["ADMIN", "DATA"]
      : path.startsWith("/admin")
      ? ["ADMIN", "DATA"]
      : [];

  if (!(allowed as Role[]).includes(role)) {
    return NextResponse.redirect(
      getPublicUrl(
        req,
        role === "SCANNER"
          ? "/scanner"
          : "/admin/dashboard"
      )
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/scanner/:path*"],
};

