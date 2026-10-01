import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/sheets";
import { buildTransactionsWorkbook } from "@/lib/excel";
import { requireRole, AuthorizationError, unauthorizedResponse } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PENTING: route ini WAJIB selalu dijalankan ulang tiap request (tidak boleh
// di-cache/di-generate statis oleh Next.js saat build). Lihat komentar yang
// sama di /api/transactions untuk alasan detailnya.
export const dynamic = "force-dynamic";

// GET /api/export/excel                          -> semua bulan, semua departemen
// GET /api/export/excel?month=Juli&year=2026      -> filter bulan+tahun
// GET /api/export/excel?departemen=IT             -> filter departemen
// (parameter sama persis seperti /api/transactions, supaya hasil unduhan
// selalu cocok dengan apa yang sedang difilter/ditampilkan di layar)
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "DATA"]);
    const month = req.nextUrl.searchParams.get("month") || undefined;
    const year = req.nextUrl.searchParams.get("year") || undefined;
    const departemen = req.nextUrl.searchParams.get("departemen") || undefined;

    const transactions = await getTransactions(month, year, departemen);

    const monthLabel = month ? `${month}${year ? " " + year : ""}` : "Semua Bulan";
    const deptLabel = departemen || "Semua Departemen";

    const buffer = await buildTransactionsWorkbook(transactions, { monthLabel, deptLabel });

    const filenameParts = ["laporan-bengkel-makan", monthLabel, deptLabel].map((s) =>
      s.toLowerCase().replace(/\s+/g, "-")
    );
    
    await logAudit({
      action: "EXPORT_DATA",
      description: `Mengekspor data transaksi Excel untuk ${monthLabel} (${deptLabel})`,
      metadata: { monthLabel, deptLabel, totalRows: transactions.length },
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
