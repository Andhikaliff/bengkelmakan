# Bengkel Makan Management System

Website lokal berbasis SQLite untuk mengelola jatah makan karyawan kantin hotel menggunakan sistem scan QR Code.

## Cara Kerja Singkat

- **3 Kategori Pengguna**: **Karyawan (EMP)**, **Training (TR)**, dan **Daily Worker (DW)**.
- **Generate QR Code**: Setiap orang punya QR Code unik (contoh `EMP001`, `TR001`, `DW001`) yang dibuat secara otomatis oleh sistem saat data ditambahkan melalui halaman Direktori (Employee Management).
- **Proses Scan**: QR Code dipindai di tablet kantin (halaman `/scanner`) menggunakan kamera bawaan. Sistem otomatis mendeteksi kategori dan memvalidasi ke database.
- **Batasan Harian**: Setiap QR Code hanya bisa sukses dipindai 1 kali dalam sehari. Jika di-scan lagi di hari yang sama, akan muncul status **DUPLIKAT**.
- **Transaksi Terpusat**: Semua scan dicatat di satu database (`prisma/dev.db`), sehingga laporan dan sisa jatah harian mudah dipantau secara *real-time*.
- **Multi-Role (Keamanan)**: Halaman aplikasi dilindungi login dengan 3 tingkat hak akses (ADMIN, DATA, SCANNER).

## Fitur-Fitur Utama

1. **Dashboard & Transaksi (`/admin/dashboard`)**:
   - Pemantauan scan secara live dengan fitur Auto-Refresh (bisa diatur lewat menu Settings).
   - Tabel riwayat transaksi dengan filter (Tanggal, Bulan, Tahun, Departemen, Kategori).
   - Export data ke file Excel (.xlsx).
2. **Direktori Karyawan (`/admin/employees`)**:
   - Tambah karyawan (Satu per satu atau *Bulk Add*).
   - Edit, Nonaktifkan sementara, Hapus data.
   - Fitur "Reset Jatah Hari Ini" untuk karyawan tertentu (misal salah scan).
   - Download QR Code individu.
   - Cetak massal (Generate PDF) Kartu ID Card lengkap dengan QR untuk semua karyawan yang dipilih.
3. **Scanner Kantin (`/scanner`)**:
   - Tampilan pemindai barcode/QR *full-screen*.
   - Suara khusus (Sukses/Gagal) yang volumenya bisa diatur.
   - Peringatan visual (Warna Hijau/Merah) menyesuaikan hasil scan.
4. **Settings Panel (Pengaturan)**:
   - **Mode Gelap / Terang (Dark Mode)**: Tampilan bawaan adalah terang (Light Mode). Dark Mode dapat diaktifkan manual lewat ikon gerigi.
   - **Auto-Refresh**: Otomatis memperbarui tabel dashboard.
   - **Suara Scanner**: Mengatur volume dan mematikan/menghidupkan efek suara scan.

## 0. Role & Akses

Terdapat 3 tingkatan peran (Role):
- **ADMIN**: Akses penuh ke seluruh sistem (Dashboard, Kelola Karyawan, Settings, Scanner).
- **DATA**: Akses mengelola Karyawan dan melihat Dashboard (tanpa akses ke Scanner).
- **SCANNER**: Hanya akses ke halaman Scanner kantin.

## 1. Deploy ke Windows Server

> Website berjalan dengan Node.js, Next.js production, dan SQLite. Database berada pada file yang ditentukan `DATABASE_URL` (default `prisma/dev.db`). Jangan commit `.env.local`, file database, backup, log, atau binary tool.

### Aplikasi yang dibutuhkan

- **Wajib di PC pengembang**: [Git for Windows](https://git-scm.com/download/win), [Node.js 22 LTS](https://nodejs.org/en/download) (npm sudah termasuk), dan PowerShell. VS Code opsional.
- **Wajib di PC server**: Windows 10/11 atau Windows Server yang didukung, Git for Windows, Node.js 22 LTS (npm sudah termasuk), dan PowerShell. Akun administrator diperlukan untuk memasang Windows Service dan Scheduled Task.
- **Wajib untuk auto-start**: NSSM (`nssm.exe`).
- **Opsional**: Caddy (`caddy.exe`) jika tablet/perangkat lain perlu mengakses aplikasi melalui port 80; browser pada komputer admin dan tablet.
- **Opsional**: SMTP untuk laporan email. Prisma Studio sudah termasuk dependency project; tidak perlu memasang aplikasi database terpisah.

Verifikasi Git dan Node.js dari PowerShell:

```powershell
git --version
node --version
npm --version
```

Gunakan Node.js 22 LTS pada komputer pengembang dan server agar paket native SQLite dan Next.js memakai runtime yang didukung.

### Push kode ke GitHub pertama kali

Langkah ini dilakukan pada komputer pengembang sebelum clone di server.

1. Buat repository baru di GitHub. Repository private disarankan untuk aplikasi internal. Buat repository kosong tanpa README, `.gitignore`, atau license tambahan.
2. Dari PowerShell di root folder project, inisialisasi Git dan periksa file rahasia yang diabaikan:

   ```powershell
   git init -b main
   git check-ignore -v .env.local prisma/dev.db tools/nssm.exe tools/caddy.exe
   git add .
   git status --short
   ```

   Pastikan `.env.local`, database, log, backup, dan file `.exe` tidak muncul sebagai file staged. `.env.local.example` boleh di-commit hanya jika isinya placeholder, bukan kredensial aktif.

3. Commit dan hubungkan ke repository GitHub:

   ```powershell
   git commit -m "Initial project setup"
   git remote add origin https://github.com/USERNAME/NAMA-REPOSITORY.git
   git push -u origin main
   ```

   Ganti URL dengan URL repository Anda. Jangan masukkan token/password ke URL atau file proyek. Bila kredensial pernah diunggah sebelumnya, revoke/ganti kredensial itu; menghapusnya dari versi terbaru tidak menghapusnya dari riwayat commit.

   Jika Git meminta nama/email commit, atur identitas Git (gunakan email yang sesuai akun GitHub):

   ```powershell
   git config --global user.name "Nama Anda"
   git config --global user.email "email-anda@example.com"
   ```

### Clone dan siapkan

1. Masuk ke Windows Server menggunakan akun administrator, buka PowerShell, lalu clone repository. Ganti URL GitHub dengan milik Anda:

   ```powershell
   Set-Location C:\
   git clone <URL_REPOSITORY_GITHUB> "C:\Bengkel Makan\Main"
   Set-Location "C:\Bengkel Makan\Main"
   ```

   Semua script menghitung folder project dari lokasinya, jadi repo juga dapat berada di folder lain.

2. Buat folder tools dari root project:

   ```powershell
   New-Item -ItemType Directory -Force .\tools
   ```

   Unduh NSSM dari `https://nssm.cc/download`, ekstrak arsip, lalu salin `win64\nssm.exe` (atau `win32\nssm.exe` untuk Windows 32-bit) ke `tools\nssm.exe`. Jika memakai Caddy, unduh binary Windows dari `https://caddyserver.com/download` dan letakkan di `tools\caddy.exe`. Binary sengaja tidak disimpan di GitHub. Jika Node.js tidak tersedia di PATH, letakkan `node.exe` di `tools\node.exe`.
3. Buat konfigurasi rahasia lokal, lalu isi akun dan hash password sesuai bagian berikut:

   ```powershell
   Copy-Item .env.local.example .env.local
   notepad .env.local
   ```

   Default database adalah `file:./prisma/dev.db`. `BACKUP_DIR=../Backups` membuat folder backup di sebelah folder project, bukan di dalam repository.

4. Dari PowerShell pada root project, pasang dependency, buat client Prisma, terapkan migrasi, dan build:

   ```powershell
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   ```

   `migrate deploy` membuat tabel dari migrasi yang ada; jangan gunakan `db push` untuk setup server produksi.

5. Uji aplikasi sebelum mendaftarkannya sebagai service. Jalankan `npm run start -- -H 127.0.0.1` di PowerShell, buka `http://localhost:3000/admin/login`, lalu hentikan server dengan `Ctrl+C`.

### Hash password yang benar

Password tidak disimpan sebagai teks biasa. Buat hash satu per satu dari PowerShell; prompt meminta password tanpa memasukkannya ke command history:

```powershell
node -e 'const c=require("crypto"),r=require("readline").createInterface({input:process.stdin,output:process.stdout});r.question("Password baru: ",p=>{const s=c.randomBytes(16).toString("hex");console.log("scrypt$"+s+"$"+c.scryptSync(p,s,64).toString("hex"));r.close()})'
```

Salin hasil `scrypt$...$...` ke variabel role yang sesuai di `.env.local`, misalnya `ADMIN_PASSWORD_HASH="scrypt$...$..."`. Pakai tanda `$` literal tanpa backslash; parser `.env.local` tidak memerlukan escape. Untuk scanner tambahan, pasangkan `SCANNER_01_USERNAME` dengan `SCANNER_01_PASSWORD_HASH` dan seterusnya. Jangan memakai nilai contoh dari repository sebagai password produksi.

Setelah mengubah hash atau variabel runtime, restart service Next.js agar perubahan dibaca. Jangan pernah mengirim file `.env.local` ke GitHub.

### Pasang auto-start service

Script menggunakan `tools\nssm.exe`, `tools\caddy.exe`, dan `Caddyfile` di root project. `Caddyfile` bawaan menerima HTTP pada port 80 dan meneruskan request ke Next.js pada `127.0.0.1:3000`. Next.js sendiri tidak dibuka langsung ke jaringan. Caddy opsional jika aplikasi hanya diakses di server; untuk akses tablet di LAN, pasang Caddy lalu izinkan inbound TCP port 80 pada Windows Firewall hanya untuk jaringan lokal. Konfigurasi bawaan ini HTTP, bukan HTTPS publik.

Buka PowerShell **Run as Administrator**, lalu jalankan:

```powershell
Set-Location "C:\Bengkel Makan\Main"
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install-services.ps1
```

Service Next.js berjalan pada `127.0.0.1:3000` dan otomatis dimulai saat Windows boot. Caddy ikut dipasang hanya jika `tools\caddy.exe` ditemukan. Script install menghapus service bernama sama sebelum memasangnya ulang. Perintah pemeriksaan:

```powershell
Get-Service BengkelMakan
Get-Service BengkelMakanCaddy -ErrorAction SilentlyContinue
Get-Content .\logs\nextjs-stderr.log -Tail 50
Get-Content .\logs\caddy-stderr.log -Tail 50
```

Jika menggunakan Caddy, izinkan port 80 hanya dari subnet lokal lewat PowerShell **Run as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Bengkel Makan HTTP LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -RemoteAddress LocalSubnet
```

Buka dari perangkat LAN melalui `http://ALAMAT-IP-SERVER/admin/login` (contoh `http://192.168.1.10/admin/login`). Pastikan komputer server dan tablet berada di jaringan yang sama. Jangan buka port 3000, SQLite, atau SMTP inbound ke internet. Untuk domain/HTTPS publik, siapkan DNS, sertifikat, dan aturan firewall/reverse proxy secara khusus.

Jika memakai backup otomatis, daftarkan juga task (Administrator):

```powershell
.\scripts\setup-backup-schedule.ps1
```

Task backup berjalan tiap 6 jam sebagai `SYSTEM`. Task laporan email dipasang terpisah melalui `scripts\setup-email-report-schedule.ps1`; konfigurasi SMTP dijelaskan di bagian laporan email.

Untuk melepas service, jalankan `scripts\uninstall-services.ps1` sebagai Administrator. Ini tidak menghapus database, backup, atau log.

### Memperbarui aplikasi setelah ada perubahan di GitHub

Backup database terlebih dahulu. Dari PowerShell Administrator pada server:

```powershell
Set-Location "C:\Bengkel Makan\Main"
node .\scripts\backup.js
Stop-Service BengkelMakan
git pull --ff-only
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
Start-Service BengkelMakan
```

Jika build gagal, periksa error dan jangan menganggap update berhasil. File `.env.local`, database, log, backup, dan binary dalam `tools` tidak berubah oleh `git pull` selama tidak pernah di-track.

## 2. Backup, Lihat, Ambil Laporan, dan Restore

Backup dibuat oleh SQLite Online Backup API, sehingga aman walau aplikasi sedang aktif. File backup bernama `dev_YYYY-MM-DD_HHmmss.db`; log ada di `scripts\backup.log`. Retensi default 30 hari.

Jalankan backup manual dari root project:

```powershell
node .\scripts\backup.js
```

Task otomatis dibuat dengan `scripts\setup-backup-schedule.ps1`. Periksa task atau jalankan sekali sekarang:

```powershell
Get-ScheduledTaskInfo -TaskName "BengkelMakan-DatabaseBackup"
Start-ScheduledTask -TaskName "BengkelMakan-DatabaseBackup"
Get-Content .\scripts\backup.log -Tail 30
```

### Buka backup tanpa mengubah database aktif

Salin backup yang ingin diperiksa ke file sementara di `prisma`, lalu jalankan aplikasi production kedua pada port 3001 dengan `DATABASE_URL` sementara. Server utama tetap menggunakan database aktif di port 3000:

```powershell
Copy-Item "..\Backups\dev_YYYY-MM-DD_HHmmss.db" .\prisma\backup-view.db
$env:DATABASE_URL = "file:./prisma/backup-view.db"
npx next start -H 127.0.0.1 -p 3001
```

Buka `http://localhost:3001/admin/login`, masuk dengan akun dari `.env.local`, lalu gunakan Dashboard dan **Download Excel** untuk membuat laporan dari backup tersebut. Hentikan server sementara dengan `Ctrl+C`, bersihkan variabel dan salinan sementara:

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item .\prisma\backup-view.db
```

File `*.db` diabaikan Git. Jangan arahkan `DATABASE_URL` server utama ke file backup hanya untuk melihat data.

### Restore backup menjadi database aktif

Restore mengganti isi database aktif. Hentikan service Next.js terlebih dahulu agar tidak ada proses yang menulis ke SQLite, lalu jalankan restore dengan path file backup yang dipilih:

```powershell
Stop-Service BengkelMakan
node .\scripts\restore-backup.js "..\Backups\dev_YYYY-MM-DD_HHmmss.db"
Start-Service BengkelMakan
```

Script menolak backup dengan integrity check gagal dan membuat salinan database aktif ke folder backup sebagai `before-restore_*.db` sebelum menggantinya. Pastikan versi aplikasi/skema sesuai dengan waktu backup. Jangan hapus salinan pengaman sampai hasil restore diperiksa.

### Reset database menjadi kosong

Reset menghapus seluruh karyawan, transaksi, audit log, dan user database. Ini bukan cara mengganti password `.env.local`; konfirmasi database/backup benar dan simpan salinan sebelum melanjutkan.

```powershell
Stop-Service BengkelMakan
node .\scripts\backup.js
npx prisma migrate reset --force
Start-Service BengkelMakan
```

Perintah reset menghapus isi database dan menerapkan ulang migrasi tanpa seed data. Akun login yang dikonfigurasi melalui `.env.local` tetap tersedia; data operasional harus dimasukkan kembali. Untuk reset database pada lingkungan development, jangan jalankan perintah ini pada server produksi.

## 3. Troubleshooting Windows

- **Script ditolak karena execution policy**: buka PowerShell Administrator dan jalankan `Set-ExecutionPolicy -Scope Process Bypass` pada jendela yang sama, lalu ulangi script. Pengaturan ini hanya berlaku untuk sesi PowerShell tersebut.
- **NSSM tidak ditemukan**: pastikan file berada di `tools\nssm.exe` di root repository. Folder/path sekarang dihitung dari lokasi script, bukan dari drive tertentu.
- **Node.js tidak ditemukan**: pasang Node.js LTS dan buka ulang PowerShell agar PATH terbarui, atau letakkan `node.exe` di `tools\node.exe`.
- **Service Next.js gagal start**: cek `.\logs\nextjs-stderr.log`, pastikan `npm run build` selesai sukses dan `.env.local` ada di root project. Periksa apakah port 3000 sudah dipakai dengan `Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue`.
- **Caddy tidak start / port 80 sibuk**: cek `.\logs\caddy-stderr.log`, pastikan `tools\caddy.exe` dan `Caddyfile` ada, lalu cek port dengan `Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue`. Caddy bisa dilewati dengan tidak memasang `caddy.exe`.
- **Task backup gagal saat dijalankan sebagai SYSTEM**: periksa `Get-ScheduledTaskInfo -TaskName "BengkelMakan-DatabaseBackup"` dan `scripts\backup.log`; pastikan `DATABASE_URL` menunjuk ke database yang ada serta SYSTEM dapat membaca database dan menulis ke `BACKUP_DIR`. Jalankan `node .\scripts\backup.js` manual untuk melihat error langsung.
- **Backup/restore melaporkan integrity check gagal atau database terkunci**: pilih file backup lain yang berhasil dibuat; untuk restore, hentikan service Next.js dahulu dan pastikan tidak ada proses aplikasi lain yang membuka database.
- **Login gagal setelah mengganti password**: hash harus berbentuk `scrypt$<salt>$<hash>` dengan `$` literal, tanpa `\$`. Pastikan nama variabel cocok dengan username, lalu jalankan `Restart-Service BengkelMakan`.
- **Jangan pakai `migrate reset` untuk melihat backup**: gunakan langkah “Buka backup tanpa mengubah database aktif”. Reset menghapus data aktif.

## 4. Pengaturan Password dan Lingkungan

Buka `.env.local` untuk mengatur `DATABASE_URL`, nama user, hash password, `CRON_SECRET`, dan SMTP. File ini lokal dan tidak boleh di-commit.

Jika kredensial SMTP yang pernah ada pada versi template sebelumnya adalah kredensial sungguhan, revoke App Password itu di provider, buat yang baru, dan masukkan hanya ke `.env.local`. Templat yang sekarang hanya berisi placeholder.

## 5. Laporan Otomatis melalui Email (SMTP)

Endpoint laporan menggunakan SMTP melalui Nodemailer. Pengiriman dipicu oleh Windows Task Scheduler, jadi server aplikasi harus tetap aktif. Aplikasi tidak membutuhkan layanan email masuk atau port SMTP inbound.

### Konfigurasi SMTP

1. Salin `.env.local.example` menjadi `.env.local` jika belum ada, lalu isi konfigurasi berikut. Jangan commit `.env.local` atau menaruh kredensial pada script.

   ```dotenv
   CRON_SECRET=<secret-acak-minimal-32-byte>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=akun-pengirim@gmail.com
   SMTP_PASS=<app-password-dari-provider>
   REPORT_SENDER_NAME="Bengkel Makan System"
   REPORT_RECIPIENTS=penerima1@example.com,penerima2@example.com
   REPORT_CC=
   ```

2. Buat `CRON_SECRET` dari PowerShell di folder project, lalu salin hasilnya ke `.env.local`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Untuk Gmail, aktifkan verifikasi 2 langkah dan buat **App Password** khusus aplikasi. Gunakan App Password pada `SMTP_PASS`, bukan password login Gmail. Untuk penyedia lain, isikan host dan port SMTP yang diberikan penyedia. Port `587` menggunakan STARTTLS (`SMTP_SECURE=false`); port `465` biasanya memakai TLS langsung (`SMTP_SECURE=true`). Jangan membuka koneksi SMTP inbound pada router.

4. Lindungi `.env.local` dengan ACL Windows agar hanya Administrator dan `SYSTEM` (akun service/task pada setup ini) yang dapat membacanya. Jalankan dari PowerShell Administrator di folder project:

   ```powershell
   icacls .env.local /inheritance:r /grant:r "*S-1-5-32-544:(R)" "*S-1-5-18:(R)"
   ```

   Jangan salin isinya ke tiket, log, screenshot, atau repository. Jika kredensial SMTP yang pernah terisi pada file contoh merupakan kredensial nyata, cabut/revoke dan buat kredensial baru.

5. Restart Next.js setelah mengubah env. Untuk memastikan setelan valid, jalankan website production, lalu uji kirim manual dari PowerShell:

   ```powershell
   .\scripts\run-report.ps1
   Get-Content .\scripts\report-task.log -Tail 20
   ```

   Baris `SUCCESS` berarti endpoint menerima dan mengirim laporan harian; tetap periksa inbox, folder spam, dan status pengiriman pada provider SMTP. `FAILED` berisi pesan error untuk troubleshooting.

### Jadwal Otomatis di Windows Server

Script saat ini membuat **satu jadwal laporan harian pukul 07:00** waktu lokal server. Jam tersebut dapat diubah; pengaturan waktu berada di `scripts\setup-email-report-schedule.ps1`, bukan di `.env.local`.

1. Pastikan Next.js production sudah berjalan pada `http://localhost:3000`, `.env.local` telah diisi, dan uji manual di atas berhasil.
2. Buka PowerShell **Run as Administrator**, pindah ke folder project, lalu daftarkan task:

   ```powershell
   .\scripts\setup-email-report-schedule.ps1
   ```

3. Task berjalan sebagai `SYSTEM`, membaca `CRON_SECRET` dari `.env.local` saat dijalankan, dan menulis hasil ke `scripts\report-task.log`. Secret tidak disimpan pada definisi task atau URL di script setup.
4. Uji task dari PowerShell:

   ```powershell
   Start-ScheduledTask -TaskName "BengkelMakan_AutoReport_Daily"
   Get-ScheduledTaskInfo -TaskName "BengkelMakan_AutoReport_Daily"
   Get-Content .\scripts\report-task.log -Tail 20
   ```

5. Di Task Scheduler, periksa **Last Run Result** dan **History** bila task gagal. Jadwal memakai waktu lokal Windows; samakan timezone server dengan zona laporan `Asia/Makassar` agar tanggal laporan konsisten. Jika task sudah pernah dibuat sebelum secret diperbarui, jalankan ulang script setup atau update task agar konfigurasi konsisten.

#### Mengubah Jam Pengiriman

1. Buka `scripts\setup-email-report-schedule.ps1` dan ubah nilai `$ScheduleTime` di bagian konfigurasi. Format waktunya menggunakan format PowerShell 12 jam dengan AM/PM, misalnya:

   ```powershell
   $ScheduleTime = "06:30 PM"
   ```

   Contoh lain: `"07:15 AM"` untuk pukul 07:15 pagi. Jangan memakai format 24 jam seperti `18:30` pada setting ini.

2. Simpan file, lalu jalankan ulang script setup dari PowerShell **Run as Administrator**:

   ```powershell
   .\scripts\setup-email-report-schedule.ps1
   ```

   Script memakai nama task yang sama dan memperbarui jadwal `BengkelMakan_AutoReport_Daily`; tidak perlu membuat task baru. Output script akan menampilkan waktu yang dikonfigurasi.

3. Pastikan trigger baru terpasang melalui Task Scheduler: buka **Task Scheduler Library**, pilih `BengkelMakan_AutoReport_Daily`, klik **Properties > Triggers**, lalu cek waktu mulai. Alternatifnya, ubah jadwal langsung dari tab **Triggers**; perubahan lewat GUI akan berlaku untuk task yang ada, tetapi mengedit dan menjalankan ulang script akan mengembalikan jadwal sesuai `$ScheduleTime`.

Waktu trigger mengikuti timezone lokal Windows Server, bukan timezone browser. Jika ingin laporan pukul 18:30 WITA, pastikan timezone Windows Server diset ke WITA lalu gunakan `$ScheduleTime = "06:30 PM"`. Endpoint membentuk label tanggal laporan berdasarkan `Asia/Makassar`, jadi menjaga timezone server dan zona laporan tetap selaras menghindari jadwal berjalan pada tanggal yang berbeda.

Endpoint mendukung `type=daily`, `type=weekly`, dan `type=monthly`, tetapi script Task Scheduler yang tersedia hanya menjadwalkan laporan harian. Laporan bulanan berisi bulan berjalan sampai waktu pengiriman. Catatan penting: laporan mingguan saat ini mengambil transaksi dari bulan berjalan saja, sehingga periode tujuh hari yang melewati pergantian bulan dapat tidak lengkap.

Jika SMTP gagal, cek host/port/TLS, username dan App Password, izin SMTP pada provider, koneksi internet keluar server, serta `REPORT_RECIPIENTS`. Jangan menaruh secret pada URL yang dibagikan; runner menggunakan loopback `localhost` dan endpoint cron jangan dipublikasikan melalui reverse proxy.

## 6. Siapkan File Suara (Opsional)

Taruh 2 file suara di folder `public/sounds/`:
- `ting.mp3` — suara saat scan BERHASIL.
- `alarm.mp3` — suara peringatan (gagal, nonaktif, duplikat, tidak dikenal).

*(Catatan: pastikan nama file menggunakan huruf kecil semua)*

## 7. Cara Menjalankan Website & Mengoperasikannya

Untuk menjalankan server secara lokal:
```bash
npm run dev
```

Server akan aktif.
- **Admin Komputer Induk**: Buka browser ke alamat `http://localhost:3000/admin/login`, lalu login sebagai ADMIN atau DATA.
- **Tablet Kantin**: Buka browser di tablet, akses IP Address lokal komputer induk (contoh: `http://192.168.1.10:3000/admin/login`), lalu login sebagai SCANNER. Jika berhasil, tablet otomatis diarahkan ke halaman `/scanner`.

**Pengoperasian Harian:**
1. Di komputer induk, buka `/admin/employees` untuk mendaftarkan nama karyawan yang baru masuk. Cetak ID card via PDF.
2. Di tablet, pastikan baterai terisi penuh dan selalu stand-by di halaman `/scanner`.
3. Karyawan datang, scan QR. Status akan tersimpan di riwayat.

## 8. Cara Build & Maintenance (Pembaruan)

Jika ingin mem-build untuk *Production* lokal (lebih cepat dan optimal dibanding mode *dev*):
```bash
npm run build
npm run start
```

Jika kamu mengubah struktur tabel database (file `prisma/schema.prisma`):
```bash
npx prisma generate
npx prisma db push
```

## Struktur Folder Penting

```
src/
  app/
    admin/
      login/          -> Halaman masuk (semua role)
      dashboard/      -> Halaman ringkasan, riwayat transaksi, export Excel
      employees/      -> Kelola Karyawan (Add, Edit, Delete, Cetak QR & PDF)
    scanner/          -> Pemindai barcode/QR (Role ADMIN & SCANNER)
    api/              -> Kumpulan endpoint logic & interaksi database
  components/         -> Komponen Navbar, Sidebar, Settings Modal
  lib/
    auth.ts           -> Logika otentikasi (JWT session & role check)
    db.ts             -> Konfigurasi Prisma client
    sheets.ts         -> Logika utama database (Transaksi & Karyawan)
prisma/
  schema.prisma       -> Definisi tabel database
  dev.db              -> [TIDAK DISINKRON] File database fisik lokal SQLite
```
