import { NextRequest, NextResponse } from "next/server";
import {
  getEmployees,
  getEmployeesByCategory,
  addEmployee,
  editEmployee,
  deleteEmployee,
  CATEGORIES,
  type Category,
} from "@/lib/sheets";
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

// GET /api/employees            -> semua kategori digabung
// GET /api/employees?category=EMP -> hanya 1 kategori (Karyawan/Training/DW)
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "DATA"]);
    const category = req.nextUrl.searchParams.get("category");

    if (category) {
      if (!isValidCategory(category)) {
        return NextResponse.json(
          { error: "Kategori tidak dikenali" },
          { status: 400 }
        );
      }
      const data = await getEmployeesByCategory(category);
      return NextResponse.json(data);
    }

    const data = await getEmployees();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { error: "Gagal mengambil data karyawan" },
      { status: 500 }
    );
  }
}

// POST /api/employees -> tambah orang baru, ID di-generate otomatis oleh backend
export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const body = await req.json();
    const { category, nama, departemen } = body;

    if (!isValidCategory(category)) {
      return NextResponse.json(
        { status: "error", message: "Kategori tidak valid" },
        { status: 400 }
      );
    }
    if (!nama || String(nama).trim() === "") {
      return NextResponse.json(
        { status: "error", message: "Nama wajib diisi" },
        { status: 400 }
      );
    }

    const result = await addEmployee(category, String(nama).trim(), String(departemen || "").trim());
    
    if (result.status === "success" && result.id) {
      await logAudit({
        action: "CREATE_EMPLOYEE",
        description: `Menambahkan karyawan baru: ${result.nama} (${result.id})`,
        targetId: result.id,
        metadata: { category, nama, departemen },
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal menambah karyawan" },
      { status: 500 }
    );
  }
}

// DELETE /api/employees -> hapus 1 orang dari kategori terkait
export async function DELETE(req: NextRequest) {
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

    const result = await deleteEmployee(category, id);

    if (result.status === "success") {
      await logAudit({
        action: "DELETE_EMPLOYEE",
        description: `Menghapus karyawan: ${id}`,
        targetId: id,
        metadata: { category },
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal menghapus karyawan" },
      { status: 500 }
    );
  }
}

// PUT /api/employees -> edit orang
export async function PUT(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const body = await req.json();
    const { category, id, nama, departemen } = body;

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
    if (!nama || String(nama).trim() === "") {
      return NextResponse.json(
        { status: "error", message: "Nama wajib diisi" },
        { status: 400 }
      );
    }

    const result = await editEmployee(category, id, String(nama).trim(), String(departemen || "").trim());
    
    if (result.status === "success") {
      await logAudit({
        action: "EDIT_EMPLOYEE",
        description: `Mengubah data karyawan: ${id}`,
        targetId: id,
        metadata: { category, nama, departemen },
        req: req,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { status: "error", message: "Gagal mengubah karyawan" },
      { status: 500 }
    );
  }
}

