// Prisma 7 memindahkan konfigurasi koneksi database (untuk kebutuhan CLI:
// `prisma migrate`, `prisma studio`, dst) ke file ini — terpisah dari
// schema.prisma. File ini HANYA dipakai oleh Prisma CLI, bukan oleh aplikasi
// saat runtime (aplikasi konek lewat driver adapter di src/lib/db.ts).
//
// Sengaja load ".env.local" secara eksplisit (bukan ".env" default punya
// dotenv), supaya konsisten dengan konvensi Next.js yang dipakai project ini.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
