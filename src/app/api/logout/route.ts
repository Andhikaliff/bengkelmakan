import { NextResponse, NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await logAudit({
    action: "LOGOUT",
    description: "User melakukan logout",
    req: req,
  });

  const res = NextResponse.json({ status: "success" });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
