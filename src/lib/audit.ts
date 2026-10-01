import { prisma } from "@/lib/db";
import { getRoleFromSession } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export type AuditLogAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE_EMPLOYEE"
  | "BULK_CREATE_EMPLOYEE"
  | "EDIT_EMPLOYEE"
  | "DELETE_EMPLOYEE"
  | "TOGGLE_STATUS"
  | "RESET_QUOTA"
  | "SCAN"
  | "EXPORT_DATA"
  | "SETTINGS_CHANGED";

type LogOptions = {
  action: AuditLogAction;
  description: string;
  targetId?: string;
  status?: "SUCCESS" | "FAILED";
  metadata?: any;
  scannerId?: string;
  req?: Request;
};

function getIp(req?: Request) {
  if (req) {
    return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
  }
  return headers().get("x-forwarded-for") || headers().get("x-real-ip") || null;
}

export async function logAudit({
  action,
  description,
  targetId,
  status = "SUCCESS",
  metadata,
  scannerId,
  req,
}: LogOptions) {
  try {
    let role = "SYSTEM";
    let username = "system";

    const sessionCookie = cookies().get(SESSION_COOKIE)?.value;
    
    // For normal API routes using cookies
    if (sessionCookie) {
      const parsedRole = getRoleFromSession(sessionCookie);
      if (parsedRole) {
        role = parsedRole;
        // Parse payload to get username
        try {
          const [payload] = sessionCookie.split(".");
          const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
          username = parsed.username || role.toLowerCase();
        } catch {
          username = role.toLowerCase();
        }
      }
    } 
    // Fallback if triggered without session but with explicit info (like failed login)
    else if (metadata?.username) {
      username = metadata.username;
      role = typeof metadata.role === "string" ? metadata.role : "UNKNOWN";
    }

    await prisma.auditLog.create({
      data: {
        action,
        description,
        targetId,
        status,
        metadata: metadata ? JSON.stringify(metadata) : null,
        scannerId,
        ipAddress: getIp(req),
        username,
        role,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}
