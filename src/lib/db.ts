// Satu instance PrismaClient dipakai bersama di seluruh aplikasi.
//
// CATATAN PRISMA 7: sejak Prisma 7, PrismaClient tidak lagi otomatis konek ke
// database lewat `url` di schema.prisma — sekarang WAJIB pakai "driver
// adapter" yang di-pasang eksplisit di sini. Untuk SQLite, adapter resminya
// adalah @prisma/adapter-better-sqlite3 (dipasang lewat npm, lihat
// package.json). Konfigurasi database untuk keperluan CLI (migrate/studio)
// ada di file terpisah: prisma.config.ts di root project.
//
// Kenapa perlu singleton begini (bukan `new PrismaClient()` langsung di tiap
// file)? Next.js dev mode me-reload module setiap kali ada perubahan kode
// (hot reload), dan (terbukti lewat testing di Tahap 1) Next.js juga bisa
// mem-bundle tiap API route ke chunk terpisah bahkan di production. Trik
// `globalThis` di bawah memastikan SATU instance yang sama dipakai ulang di
// semua route, baik di development maupun production.
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

console.log("DATABASE_URL:", connectionString);

if (!connectionString) {
  throw new Error("DATABASE_URL tidak terbaca di runtime Next.js");
}

const adapter = new PrismaBetterSqlite3({
  url: connectionString,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

globalForPrisma.prisma = prisma;

prisma.$connect()
  .then(() => console.log("DATABASE CONNECTED"))
  .catch((err) => console.error("DATABASE CONNECTION ERROR:", err));