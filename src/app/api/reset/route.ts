import { NextRequest, NextResponse } from "next/server";
import { resetTodayQuota } from "@/lib/sheets";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Tanpa baris ini, Next.js
// bisa salah mendeteksi route sederhana seperti ini sebagai halaman statis (karena
// sejak migrasi ke database lokal, route ini tidak lagi memanggil fetch() eksternal
// yang dulu jadi sinyal otomatis "route ini dinamis" bagi Next.js) — akibatnya data
// yang dikembalikan bisa "beku" di kondisi saat build, bukan data terbaru.
export const dynamic = "force-dynamic";


export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { status: "error", message: "ID tidak valid" },
        { status: 400 }
      );
    }

    const result = await resetTodayQuota(id);
    
    if (result.status === "success") {
      await logAudit({
        action: "RESET_QUOTA",
        description: `Mereset jatah makan hari ini untuk karyawan ${id}`,
        targetId: id,
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal reset jatah" },
      { status: 500 }
    );
  }
}
