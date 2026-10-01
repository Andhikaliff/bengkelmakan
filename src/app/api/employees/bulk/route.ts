import { NextRequest, NextResponse } from "next/server";
import { bulkAddEmployee, CATEGORIES, type Category } from "@/lib/sheets";
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
    const { category, namas, departemen } = body;

    if (!isValidCategory(category)) {
      return NextResponse.json(
        { status: "error", message: "Kategori tidak valid" },
        { status: 400 }
      );
    }
    if (!Array.isArray(namas) || namas.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Daftar nama tidak boleh kosong" },
        { status: 400 }
      );
    }

    const result = await bulkAddEmployee(category, namas, String(departemen || "").trim());
    
    if (result.status === "success") {
      await logAudit({
        action: "BULK_CREATE_EMPLOYEE",
        description: `Menambahkan ${result.added.length} karyawan baru ke departemen ${departemen || "N/A"}`,
        metadata: { category, departemen, count: result.added.length },
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal melakukan bulk add karyawan" },
      { status: 500 }
    );
  }
}
