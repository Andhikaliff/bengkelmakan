import { NextRequest, NextResponse } from "next/server";
import { getCredentials, createSession, type Role, SESSION_COOKIE, SESSION_MAX_AGE, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Tanpa baris ini, Next.js
// bisa salah mendeteksi route sederhana seperti ini sebagai halaman statis (karena
// sejak migrasi ke database lokal, route ini tidak lagi memanggil fetch() eksternal
// yang dulu jadi sinyal otomatis "route ini dinamis" bagi Next.js) — akibatnya data
// yang dikembalikan bisa "beku" di kondisi saat build, bukan data terbaru.
export const dynamic = "force-dynamic";


// Username & password admin disimpan di Environment Variable, BUKAN di-hardcode di kode.
// Set ADMIN_USERNAME dan ADMIN_PASSWORD di .env.local (lokal) dan di Vercel (production).

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const creds = getCredentials(username);
  const isMatch = creds && verifyPassword(password, creds.passwordHash);
  const matchedRole = isMatch ? creds.role : null;

  if (matchedRole) {
    const res = NextResponse.json({ status: "success", role: matchedRole });
    res.cookies.set(SESSION_COOKIE, createSession(matchedRole, username), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    
    await logAudit({
      action: "LOGIN",
      description: `User login sebagai ${matchedRole}`,
      metadata: { username, role: matchedRole },
      req: req,
    });
    
    return res;
  }

  await logAudit({
    action: "LOGIN_FAILED",
    description: `Login gagal untuk username: ${username}`,
    status: "FAILED",
    metadata: { username },
    req: req,
  });

  return NextResponse.json(
    { status: "error", message: "Username atau password salah" },
    { status: 401 }
  );
}
