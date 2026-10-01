import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const ROLES = ["ADMIN", "DATA", "SCANNER"] as const;
export type Role = (typeof ROLES)[number];

const SESSION_COOKIE = "canteen_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function secret() {
  return process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || "change-this-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(role: Role, username: string) {
  const payload = Buffer.from(JSON.stringify({ role, username, exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getRoleFromSession(value?: string): Role | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  const expectedSignature = sign(payload || "");
  if (!payload || !signature || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: Role; exp?: number };
    return parsed.exp && parsed.exp > Date.now() && ROLES.includes(parsed.role as Role) ? parsed.role as Role : null;
  } catch {
    return null;
  }
}

export async function getRoleFromSessionEdge(value?: string): Promise<Role | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: Role; exp?: number };
    return parsed.exp && parsed.exp > Date.now() && ROLES.includes(parsed.role as Role) ? parsed.role as Role : null;
  } catch {
    return null;
  }
}

export function getCurrentRole() {
  return getRoleFromSession(cookies().get(SESSION_COOKIE)?.value);
}

export function hasRole(role: Role | null, allowed: readonly Role[]) {
  return role !== null && allowed.includes(role);
}

export async function requireRole(allowed: readonly Role[]) {
  const role = getCurrentRole();
  if (!hasRole(role, allowed)) {
    throw new AuthorizationError();
  }
  return role;
}

export class AuthorizationError extends Error {}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string | undefined) {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, expected.length / 2);
  return actual.length === expected.length / 2 && timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export function getCredentials(username: string): { role: Role; passwordHash?: string } | null {
  if (username === process.env.ADMIN_USERNAME) return { role: "ADMIN", passwordHash: process.env.ADMIN_PASSWORD_HASH };
  if (username === process.env.DATA_USERNAME) return { role: "DATA", passwordHash: process.env.DATA_PASSWORD_HASH };
  if (username === process.env.SCANNER_USERNAME) return { role: "SCANNER", passwordHash: process.env.SCANNER_PASSWORD_HASH };
  
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("SCANNER_") && key.endsWith("_USERNAME") && key !== "SCANNER_USERNAME") {
      if (process.env[key] === username) {
        const hashKey = key.replace("_USERNAME", "_PASSWORD_HASH");
        return { role: "SCANNER", passwordHash: process.env[hashKey] };
      }
    }
  }
  return null;
}

export function getScannerIdFromSession(value?: string): string | null {
  if (!value) return null;
  const [payload] = value.split(".");
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.role === "SCANNER" && parsed.username) {
      const match = parsed.username.match(/^scanner-?(\d+)$/i);
      return match ? `SCANNER-${match[1].padStart(2, '0')}` : parsed.username.toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_MAX_AGE };