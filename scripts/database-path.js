const path = require("path");

function resolveDatabasePath(databaseUrl, projectDir) {
  const url = databaseUrl || "file:./prisma/dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("DATABASE_URL harus memakai format SQLite file:...");
  }

  const filePath = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  return path.resolve(projectDir, filePath);
}

module.exports = { resolveDatabasePath };