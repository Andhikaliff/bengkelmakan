import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/sheets";
import { buildTransactionsWorkbook } from "@/lib/excel";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Lihat komentar yang
// sama di /api/transactions untuk alasan detailnya.
export const dynamic = "force-dynamic";

// GET /api/export/excel                                    -> semua bulan, semua departemen
// GET /api/export/excel?month=Juli&year=2026               -> filter bulan+tahun
// GET /api/export/excel?departemen=IT                       -> filter departemen
// GET /api/export/excel?month=..&year=..&tanggal=YYYY-MM-DD -> dipersempit 1 hari
// GET /api/export/excel?...&kategori=EMP&q=budi              -> per kategori ID & cari nama/ID
// Parameter tambahan (tanggal/kategori/q) dibuat SAMA dengan filter yang aktif
// di layar dashboard, supaya isi + Rekap Total file Excel cocok dengan yang
// sedang ditampilkan.
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "DATA"]);
    const month = req.nextUrl.searchParams.get("month") || undefined;
    const year = req.nextUrl.searchParams.get("year") || undefined;
    const departemen = req.nextUrl.searchParams.get("departemen") || undefined;
    const tanggal = req.nextUrl.searchParams.get("tanggal") || undefined;
    const kategori = req.nextUrl.searchParams.get("kategori") || undefined;
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    let transactions = await getTransactions(month, year, departemen);

    // Saring lagi supaya persis seperti tampilan dashboard.
    if (tanggal) transactions = transactions.filter((t) => t.tanggal === tanggal);
    if (kategori) {
      const target = kategori.toUpperCase();
      transactions = transactions.filter((t) => {
        const match = String(t.id).match(/^([A-Za-z]+)/);
        const cat = match ? match[1].toUpperCase() : "";
        return cat === target;
      });
    }
    if (q) {
      transactions = transactions.filter(
        (t) => t.nama.toLowerCase().includes(q) || String(t.id).toLowerCase().includes(q));
    }

    let monthLabel = month ? `${month}${year ? " " + year : ""}` : "Semua Bulan";
    if (tanggal) monthLabel += ` - ${tanggal}`;
    const deptLabel = departemen || "Semua Departemen";

    const buffer = await buildTransactionsWorkbook(transactions, { monthLabel, deptLabel });

    const filenameParts = ["laporan-bengkel-makan", monthLabel, deptLabel].map((s) =>
      s.toLowerCase().replace(/\s+/g, "-")
    );

    await logAudit({
      action: "EXPORT_DATA",
      description: `Mengekspor data transaksi Excel untuk ${monthLabel} (${deptLabel})`,
      metadata: { monthLabel, deptLabel, tanggal, kategori, q, totalRows: transactions.length },
      req: req,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameParts.join("_")}.xlsx"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) return unauthorizedResponse();
    return NextResponse.json(
      { error: "Gagal membuat file Excel" },
      { status: 500 }
    );
  }
}
