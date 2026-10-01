import { NextResponse } from "next/server";
import { getMonths } from "@/lib/sheets";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Tanpa baris ini, Next.js
// bisa salah mendeteksi route sederhana seperti ini sebagai halaman statis (karena
// sejak migrasi ke database lokal, route ini tidak lagi memanggil fetch() eksternal
// yang dulu jadi sinyal otomatis "route ini dinamis" bagi Next.js) — akibatnya data
// yang dikembalikan bisa "beku" di kondisi saat build, bukan data terbaru.
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    await requireRole(["ADMIN", "DATA"]);
    const data = await getMonths();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { error: "Gagal mengambil daftar bulan" },
      { status: 500 }
    );
  }
}
