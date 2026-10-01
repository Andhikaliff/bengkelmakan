# ============================================================================
# SETUP BACKUP TERJADWAL — Windows Task Scheduler
# ============================================================================
# Mendaftarkan task otomatis untuk menjalankan backup database setiap 6 jam.
#
# CARA PAKAI:
#   Buka PowerShell sebagai Administrator, lalu jalankan:
#   .\scripts\setup-backup-schedule.ps1
# ============================================================================

#Requires -RunAsAdministrator

$TASK_NAME = "BengkelMakan-DatabaseBackup"
$PROJECT_DIR = Split-Path -Parent $PSScriptRoot
$TOOLS_DIR = Join-Path $PROJECT_DIR "tools"
$NODE_EXE  = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NODE_EXE) {
    $NODE_EXE = Join-Path $TOOLS_DIR "node.exe"
}
$SCRIPT_PATH = Join-Path $PSScriptRoot "backup.js"
$WORKING_DIR = $PROJECT_DIR

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

# Validasi
if (-not (Test-Path $NODE_EXE)) {
    Write-Host "GAGAL: Node.js tidak ditemukan." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $SCRIPT_PATH)) {
    Write-Host "GAGAL: Script backup tidak ditemukan di $SCRIPT_PATH" -ForegroundColor Red
    exit 1
}

# Hapus task lama jika ada
Write-Step "Membuat scheduled task: $TASK_NAME"

$existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "    Task lama ditemukan, menghapus..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
}

# Buat trigger: setiap 6 jam, mulai dari sekarang
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)

# Buat action: jalankan node scripts/backup.js
$action = New-ScheduledTaskAction `
    -Execute $NODE_EXE `
    -Argument "`"$SCRIPT_PATH`"" `
    -WorkingDirectory $WORKING_DIR

# Settings: jalankan meskipun user tidak login, jalankan meskipun on battery
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -MultipleInstances IgnoreNew

# Register task — jalankan sebagai SYSTEM (tidak perlu login)
Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User "SYSTEM" `
    -RunLevel Highest `
    -Description "Backup otomatis database SQLite Bengkel Makan setiap 6 jam" `
    -Force

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Backup terjadwal berhasil dibuat!" -ForegroundColor Green
Write-Host "  Interval : Setiap 6 jam" -ForegroundColor Green
Write-Host "  Task Name: $TASK_NAME" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Perintah berguna:" -ForegroundColor Yellow
Write-Host "  schtasks /query /tn `"$TASK_NAME`" /v    # Cek detail task"
Write-Host "  schtasks /run /tn `"$TASK_NAME`"          # Jalankan manual"
Write-Host "  schtasks /delete /tn `"$TASK_NAME`" /f    # Hapus task"
Write-Host ""
Write-Host "Atau jalankan backup manual:" -ForegroundColor Yellow
Write-Host "  node scripts/backup.js" -ForegroundColor White
Write-Host ""
