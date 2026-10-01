-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "departemen" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "departemen" TEXT NOT NULL DEFAULT '',
    "tanggal" TEXT NOT NULL,
    "jam" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "employees_category_idx" ON "employees"("category");

-- CreateIndex
CREATE INDEX "transactions_employeeId_tanggal_status_idx" ON "transactions"("employeeId", "tanggal", "status");

-- CreateIndex
CREATE INDEX "transactions_bulan_idx" ON "transactions"("bulan");

-- CreateIndex
CREATE INDEX "transactions_departemen_idx" ON "transactions"("departemen");
