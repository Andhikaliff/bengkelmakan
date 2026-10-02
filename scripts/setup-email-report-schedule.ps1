# ==============================================================================
# Script untuk mendaftarkan Task Scheduler: Auto Report via Email
# ==============================================================================
# Menjalankan endpoint /api/cron/send-report setiap hari pada $ScheduleTime.
#
# Pembagian tugas:
#   - $ScheduleTime  (file ini) = JAM report DIKIRIM tiap hari.
#   - $StartReport   (run-report.ps1) = JENDELA waktu laporan, berapa jam ke
#     belakang transaksi dibaca dari jam kirim. Default 24 => report jam 07:00
#     mencakup kemarin 07:00 s/d hari ini 07:00 WITA.
# Jadi untuk mengubah interval laporan, cukup edit run-report.ps1; tidak perlu
# menyentuh .env.local. Ubah $ScheduleTime di sini hanya jika jam kirim berubah.
# Waktu dianggap WITA (Asia/Makassar); pastikan jam server = WITA.

# Memastikan script dijalankan dengan hak akses Administrator
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Warning "Harap jalankan PowerShell sebagai Administrator!"
    exit
}

# ── Konfigurasi ──
$TaskName = "BengkelMakan_AutoReport_Daily"
$TaskDescription = "Mengirim laporan transaksi harian Bengkel Makan via email."
$ScheduleTime = "07:00 AM"  # Jam kirim laporan harian (WITA). Interval diatur di run-report.ps1.
$ScriptPath = Join-Path $PSScriptRoot "run-report.ps1"

if (-not (Test-Path $ScriptPath)) {
    throw "Script runner tidak ditemukan: $ScriptPath"
}

# Action: Jalankan PowerShell dengan script runner (tersembunyi).
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Trigger: Setiap hari pada waktu yang dikonfigurasi
$Trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime

# Settings: Jangan biarkan berjalan > 1 jam
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Daftarkan Task
Register-ScheduledTask -Action $Action -Trigger $Trigger -TaskName $TaskName -Description $TaskDescription -Settings $Settings -User "SYSTEM" -Force

Write-Host "Task Scheduler '$TaskName' berhasil didaftarkan!"
Write-Host "Laporan harian dikirim setiap hari pukul $ScheduleTime (WITA)."
Write-Host "Interval jendela laporan diatur lewat `$StartReport di run-report.ps1 (default 24 jam)."
Write-Host "Pastikan aplikasi berjalan dan CRON_SECRET, SMTP, serta REPORT_RECIPIENTS sudah diatur di .env.local."
Write-Host "Log pengiriman: $PSScriptRoot\report-task.log"
