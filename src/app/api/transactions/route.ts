import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/sheets";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Tanpa baris ini, Next.js
// bisa salah mendeteksi route sederhana seperti ini sebagai halaman statis (karena
// sejak migrasi ke database lokal, route ini tidak lagi memanggil fetch() eksternal
// yang dulu jadi sinyal otomatis "route ini dinamis" bagi Next.js) — akibatnya data
// yang dikembalikan bisa "beku" di kondisi saat build, bukan data terbaru.
export const dynamic = "force-dynamic";


// GET /api/transactions                          -> semua bulan, semua departemen
// GET /api/transactions?month=Juli               -> filter berdasarkan bulan
// GET /api/transactions?year=2026                -> filter berdasarkan tahun
// GET /api/transactions?month=Juli&year=2026      -> filter bulan+tahun
// GET /api/transactions?departemen=IT             -> filter departemen
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "DATA"]);
    const month = req.nextUrl.searchParams.get("month") || undefined;
    const year = req.nextUrl.searchParams.get("year") || undefined;
    const departemen = req.nextUrl.searchParams.get("departemen") || undefined;
    const data = await getTransactions(month, year, departemen);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { error: "Gagal mengambil data transaksi" },
      { status: 500 }
    );
  }
}
