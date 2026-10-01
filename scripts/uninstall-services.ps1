# ============================================================================
# UNINSTALL WINDOWS SERVICES — Bengkel Makan Management System
# ============================================================================
# Menghapus service yang di-install oleh install-services.ps1.
# Jalankan sebagai Administrator.
#
# CARA PAKAI:
#   .\scripts\uninstall-services.ps1
# ============================================================================

#Requires -RunAsAdministrator

$PROJECT_DIR = Split-Path -Parent $PSScriptRoot
$NSSM = Join-Path $PROJECT_DIR "tools\nssm.exe"
$LOG_DIR = Join-Path $PROJECT_DIR "logs"

$SVC_NEXTJS = "BengkelMakan"
$SVC_CADDY  = "BengkelMakanCaddy"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

function Remove-ServiceSafe {
    param([string]$ServiceName)
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "    Menghentikan $ServiceName..." -ForegroundColor Yellow
        & $NSSM stop $ServiceName 2>$null
        Start-Sleep -Seconds 2
        Write-Host "    Menghapus $ServiceName..." -ForegroundColor Yellow
        & $NSSM remove $ServiceName confirm 2>$null
        Start-Sleep -Seconds 1
        Write-Host "    $ServiceName dihapus." -ForegroundColor Green
    } else {
        Write-Host "    $ServiceName tidak ditemukan, skip." -ForegroundColor Gray
    }
}

if (-not (Test-Path $NSSM)) {
    Write-Host "GAGAL: NSSM tidak ditemukan di $NSSM" -ForegroundColor Red
    exit 1
}

Write-Step "Menghapus services Bengkel Makan..."

Remove-ServiceSafe $SVC_NEXTJS
Remove-ServiceSafe $SVC_CADDY

Write-Host ""
Write-Host "Semua services Bengkel Makan telah dihapus." -ForegroundColor Green
Write-Host "Catatan: Log di $LOG_DIR tidak dihapus." -ForegroundColor Yellow
Write-Host ""
