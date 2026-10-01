// Types & constants murni — TIDAK ADA import ke Prisma/database sama sekali
// di file ini. Sengaja dipisah dari src/lib/sheets.ts supaya halaman client
// component (yang jalan di browser, misal src/app/admin/employees/page.tsx)
// bisa import Category/Employee/CATEGORY_LABELS/dst TANPA ikut menyeret kode
// server-only (Prisma, better-sqlite3) ke dalam bundle browser.
//
// Kenapa ini penting: better-sqlite3 pakai native binding (butuh `fs`, dsb)
// yang cuma bisa jalan di Node.js, bukan di browser. Kalau halaman client
// import langsung dari sheets.ts (yang di baris atasnya ada
// `import { prisma } from "@/lib/db"`), Next.js akan mencoba membundel
// SELURUH module itu untuk browser juga — dan build akan gagal karena
// better-sqlite3 tidak bisa jalan di sana.
//
// src/lib/sheets.ts tetap meng-export ulang (re-export) semua yang ada di
// sini, jadi SEMUA API route yang sudah ada tetap `import { ... } from
// "@/lib/sheets"` seperti biasa tanpa perlu diubah.

export type Category = "EMP" | "TR" | "DW";

export const CATEGORY_LABELS: Record<Category, string> = {
  EMP: "Karyawan",
  TR: "Training",
  DW: "Daily Worker",
};

export const CATEGORIES: Category[] = ["EMP", "TR", "DW"];

export type Employee = {
  id: string;
  nama: string;
  departemen?: string;
  category?: Category;
  status?: string;
};

export type Transaction = {
  id: string;
  nama: string;
  departemen: string;
  tanggal: string;
  jam: string;
  status: string;
  bulan: string;
  scannerId?: string | null;
};

export type ScanResult = {
  status: "success" | "failed" | "error";
  message: string;
  nama?: string;
  jam?: string;
  jamBerhasil?: string;
};

export type AddEmployeeResult = {
  status: string;
  message: string;
  id?: string;
  nama?: string;
};

// Daftar departemen tetap yang tersedia di hotel (dipakai di dropdown Add & Bulk Add)
export const DEPARTMENTS = [
  "IT", "FO", "Styling", "B&F", "Engineering", "Kitchen",
  "Sales", "HR", "Finance", "LP", "Spa", "Reservation", "Event",
];
