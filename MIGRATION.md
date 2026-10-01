# Migrasi ke Lokal (Next.js + Prisma + SQLite + Excel)

Dikerjakan bertahap sesuai rencana:

- Tahap 1 (selesai) — Semua logic bisnis dipindah dari Google Apps Script ke
  dalam Next.js sendiri (native TypeScript), pakai penyimpanan sementara di
  memori.
- Tahap 2 (selesai) — Penyimpanan di memori diganti Prisma + SQLite. Data
  sekarang PERMANEN, tidak hilang lagi saat server di-restart.
- Tahap 3 (selesai) — Ditambah kemampuan export laporan ke Excel (`.xlsx`)
  lewat ExcelJS, sebagai pengganti "buka langsung di Google Sheets".

## Apa yang berubah di Tahap 3

File baru:
- `src/lib/excel.ts` — bikin file Excel dari data transaksi, warna baris
  otomatis mengikuti status (hijau=BERHASIL, merah=DUPLIKAT, dst), mirip
  conditional formatting yang dulu ada di Google Sheets.
- `src/app/api/export/excel/route.ts` — endpoint download, terima filter
  `?month=&year=&departemen=` sama persis seperti `/api/transactions`.

Halaman Dashboard: ditambah 1 tombol baru **"Download Excel"** di samping
tombol "Download PDF" yang sudah ada, mengikuti filter yang sedang aktif di
layar (bulan/tahun/departemen).

## Perbaikan penting yang ditemukan & dibetulkan di Tahap 3

Dua hal signifikan ketemu lewat testing sebelum dikirim — dua-duanya
langsung dibetulkan:

**1. Breaking change Prisma 7.** Versi Prisma yang ter-install (7.x) ternyata
mengubah cara koneksi database secara fundamental: `url` di dalam
`schema.prisma` sudah tidak didukung lagi, harus pindah ke file
`prisma.config.ts` (baru, ada di root project) dan `PrismaClient` sekarang
wajib pakai "driver adapter" (paket `@prisma/adapter-better-sqlite3`) yang
dipasang eksplisit di `src/lib/db.ts`, bukan otomatis dari schema lagi.
Sudah disesuaikan semua.

**2. Bug build "client vs server" akibat native module.** Karena
`better-sqlite3` (dipakai driver adapter Prisma) adalah modul native yang
cuma bisa jalan di server (bukan di browser), sementara 2 halaman
(`src/app/admin/employees/page.tsx` dan `src/app/admin/dashboard/page.tsx`)
sebelumnya ikut meng-import beberapa constant/types (`CATEGORY_LABELS`,
`DEPARTMENTS`, dst) langsung dari `src/lib/sheets.ts` yang sama — akibatnya
Next.js mencoba membundel kode server-only itu untuk browser juga dan build
gagal total. **Diperbaiki dengan memisahkan types & constants ke file baru
`src/lib/canteen-shared.ts`** (tidak ada import Prisma sama sekali di file
itu), lalu `sheets.ts` meng-export-ulang semuanya dari sana (supaya semua API
route tetap tidak perlu diubah), dan 2 halaman client tadi diarahkan import
langsung dari `canteen-shared.ts`. **Ini satu-satunya perubahan yang
menyentuh isi halaman frontend selama seluruh migrasi** — dan sifatnya cuma
ganti 1 baris sumber import, bukan logic apapun.

## WAJIB dilakukan sebelum menjalankan

```
npm install
```

Perintah di atas otomatis menjalankan `prisma generate` lewat script
`postinstall`.

```
cp .env.local.example .env.local
# edit .env.local, isi ADMIN_USERNAME & ADMIN_PASSWORD sesuai mau kamu
# DATABASE_URL sudah diisi default, tidak perlu diubah kecuali mau lokasi lain

npx prisma migrate dev --name init
```

Perintah terakhir membuat file database `prisma/dev.db` beserta seluruh
tabelnya. Hanya perlu dijalankan sekali di awal (dan lagi setiap kali
`schema.prisma` diubah di masa depan).

Setelah itu:

```
npm run dev
```

Buka `http://localhost:3000/admin/login`, coba tambah karyawan, scan QR,
lalu ke Dashboard klik **Download Excel** — file `.xlsx` akan ke-download,
buka pakai Microsoft Excel / Google Sheets / LibreOffice, datanya sudah
berwarna sesuai status.

## Melihat isi database secara visual (opsional)

```
npm run db:studio
```

Membuka `http://localhost:5555`, GUI bawaan Prisma untuk lihat/edit isi
tabel `employees` dan `transactions` langsung (untuk debug, bukan pengganti
halaman admin aplikasi).

## Testing yang sudah dilakukan sebelum file ini dikirim

Karena sandbox tempat aku bekerja diblokir aksesnya ke server unduh binary
engine Prisma (jaringan sandbox, bukan masalah di project atau di
komputermu), validasi dilakukan berlapis:

1. Type-check penuh (`tsc --noEmit`) di seluruh project, dengan definisi tipe
   Prisma Client + driver adapter yang dibuat manual (mencerminkan
   `schema.prisma` persis) disuntikkan sementara — bersih total, tidak ada
   error (satu warning CSS import di `layout.tsx` adalah false-positive
   standar Next.js, file itu tidak disentuh).
2. Test logic otomatis (13 skenario, termasuk race condition 10 scan
   bersamaan) dijalankan pakai `node:sqlite` native dengan skema tabel persis
   sama seperti `schema.prisma` — semua lulus.
3. **`next build` (production build) dijalankan sungguhan sampai selesai**,
   termasuk dengan Prisma Client stub yang benar-benar punya file runtime
   (bukan cuma definisi tipe) untuk memvalidasi seluruh proses bundling
   —berhasil 100%, semua 8 API route tetap terdeteksi dinamis (bukan
   ke-cache statis, mengonfirmasi ulang fix dari Tahap 1), semua halaman
   ter-compile termasuk yang tadinya gagal karena masalah native module di
   atas.
4. Test ExcelJS end-to-end (bikin file, baca ulang, verifikasi isi sel &
   warna) terhadap `exceljs` yang sungguhan ter-install — berhasil,
   dikonfirmasi lewat pembacaan ulang file `.xlsx` yang dihasilkan.

Yang BELUM bisa diuji langsung: `prisma generate`/`migrate dev` yang
sungguhan (karena binary-nya tidak bisa diunduh di sandbox ini). Wajib kamu
coba sendiri lewat langkah "WAJIB dilakukan" di atas — kabari kalau ada error
yang muncul.

## Kalau ada error saat setup

- Error saat `npm install` soal Prisma engine — biasanya soal
  koneksi/firewall, coba jalankan lagi atau cek koneksi internet.
- `npx prisma migrate dev` gagal — pastikan `.env.local` sudah ada dan
  `DATABASE_URL` terisi.
- Error "Module not found: fs" atau sejenisnya saat `npm run build` —
  kemungkinan ada halaman client baru yang import fungsi/constant dari
  `@/lib/sheets` secara langsung; pindahkan importnya ke
  `@/lib/canteen-shared` kalau yang dibutuhkan cuma types/constants (bukan
  fungsi yang menyentuh database).
- Data hilang setelah restart — berarti masih pakai Tahap 1, cek
  `src/lib/sheets.ts` harus ada `import { prisma } from "@/lib/db"`.

## Status

Semua 3 tahap migrasi sudah selesai. Google Apps Script + Google Sheets
sudah tidak dipakai sama sekali — aplikasi sepenuhnya lokal: Next.js + SQLite
+ export Excel/PDF. File Apps Script lama (`apps-script/Code.gs`,
`apps_script_canteen_v4.gs`) masih ada di repo sebagai referensi historis,
boleh dihapus kapan saja.
