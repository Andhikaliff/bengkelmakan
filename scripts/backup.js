// ============================================================================
// BACKUP OTOMATIS DATABASE SQLITE
// ============================================================================
// Standalone script — dijalankan di luar proses Next.js.
// Menggunakan SQLite Online Backup API via better-sqlite3, yang merupakan
// satu-satunya cara AMAN untuk backup SQLite yang sedang aktif dipakai.
//
// Cara pakai manual:
//   node scripts/backup.js
//
// Untuk otomatis: jadwalkan via Windows Task Scheduler (lihat README).
// ============================================================================

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { resolveDatabasePath } = require("./database-path");

// Load .env.local (sama seperti yang dipakai Next.js)
const PROJECT_DIR = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(PROJECT_DIR, ".env.local") });

// ── Konfigurasi ──────────────────────────────────────────────────────────────
const DB_PATH = resolveDatabasePath(process.env.DATABASE_URL, PROJECT_DIR);
const BACKUP_DIR = path.resolve(
  PROJECT_DIR,
  process.env.BACKUP_DIR || "../Backups"
);
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);
const LOG_FILE = path.join(BACKUP_DIR, "backup.log");

// ── Utilities ────────────────────────────────────────────────────────────────

function log(message) {
  const timestamp = new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Makassar",
  });
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch (err) {
    console.error("Gagal menulis log:", err.message);
  }
}

function formatTimestamp() {
  const now = new Date();
  // Format: YYYY-MM-DD_HHmmss (WITA)
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Pastikan folder backup ada
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  log("========================================");
  log("Backup dimulai");
  log(`Database : ${DB_PATH}`);
  log(`Tujuan   : ${BACKUP_DIR}`);
  log(`Retention: ${RETENTION_DAYS} hari`);

  // 2. Pastikan database sumber ada
  if (!fs.existsSync(DB_PATH)) {
    log(`GAGAL: Database tidak ditemukan di ${DB_PATH}`);
    process.exit(1);
  }

  const sourceStats = fs.statSync(DB_PATH);
  log(`Ukuran database sumber: ${(sourceStats.size / 1024).toFixed(1)} KB`);

  // 3. Buat backup menggunakan SQLite Online Backup API
  const backupFilename = `dev_${formatTimestamp()}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  try {
    // Buka database dalam mode readonly — aman, tidak mengganggu aplikasi
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

    log(`Membuat backup: ${backupFilename}`);
    await db.backup(backupPath);

    db.close();

    // 4. Verifikasi backup
    const backupStats = fs.statSync(backupPath);
    if (backupStats.size === 0) {
      throw new Error("File backup kosong (0 bytes)");
    }

    // Jalankan integrity_check pada file backup
    const verifyDb = new Database(backupPath, { readonly: true });
    const integrityResult = verifyDb.pragma("integrity_check");
    const tableCount = verifyDb
      .prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'")
      .get();
    verifyDb.close();

    const isOk =
      integrityResult.length === 1 &&
      integrityResult[0].integrity_check === "ok";

    if (!isOk) {
      throw new Error(
        `Integrity check gagal: ${JSON.stringify(integrityResult)}`
      );
    }

    log(
      `BERHASIL: ${backupFilename} (${(backupStats.size / 1024).toFixed(1)} KB, ${tableCount.cnt} tabel, integrity OK)`
    );
  } catch (err) {
    log(`GAGAL: Backup error — ${err.message}`);
    // Bersihkan file backup yang gagal
    if (fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
      } catch {}
    }
    process.exit(1);
  }

  // 5. Retention: hapus backup lama
  try {
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const allFiles = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("dev_") && f.endsWith(".db"));
    let deletedCount = 0;

    for (const file of allFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoffMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        log(`Backup lama dihapus: ${file}`);
      }
    }

    if (deletedCount > 0) {
      log(
        `${deletedCount} file backup lama dihapus (retention: ${RETENTION_DAYS} hari)`
      );
    } else {
      log("Tidak ada backup lama yang perlu dihapus");
    }

    // Hitung total backup yang tersisa
    const remaining = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("dev_") && f.endsWith(".db"));
    log(`Total backup tersimpan: ${remaining.length} file`);
  } catch (err) {
    log(`PERINGATAN: Gagal membersihkan backup lama — ${err.message}`);
    // Tidak exit(1) karena backup utama sudah berhasil
  }

  log("Backup selesai");
  log("========================================");
}

main().catch((err) => {
  log(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
