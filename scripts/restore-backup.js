const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { resolveDatabasePath } = require("./database-path");

const projectDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(projectDir, ".env.local") });

function verifyDatabase(filePath) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma("integrity_check");
    if (result.length !== 1 || result[0].integrity_check !== "ok") {
      throw new Error(`Integrity check gagal: ${JSON.stringify(result)}`);
    }
    const tables = db
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'")
      .get();
    if (tables.count === 0) {
      throw new Error("File tidak memiliki tabel database.");
    }
  } finally {
    db.close();
  }
}

function main() {
  const backupPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : null;
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new Error('Berikan path file backup, contoh: node scripts/restore-backup.js "..\\Backups\\dev_2026-10-01_120000.db"');
  }

  const databasePath = resolveDatabasePath(
    process.env.DATABASE_URL,
    projectDir
  );
  if (path.resolve(backupPath).toLowerCase() === databasePath.toLowerCase()) {
    throw new Error("File backup tidak boleh sama dengan database aktif.");
  }

  verifyDatabase(backupPath);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  if (fs.existsSync(databasePath)) {
    const backupDir = path.resolve(
      projectDir,
      process.env.BACKUP_DIR || "../Backups"
    );
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safetyCopy = path.join(backupDir, `before-restore_${timestamp}.db`);
    fs.copyFileSync(databasePath, safetyCopy);
    console.log(`Salinan database sebelum restore: ${safetyCopy}`);
  }

  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const sidecarPath = `${databasePath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
  }

  fs.copyFileSync(backupPath, databasePath);
  verifyDatabase(databasePath);
  console.log(`Restore berhasil: ${databasePath}`);
}

try {
  main();
} catch (error) {
  console.error(`Restore gagal: ${error.message}`);
  process.exitCode = 1;
}