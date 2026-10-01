import { NextRequest, NextResponse } from "next/server";
import { toggleEmployeeStatus, CATEGORIES, type Category } from "@/lib/sheets";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Tanpa baris ini, Next.js
// bisa salah mendeteksi route sederhana seperti ini sebagai halaman statis (karena
// sejak migrasi ke database lokal, route ini tidak lagi memanggil fetch() eksternal
// yang dulu jadi sinyal otomatis "route ini dinamis" bagi Next.js) — akibatnya data
// yang dikembalikan bisa "beku" di kondisi saat build, bukan data terbaru.
export const dynamic = "force-dynamic";


function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const body = await req.json();
    const { category, id } = body;

    if (!isValidCategory(category)) {
      return NextResponse.json(
        { status: "error", message: "Kategori tidak valid" },
        { status: 400 }
      );
    }
    if (!id) {
      return NextResponse.json(
        { status: "error", message: "ID wajib diisi" },
        { status: 400 }
      );
    }

    const result = await toggleEmployeeStatus(category, id);
    
    if (result.status === "success") {
      await logAudit({
        action: "TOGGLE_STATUS",
        description: `Mengubah status karyawan ${id} menjadi ${result.newStatus}`,
        targetId: id,
        metadata: { category, newStatus: result.newStatus },
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal mengubah status karyawan" },
      { status: 500 }
    );
  }
}
