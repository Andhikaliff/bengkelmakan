# ==============================================================================
# Script untuk mendaftarkan Task Scheduler: Auto Report via Email
# ==============================================================================
# Menjalankan endpoint /api/cron/send-report setiap hari pada $ScheduleTime.
# Laporan harian memakai JENDELA WAKTU ROLLING: report yang dikirim pada jam
# cut-off menghitung transaksi dari jam cut-off HARI SEBELUMNYA sampai jam
# cut-off hari ini.
# Contoh: cut-off 07:00, dikirim Jumat 07:00 => transaksi Kamis 07:00 - Jumat 07:00.
#
# ── SATU TEMPAT PENGATURAN ──
# Cukup ubah variabel di bawah; tidak perlu menyentuh .env.local untuk jam
# laporan. $ScheduleTime sekaligus jadi jam cut-off (jam & menit dibaca otomatis)
# dan $WindowHours jadi lebar jendela. Nilai ini diteruskan ke run-report.ps1
# sebagai query string (startHour/startMinute/windowHours).
# Catatan: waktu dianggap WITA (Asia/Makassar); pastikan jam server = WITA.
# .env.local tetap perlu untuk CRON_SECRET, SMTP, dan REPORT_RECIPIENTS.

# Memastikan script dijalankan dengan hak akses Administrator
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Warning "Harap jalankan PowerShell sebagai Administrator!"
    exit
}

# ── Konfigurasi ──
$TaskName = "BengkelMakan_AutoReport_Daily"
$TaskDescription = "Mengirim laporan transaksi harian Bengkel Makan via email."
$ScheduleTime = "07:00 AM"  # Jam kirim sekaligus jam cut-off jendela (WITA)
$WindowHours  = 24          # Lebar jendela laporan dalam jam (mis. 24 = sehari penuh)
$ScriptPath = Join-Path $PSScriptRoot "run-report.ps1"

if (-not (Test-Path $ScriptPath)) {
    throw "Script runner tidak ditemukan: $ScriptPath"
}

# Turunkan jam & menit cut-off dari $ScheduleTime agar tidak perlu ditulis dua kali.
$sched = [datetime]::ParseExact($ScheduleTime, "h:mm tt", [System.Globalization.CultureInfo]::InvariantCulture)
$StartHour = $sched.Hour
$StartMinute = $sched.Minute

# Action: Jalankan PowerShell dengan script runner (tersembunyi), sertakan
# parameter jendela waktu supaya endpoint memakai jam yang sama dengan trigger.
$TaskArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`" -StartHour $StartHour -StartMinute $StartMinute -WindowHours $WindowHours"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $TaskArgs

# Trigger: Setiap hari pada waktu yang dikonfigurasi
$Trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime

# Settings: Jangan biarkan berjalan > 1 jam
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Daftarkan Task
Register-ScheduledTask -Action $Action -Trigger $Trigger -TaskName $TaskName -Description $TaskDescription -Settings $Settings -User "SYSTEM" -Force

Write-Host "Task Scheduler '$TaskName' berhasil didaftarkan!"
Write-Host "Laporan harian dikirim setiap hari pukul $ScheduleTime (WITA)."
Write-Host "Jendela laporan: $WindowHours jam, cut-off ${StartHour}:${StartMinute} WITA (dari $ScheduleTime)."
Write-Host "Pastikan aplikasi berjalan dan CRON_SECRET, SMTP, serta REPORT_RECIPIENTS sudah diatur di .env.local."
Write-Host "Log pengiriman: $PSScriptRoot\report-task.log"
