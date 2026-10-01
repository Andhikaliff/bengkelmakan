export const ROLES = ["ADMIN", "DATA", "SCANNER"] as const;
export type Role = (typeof ROLES)[number];

const secret = () => process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || "change-this-session-secret";

export async function getRoleFromSessionEdge(value?: string): Promise<Role | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decode(signature), new TextEncoder().encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as { role?: Role; exp?: number };
    return parsed.exp && parsed.exp > Date.now() && ROLES.includes(parsed.role as Role) ? parsed.role as Role : null;
  } catch {
    return null;
  }
}

function decode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}