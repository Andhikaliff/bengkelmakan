# ============================================================================
# INSTALL WINDOWS SERVICES — Bengkel Makan Management System
# ============================================================================
# Script ini menggunakan NSSM (Non-Sucking Service Manager) untuk mendaftarkan
# Next.js dan Caddy sebagai Windows Service, sehingga otomatis berjalan
# saat server Windows menyala — tanpa perlu login atau buka terminal.
#
# PRASYARAT:
#   1. NSSM sudah didownload dan diletakkan di .\tools\nssm.exe.
#      Download: https://nssm.cc/download
#   2. Next.js sudah di-build: npm run build
#   3. Caddy sudah ada di path yang ditentukan.
#
# CARA PAKAI:
#   Buka PowerShell sebagai Administrator, lalu jalankan:
#   .\scripts\install-services.ps1
#
# CATATAN:
#   - Script ini harus dijalankan dengan hak Administrator.
#   - Jika service sudah ada, script akan menghentikan dan menghapusnya
#     terlebih dahulu sebelum install ulang.
# ============================================================================

#Requires -RunAsAdministrator

# ── Lokasi — otomatis mengikuti folder hasil clone ──────────────────────────

# Lokasi project Next.js dan tools lokal
$PROJECT_DIR = Split-Path -Parent $PSScriptRoot
$TOOLS_DIR = Join-Path $PROJECT_DIR "tools"
$NSSM = Join-Path $TOOLS_DIR "nssm.exe"

# Lokasi Node.js
$NODE_EXE = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NODE_EXE) {
    $NODE_EXE = Join-Path $TOOLS_DIR "node.exe"
}

# Lokasi Caddy dan konfigurasi
$CADDY_EXE = Join-Path $TOOLS_DIR "caddy.exe"
$CADDYFILE = Join-Path $PROJECT_DIR "Caddyfile"

# Folder log
$LOG_DIR = Join-Path $PROJECT_DIR "logs"

# Nama service
$SVC_NEXTJS = "BengkelMakan"
$SVC_CADDY  = "BengkelMakanCaddy"

# ── Fungsi Helper ─────────────────────────────────────────────────────────────

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

function Remove-ServiceIfExists {
    param([string]$ServiceName)
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "    Service '$ServiceName' sudah ada, menghapus..." -ForegroundColor Yellow
        & $NSSM stop $ServiceName 2>$null
        Start-Sleep -Seconds 2
        & $NSSM remove $ServiceName confirm 2>$null
        Start-Sleep -Seconds 1
    }
}

# ── Validasi ──────────────────────────────────────────────────────────────────

Write-Step "Memeriksa prasyarat..."

if (-not (Test-Path $NSSM)) {
    Write-Host "GAGAL: NSSM tidak ditemukan di $NSSM" -ForegroundColor Red
    Write-Host "Download NSSM dan letakkan nssm.exe di $TOOLS_DIR" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $NODE_EXE)) {
    Write-Host "GAGAL: Node.js tidak ditemukan di $NODE_EXE" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$PROJECT_DIR\package.json")) {
    Write-Host "GAGAL: Project tidak ditemukan di $PROJECT_DIR" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$PROJECT_DIR\.next")) {
    Write-Host "PERINGATAN: Folder .next belum ada. Jalankan 'npm run build' terlebih dahulu." -ForegroundColor Yellow
    $buildConfirm = Read-Host "Ingin menjalankan 'npm run build' sekarang? (y/n)"
    if ($buildConfirm -eq 'y') {
        Write-Step "Menjalankan npm run build..."
        Push-Location $PROJECT_DIR
        npm run build
        Pop-Location
        if ($LASTEXITCODE -ne 0) {
            Write-Host "GAGAL: npm run build gagal." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "GAGAL: Build belum dilakukan. Service tidak dapat diinstall." -ForegroundColor Red
        exit 1
    }
}

# Buat folder log
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
    Write-Host "    Folder log dibuat: $LOG_DIR" -ForegroundColor Green
}

# ── Install Service Next.js ───────────────────────────────────────────────────

Write-Step "Menginstall service: $SVC_NEXTJS (Next.js Production Server)"

Remove-ServiceIfExists $SVC_NEXTJS

# Install service — jalankan `next start` via node
& $NSSM install $SVC_NEXTJS $NODE_EXE
& $NSSM set $SVC_NEXTJS AppDirectory $PROJECT_DIR
& $NSSM set $SVC_NEXTJS AppParameters "node_modules\next\dist\bin\next start -H 127.0.0.1"
& $NSSM set $SVC_NEXTJS DisplayName "Bengkel Makan - Next.js"
& $NSSM set $SVC_NEXTJS Description "Next.js production server untuk Bengkel Makan Management System"

# Environment
& $NSSM set $SVC_NEXTJS AppEnvironmentExtra "NODE_ENV=production"

# Logging — stdout dan stderr ke file terpisah, dengan rotasi otomatis
& $NSSM set $SVC_NEXTJS AppStdout "$LOG_DIR\nextjs-stdout.log"
& $NSSM set $SVC_NEXTJS AppStderr "$LOG_DIR\nextjs-stderr.log"
& $NSSM set $SVC_NEXTJS AppStdoutCreationDisposition 4
& $NSSM set $SVC_NEXTJS AppStderrCreationDisposition 4
& $NSSM set $SVC_NEXTJS AppRotateFiles 1
& $NSSM set $SVC_NEXTJS AppRotateOnline 1
& $NSSM set $SVC_NEXTJS AppRotateBytes 10485760  # Rotasi setiap 10MB

# Auto-start saat boot
& $NSSM set $SVC_NEXTJS Start SERVICE_AUTO_START

# Restart otomatis jika crash (throttle 5 detik)
& $NSSM set $SVC_NEXTJS AppThrottle 5000

# Tunggu network ready sebelum start
& $NSSM set $SVC_NEXTJS DependOnService "Tcpip"

# Jalankan sebagai LocalSystem (tidak perlu login)
& $NSSM set $SVC_NEXTJS ObjectName "LocalSystem"

Write-Host "    Service $SVC_NEXTJS terinstall." -ForegroundColor Green

# ── Install Service Caddy (Opsional) ─────────────────────────────────────────

if (Test-Path $CADDY_EXE) {
    Write-Step "Menginstall service: $SVC_CADDY (Caddy Reverse Proxy)"

    Remove-ServiceIfExists $SVC_CADDY

    & $NSSM install $SVC_CADDY $CADDY_EXE
    & $NSSM set $SVC_CADDY AppDirectory $PROJECT_DIR

    if (Test-Path $CADDYFILE) {
        & $NSSM set $SVC_CADDY AppParameters "run --config `"$CADDYFILE`""
    } else {
        & $NSSM set $SVC_CADDY AppParameters "run"
        Write-Host "    PERINGATAN: Caddyfile tidak ditemukan di $CADDYFILE" -ForegroundColor Yellow
    }

    & $NSSM set $SVC_CADDY DisplayName "Bengkel Makan - Caddy"
    & $NSSM set $SVC_CADDY Description "Caddy reverse proxy (HTTPS) untuk Bengkel Makan"
    & $NSSM set $SVC_CADDY AppStdout "$LOG_DIR\caddy-stdout.log"
    & $NSSM set $SVC_CADDY AppStderr "$LOG_DIR\caddy-stderr.log"
    & $NSSM set $SVC_CADDY AppStdoutCreationDisposition 4
    & $NSSM set $SVC_CADDY AppStderrCreationDisposition 4
    & $NSSM set $SVC_CADDY AppRotateFiles 1
    & $NSSM set $SVC_CADDY AppRotateOnline 1
    & $NSSM set $SVC_CADDY AppRotateBytes 10485760
    & $NSSM set $SVC_CADDY Start SERVICE_AUTO_START
    & $NSSM set $SVC_CADDY AppThrottle 5000
    & $NSSM set $SVC_CADDY DependOnService "Tcpip"
    & $NSSM set $SVC_CADDY ObjectName "LocalSystem"

    Write-Host "    Service $SVC_CADDY terinstall." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "    SKIP: Caddy tidak ditemukan di $CADDY_EXE" -ForegroundColor Yellow
    Write-Host "    Letakkan Caddyfile di $PROJECT_DIR atau lewati instalasi Caddy." -ForegroundColor Yellow
}

# ── Start Services ────────────────────────────────────────────────────────────

Write-Step "Memulai services..."

& $NSSM start $SVC_NEXTJS
Start-Sleep -Seconds 3

if (Test-Path $CADDY_EXE) {
    & $NSSM start $SVC_CADDY
    Start-Sleep -Seconds 2
}

# ── Status ────────────────────────────────────────────────────────────────────

Write-Step "Status services:"

$services = @($SVC_NEXTJS)
if (Test-Path $CADDY_EXE) { $services += $SVC_CADDY }
$failedServices = @()

foreach ($svc in $services) {
    $status = (Get-Service -Name $svc -ErrorAction SilentlyContinue).Status
    if ($status -eq "Running") {
        Write-Host "    $svc : RUNNING" -ForegroundColor Green
    } else {
        Write-Host "    $svc : $status" -ForegroundColor Yellow
        $failedServices += $svc
    }
}

if ($failedServices.Count -gt 0) {
    Write-Host ""
    Write-Host "GAGAL: Service berikut tidak berstatus RUNNING: $($failedServices -join ', ')" -ForegroundColor Red
    if ($failedServices -contains $SVC_NEXTJS) {
        Write-Host "Periksa $LOG_DIR\nextjs-stderr.log dan pastikan port 3000 tersedia." -ForegroundColor Yellow
    }
    if ($failedServices -contains $SVC_CADDY) {
        Write-Host "Periksa $LOG_DIR\caddy-stderr.log. Jika error menyebut port 2019 sudah dipakai, hentikan instance Caddy lain sebelum menjalankan service ini." -ForegroundColor Yellow
    }
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Instalasi selesai!" -ForegroundColor Green
Write-Host "  Services akan otomatis berjalan saat" -ForegroundColor Green
Write-Host "  Windows Server dinyalakan." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Perintah berguna:" -ForegroundColor Yellow
Write-Host "  nssm status $SVC_NEXTJS       # Cek status"
Write-Host "  nssm restart $SVC_NEXTJS      # Restart service"
Write-Host "  nssm stop $SVC_NEXTJS         # Hentikan service"
Write-Host "  nssm edit $SVC_NEXTJS         # Edit konfigurasi (GUI)"
Write-Host ""
Write-Host "Log tersimpan di: $LOG_DIR" -ForegroundColor Yellow
Write-Host ""
