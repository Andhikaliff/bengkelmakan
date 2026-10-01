// ============================================================================
// DATABASE PERMANEN (PRISMA + SQLITE)
// ============================================================================
// File ini menyimpan logika koneksi ke database lokal SQLite menggunakan Prisma.
// Semua data (Karyawan, Transaksi, dll) tersimpan permanen di file lokal
// (prisma/dev.db by default).
// ============================================================================

import { prisma } from "@/lib/db";
import { withLock } from "@/lib/mutex";

// Semua types & constants dipindah ke canteen-shared.ts (tanpa import Prisma
// sama sekali di sana), supaya halaman client component bisa import
// Category/Employee/CATEGORY_LABELS/dst tanpa ikut menyeret Prisma +
// better-sqlite3 ke bundle browser.
// Di-export ulang di sini supaya semua API route yang sudah ada tetap bisa
// `import { CATEGORY_LABELS, type Category, ... } from "@/lib/sheets"`.
export type {
  Category,
  Employee,
  Transaction,
  ScanResult,
  AddEmployeeResult,
} from "@/lib/canteen-shared";
export { CATEGORY_LABELS, CATEGORIES, DEPARTMENTS } from "@/lib/canteen-shared";

import type {
  Category,
  Employee,
  Transaction,
  ScanResult,
  AddEmployeeResult,
} from "@/lib/canteen-shared";
import { CATEGORIES } from "@/lib/canteen-shared";

// ============================================================================
// HELPER INTERNAL
// ============================================================================

const TRANSAKSI_PREFIX = "Transaksi ";

const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Timezone dikunci ke Asia/Makassar (WITA) supaya tanggal/jam yang tercatat
// konsisten untuk operasional kantin.
const TIMEZONE = "Asia/Makassar";

function formatTanggal(date: Date): string {
  // en-CA menghasilkan format "yyyy-MM-dd" secara native.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatJam(date: Date): string {
  // en-GB + hour12:false menghasilkan format 24 jam "HH:mm:ss".
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getMonthIndexInTZ(date: Date): number {
  const monthStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "numeric",
  }).format(date);
  return Number(monthStr) - 1;
}

function getYearInTZ(date: Date): number {
  const yearStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
  }).format(date);
  return Number(yearStr);
}

// Label bulan berjalan, contoh: "Transaksi Juli 2026". Ini "dibekukan" ke tiap
// baris transaksi saat baris itu ditulis — riwayat lama tidak pernah berubah
// label bulannya meskipun logic ini nanti berubah.
function getCurrentMonthLabel(date: Date): string {
  return `${TRANSAKSI_PREFIX}${BULAN_INDO[getMonthIndexInTZ(date)]} ${getYearInTZ(date)}`;
}

// Pecah label bulan ("Transaksi Juli 2026") jadi { month: "Juli", year: "2026" }.
// Dipakai untuk filter getTransactions(month, year, ...) dan pengurutan getMonths().
function parseMonthLabel(label: string): { month: string; year: string } {
  const cleaned = String(label).trim();
  if (!cleaned.startsWith(TRANSAKSI_PREFIX)) {
    return { month: "", year: "" };
  }
  const payload = cleaned.substring(TRANSAKSI_PREFIX.length).trim();
  const match = payload.match(/^(.*?)(?:\s+(\d{4}))?$/);
  return {
    month: match ? String(match[1] || "").trim() : "",
    year: match && match[2] ? String(match[2]) : "",
  };
}

function normalizeId(id: string): string {
  return String(id).trim().toUpperCase();
}

// Tentukan kategori dari sebuah ID, contoh "EMP003" -> "EMP"
function getCategoryFromId(id: string): Category | null {
  const match = String(id).trim().match(/^([A-Za-z]+)/);
  if (!match) return null;
  const upper = match[1].toUpperCase();
  return (CATEGORIES as string[]).includes(upper) ? (upper as Category) : null;
}

// Hitung nomor urut terbesar yang sudah dipakai suatu kategori, dari situ ID
// berikutnya tinggal +1.
async function getMaxIdNumber(category: Category): Promise<number> {
  const rows = await prisma.employee.findMany({
    where: { category },
    select: { id: true },
  });
  let maxNumber = 0;
  for (const row of rows) {
    const match = row.id.match(/^[A-Za-z]+(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return maxNumber;
}

function mapEmployee(row: {
  id: string;
  nama: string;
  departemen: string;
  status: string;
  category: string;
}): Employee {
  return {
    id: row.id,
    nama: row.nama,
    departemen: row.departemen,
    status: row.status,
    category: row.category as Category,
  };
}

function mapTransaction(row: {
  employeeId: string;
  nama: string;
  departemen: string;
  tanggal: string;
  jam: string;
  status: string;
  bulan: string;
}): Transaction {
  return {
    id: row.employeeId,
    nama: row.nama,
    departemen: row.departemen,
    tanggal: row.tanggal,
    jam: row.jam,
    status: row.status,
    bulan: row.bulan,
  };
}

// ============================================================================
// KARYAWAN
// ============================================================================

// Ambil data karyawan dari 1 kategori saja (EMP / TR / DW)
export async function getEmployeesByCategory(
  category: Category
): Promise<Employee[]> {
  const rows = await prisma.employee.findMany({
    where: { category },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(mapEmployee);
}

// Ambil semua data karyawan dari SEMUA kategori sekaligus (Karyawan + Training + DW).
// Urutan kategori sengaja EMP -> TR -> DW (bukan alfabetis).
export async function getEmployees(): Promise<Employee[]> {
  let result: Employee[] = [];
  for (const category of CATEGORIES) {
    result = result.concat(await getEmployeesByCategory(category));
  }
  return result;
}

// Tambah karyawan baru. ID di-generate otomatis berdasarkan kategori,
// contoh: EMP001, TR001, DW001.
export async function addEmployee(
  category: Category,
  nama: string,
  departemen: string
): Promise<AddEmployeeResult> {
  return withLock(category, async () => {
    if (!nama || String(nama).trim() === "") {
      return { status: "error", message: "Nama wajib diisi" };
    }

    const maxNumber = await getMaxIdNumber(category);
    const newId = category + String(maxNumber + 1).padStart(3, "0");

    await prisma.employee.create({
      data: {
        id: newId,
        nama: nama.trim(),
        departemen: departemen || "",
        status: "AKTIF",
        category,
      },
    });

    return { status: "success", message: "Berhasil ditambahkan", id: newId, nama };
  });
}

// Tambah banyak karyawan sekaligus (1 departemen sama, nama berbeda-beda).
// ID tetap dibuat berbeda & berurutan untuk masing-masing orang.
export async function bulkAddEmployee(
  category: Category,
  namas: string[],
  departemen: string
): Promise<{ status: string; message: string; added: Employee[] }> {
  return withLock(category, async () => {
    if (!Array.isArray(namas) || namas.length === 0) {
      return { status: "error", message: "Daftar nama kosong", added: [] };
    }

    const cleanNamas = namas.map((n) => String(n).trim()).filter((n) => n.length > 0);
    if (cleanNamas.length === 0) {
      return { status: "error", message: "Daftar nama kosong setelah dibersihkan", added: [] };
    }

    let nextNumber = (await getMaxIdNumber(category)) + 1;
    const rows: { id: string; nama: string; departemen: string; status: string; category: string }[] = [];
    const added: Employee[] = [];

    for (const nama of cleanNamas) {
      const newId = category + String(nextNumber).padStart(3, "0");
      rows.push({ id: newId, nama, departemen: departemen || "", status: "AKTIF", category });
      added.push({ id: newId, nama, departemen: departemen || "", status: "AKTIF", category });
      nextNumber++;
    }

    await prisma.employee.createMany({ data: rows });

    return {
      status: "success",
      message: added.length + " orang berhasil ditambahkan",
      added,
    };
  });
}

// Edit 1 orang dari kategori terkait. ID TIDAK berubah.
// Riwayat transaksi lama TIDAK ikut ter-update (tetap catatan historis apa adanya).
export async function editEmployee(
  category: Category,
  rawId: string,
  nama: string,
  departemen: string
): Promise<{ status: string; message: string }> {
  const id = normalizeId(rawId);
  return withLock(id, async () => {

    if (!nama || String(nama).trim() === "") {
      return { status: "error", message: "Nama wajib diisi" };
    }

    const result = await prisma.employee.updateMany({
      where: { id, category },
      data: { nama: nama.trim(), departemen: departemen || "" },
    });

    if (result.count === 0) {
      return { status: "error", message: "ID tidak ditemukan" };
    }
    return { status: "success", message: "Data berhasil diubah" };
  });
}

// Nonaktifkan/Aktifkan sementara 1 orang. Orang berstatus NONAKTIF tetap ada
// datanya, tapi kalau di-scan akan ditolak (lihat submitScan di bawah).
export async function toggleEmployeeStatus(
  category: Category,
  rawId: string
): Promise<{ status: string; message: string; newStatus?: string }> {
  const id = normalizeId(rawId);
  return withLock(id, async () => {

    const existing = await prisma.employee.findFirst({ where: { id, category } });
    if (!existing) {
      return { status: "error", message: "ID tidak ditemukan" };
    }

    const currentStatus = String(existing.status || "AKTIF").trim().toUpperCase();
    const newStatus = currentStatus === "NONAKTIF" ? "AKTIF" : "NONAKTIF";

    await prisma.employee.updateMany({
      where: { id, category },
      data: { status: newStatus },
    });

    return { status: "success", message: "Status berhasil diubah menjadi " + newStatus, newStatus };
  });
}

// Hapus 1 orang dari kategori terkait.
export async function deleteEmployee(
  category: Category,
  rawId: string
): Promise<{ status: string; message: string }> {
  const id = normalizeId(rawId);

  const result = await prisma.employee.deleteMany({ where: { id, category } });
  if (result.count === 0) {
    return { status: "error", message: "ID tidak ditemukan" };
  }
  return { status: "success", message: "Data berhasil dihapus" };
}

// ============================================================================
// SCAN & TRANSAKSI
// ============================================================================

// Logic utama scan QR. Karena ID bisa dari kategori manapun (EMP/TR/DW), kategori
// dideteksi dulu dari prefix ID, baru dicocokkan ke data master yang sesuai.
//
// Pakai withLock supaya kalau 2 request scan untuk ID yang sama datang nyaris
// bersamaan, keduanya diproses berurutan — mencegah keduanya lolos sebagai
// "belum scan hari ini" secara bersamaan.
export async function submitScan(rawId: string, scannerId: string | null = null): Promise<ScanResult> {
  const id = normalizeId(rawId);
  return withLock(id, async () => {
    const now = new Date();
    const tanggalSekarang = formatTanggal(now);
    const jamSekarang = formatJam(now);
    const bulanLabel = getCurrentMonthLabel(now);

    const category = getCategoryFromId(id);

    let info: { nama: string; departemen: string; status: string } | null = null;
    if (category) {
      const row = await prisma.employee.findFirst({ where: { id, category } });
      if (row) {
        info = {
          nama: row.nama,
          departemen: row.departemen || "",
          status: String(row.status || "AKTIF").trim().toUpperCase(),
        };
      }
    }

    // ID tidak dikenali sama sekali (prefix tidak cocok kategori manapun, atau
    // tidak ada di data master kategori tersebut)
    if (!category || !info) {
      await prisma.transaction.create({
        data: {
          employeeId: id,
          nama: "TIDAK DIKENAL",
          departemen: "N/A",
          tanggal: tanggalSekarang,
          jam: jamSekarang,
          status: "TIDAK DIKENAL",
          bulan: bulanLabel,
          scannerId,
        },
      });
      return { status: "error", message: "QR Code tidak dikenali" };
    }

    // Karyawan ada, tapi sedang dinonaktifkan sementara oleh admin
    if (info.status === "NONAKTIF") {
      await prisma.transaction.create({
        data: {
          employeeId: id,
          nama: info.nama,
          departemen: info.departemen,
          tanggal: tanggalSekarang,
          jam: jamSekarang,
          status: "NONAKTIF",
          bulan: bulanLabel,
          scannerId,
        },
      });
      return { status: "error", message: "QR Code ini sedang dinonaktifkan sementara" };
    }

    // Cek apakah sudah scan BERHASIL hari ini (cukup cek di bulan berjalan saja,
    // karena "hari ini" pasti berada di dalam bulan berjalan)
    const existing = await prisma.transaction.findFirst({
      where: {
        employeeId: id,
        tanggal: tanggalSekarang,
        status: "BERHASIL",
        bulan: bulanLabel,
      },
      select: { jam: true },
    });

    let statusBaru: string;
    let resultStatus: ScanResult["status"];
    let resultMessage: string;
    let jamBerhasil: string | undefined;

    if (existing) {
      statusBaru = "DUPLIKAT";
      resultStatus = "failed";
      resultMessage = "Jatah makan hari ini sudah habis";
      jamBerhasil = existing.jam;
    } else {
      statusBaru = "BERHASIL";
      resultStatus = "success";
      resultMessage = "Selamat Makan!";
    }

    await prisma.transaction.create({
      data: {
        employeeId: id,
        nama: info.nama,
        departemen: info.departemen,
        tanggal: tanggalSekarang,
        jam: jamSekarang,
        status: statusBaru,
        bulan: bulanLabel,
        scannerId,
      },
    });

    return {
      status: resultStatus,
      message: resultMessage,
      nama: info.nama,
      jam: jamSekarang,
      jamBerhasil,
    };
  });
}

// Reset jatah makan hari ini untuk 1 karyawan (ubah status BERHASIL hari ini
// menjadi DIRESET, supaya orang itu bisa scan ulang hari ini)
export async function resetTodayQuota(
  rawId: string
): Promise<{ status: string; message: string }> {
  const id = normalizeId(rawId);
  return withLock(id, async () => {
    const now = new Date();
    const tanggalSekarang = formatTanggal(now);
    const bulanLabel = getCurrentMonthLabel(now);

    const result = await prisma.transaction.updateMany({
      where: {
        employeeId: id,
        tanggal: tanggalSekarang,
        status: "BERHASIL",
        bulan: bulanLabel,
      },
      data: { status: "DIRESET" },
    });

    if (result.count === 0) {
      return { status: "error", message: "Tidak ada transaksi berhasil hari ini untuk direset" };
    }
    return { status: "success", message: `Jatah hari ini berhasil direset (${result.count} riwayat diupdate)` };
  });
}

// Ambil semua riwayat transaksi.
// month: nama bulan saja, contoh "Juli". Kosong/undefined = semua bulan.
// year: 4 digit, contoh "2026". Kosong/undefined = semua tahun.
// departemen: nama departemen persis (case-insensitive), contoh "IT". Kosong/undefined = semua departemen.
export async function getTransactions(
  month?: string,
  year?: string,
  departemen?: string
): Promise<Transaction[]> {
  const monthFilter = (month || "").trim();
  const yearFilter = (year || "").trim();
  const deptFilter = (departemen || "").trim().toLowerCase();

  // Data 1 hotel realistis cuma ribuan baris per tahun — filter bulan/tahun/departemen
  // dilakukan di JS (bukan raw SQL) supaya perbandingan case-insensitive & parsing label
  // bulan konsisten dengan getMonths(), tanpa perlu query SQL yang rumit.
  const rows = await prisma.transaction.findMany({ orderBy: { id: "asc" } });

  const result: Transaction[] = [];
  for (const row of rows) {
    const parsed = parseMonthLabel(row.bulan);
    if (monthFilter && parsed.month !== monthFilter) continue;
    if (yearFilter && parsed.year !== yearFilter) continue;
    if (deptFilter && row.departemen.toLowerCase() !== deptFilter) continue;
    result.push(mapTransaction(row));
  }
  return result;
}

// Ambil daftar label bulan transaksi yang tersedia (untuk dropdown filter bulan),
// diurutkan dari yang paling baru (secara kronologis asli, bukan alfabetis).
export async function getMonths(): Promise<string[]> {
  const rows = await prisma.transaction.findMany({
    distinct: ["bulan"],
    select: { bulan: true },
  });

  const labels = rows.map((r) => r.bulan).filter(Boolean);

  return labels.sort((a, b) => {
    const pa = parseMonthLabel(a);
    const pb = parseMonthLabel(b);
    const ya = Number(pa.year) || 0;
    const yb = Number(pb.year) || 0;
    if (ya !== yb) return yb - ya; // tahun terbaru dulu
    return BULAN_INDO.indexOf(pb.month) - BULAN_INDO.indexOf(pa.month); // bulan terbaru dulu
  });
}
