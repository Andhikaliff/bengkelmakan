// Bikin file Excel (.xlsx) dari data transaksi.
// Karena data disimpan di SQLite lokal, endpoint export ini yang menjadi
// cara utama melihat/mencetak data di luar aplikasi (misalnya dibuka di Excel,
// di-print, atau diolah lebih lanjut).
//
// Warna baris dibuat menggunakan format warna berikut agar familiar:
// BERHASIL = hijau, DUPLIKAT = merah, DIRESET = kuning,
// NONAKTIF = abu-abu gelap, TIDAK DIKENAL = abu-abu terang.
import ExcelJS from "exceljs";
import type { Transaction } from "@/lib/sheets";

const STATUS_COLORS: Record<string, { bg: string; font: string }> = {
  BERHASIL: { bg: "FFD1FAE5", font: "FF065F46" },
  DUPLIKAT: { bg: "FFFEE2E2", font: "FF991B1B" },
  DIRESET: { bg: "FFFEF9C3", font: "FF854D0E" },
  NONAKTIF: { bg: "FFE5E7EB", font: "FF4B5563" },
  "TIDAK DIKENAL": { bg: "FFF3F4F6", font: "FF374151" },
};

export async function buildTransactionsWorkbook(
  transactions: Transaction[],
  meta: { monthLabel: string; deptLabel: string }
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bengkel Makan Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Transaksi", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Lebar kolom di-set manual satu-satu (SENGAJA tidak pakai `sheet.columns =
  // [{header: ...}]`, karena itu otomatis menulis header ke baris 1 — baris 1
  // di sini dipakai untuk judul laporan, bukan header kolom).
  const widths = [12, 24, 16, 14, 12, 16];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // Baris 1: judul laporan (menyebutkan filter bulan & departemen yang aktif)
  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Laporan Transaksi Bengkel Makan — ${meta.monthLabel} — ${meta.deptLabel}`;
  titleCell.font = { bold: true, size: 13 };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 22;

  // Baris 2: header kolom
  const headers = ["ID", "Nama", "Departemen", "Tanggal", "Jam", "Status"];
  const headerRow = sheet.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.commit();

  // Baris 3 dst: data (addRow otomatis menyambung setelah baris terakhir yang
  // sudah ditulis, jadi lanjut dari baris 3 dan seterusnya)
  transactions.forEach((t) => {
    const row = sheet.addRow([t.id, t.nama, t.departemen || "-", t.tanggal, t.jam, t.status]);
    const colors = STATUS_COLORS[t.status];
    if (colors) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.bg } };
        cell.font = { color: { argb: colors.font } };
      });
    }
  });

  return workbook.xlsx.writeBuffer();
}
