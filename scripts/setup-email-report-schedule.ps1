# ==============================================================================
# Script untuk mendaftarkan Task Scheduler: Auto Report via Email
# ==============================================================================
# Menjalankan endpoint /api/cron/send-report setiap hari pukul 07:00 waktu lokal
# dan tambahan pada akhir bulan/minggu.
# Untuk kesederhanaan, script ini mencontohkan setup laporan Harian.
#
# ── JENDELA WAKTU LAPORAN HARIAN ──
# Laporan harian memakai jendela waktu rolling, bukan sekadar tanggal kalender
# hari ini. Report yang dikirim pukul jam cut-off akan menghitung transaksi dari
# jam cut-off HARI SEBELUMNYA sampai jam cut-off hari ini.
# Contoh: cut-off 07:00, dikirim Jumat 07:00 => transaksi Kamis 07:00 - Jumat 07:00.
# Diatur lewat .env.local:
#   REPORT_START_HOUR  = jam cut-off (0-23), default 7
#   REPORT_WINDOW_HOURS= lebar jendela dalam jam, default 24
# Jaga agar REPORT_START_HOUR sama dengan $ScheduleTime di bawah (dalam WITA).

# Memastikan script dijalankan dengan hak akses Administrator
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Warning "Harap jalankan PowerShell sebagai Administrator!"
    exit
}

# Konfigurasi
$TaskName = "BengkelMakan_AutoReport_Daily"
$TaskDescription = "Mengirim laporan transaksi harian Bengkel Makan via email."
$ScheduleTime = "07:00 AM"  # Waktu lokal server (WITA) - selaraskan dengan REPORT_START_HOUR
$ScriptPath = Join-Path $PSScriptRoot "run-report.ps1"

if (-not (Test-Path $ScriptPath)) {
    throw "Script runner tidak ditemukan: $ScriptPath"
}

# Action: Jalankan PowerShell dengan script runner (tersembunyi)
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Trigger: Setiap hari pada waktu yang dikonfigurasi
$Trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime

# Settings: Jangan biarkan berjalan > 1 jam
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Daftarkan Task
Register-ScheduledTask -Action $Action -Trigger $Trigger -TaskName $TaskName -Description $TaskDescription -Settings $Settings -User "SYSTEM" -Force

Write-Host "Task Scheduler '$TaskName' berhasil didaftarkan!"
Write-Host "Laporan harian akan dikirim otomatis setiap hari pukul $ScheduleTime waktu lokal server."
Write-Host "Pastikan aplikasi berjalan dan CRON_SECRET, SMTP, serta penerima sudah diatur di .env.local."
Write-Host "Atur REPORT_START_HOUR/REPORT_WINDOW_HOURS di .env.local untuk mengatur jendela laporan."
Write-Host "Log pengiriman: $PSScriptRoot\report-task.log"
