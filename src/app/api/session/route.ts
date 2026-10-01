import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ role: getCurrentRole() });
}