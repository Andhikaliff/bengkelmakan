import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Hanya ADMIN yang bisa melihat log audit
    await requireRole(["ADMIN"]);

    const searchParams = req.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Filter
    const action = searchParams.get("action");
    const username = searchParams.get("username");
    
    const where: any = {};
    if (action) where.action = action;
    if (username) where.username = username;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    console.error("Audit log error:", err);
    return NextResponse.json(
      { error: "Gagal memuat log audit" },
      { status: 500 }
    );
  }
}
