$ErrorActionPreference = "Stop"

# ============================================================================
# KONFIGURASI LAPORAN - edit di sini saja
# ============================================================================
# $StartReport = berapa JAM ke belakang laporan diambil, dihitung dari saat
# report DIKIRIM. Contoh: report dikirim jam 07:00 WITA dan $StartReport = 24,
# maka transaksi yang dibaca = kemarin 07:00 s/d hari ini 07:00 WITA.
# Ubah ke 12 / 48 / dst. untuk interval lain.
$StartReport = 24

# (Opsional) Cut-off tetap. Kalau dikosongkan (leave $null), jendela dihitung
# mundur dari waktu kirim (paling sederhana). Isi 0-23 hanya jika ingin batas
# akhir dibulatkan ke jam tertentu; $CutOffMinute untuk menitnya.
$CutOffHour = $null
$CutOffMinute = $null
# ============================================================================

$projectDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectDir ".env.local"
$logPath = Join-Path $PSScriptRoot "report-task.log"

function Write-ReportLog {
    param([string]$Message)
    $entry = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $logPath -Value $entry -Encoding UTF8
}

try {
    if (-not (Test-Path $envPath)) {
        throw "File .env.local tidak ditemukan: $envPath"
    }

    $secretLine = Get-Content $envPath | Where-Object { $_ -match '^\s*CRON_SECRET\s*=' } | Select-Object -First 1
    if (-not $secretLine) {
        throw "CRON_SECRET belum diatur di .env.local"
    }

    $cronSecret = ($secretLine -replace '^\s*CRON_SECRET\s*=\s*', '').Trim().Trim('"').Trim("'")
    if (-not $cronSecret -or $cronSecret -eq "replace-with-a-random-64-character-hex-secret") {
        throw "Ganti CRON_SECRET contoh dengan secret acak di .env.local"
    }

    $encodedSecret = [Uri]::EscapeDataString($cronSecret)

    # Bangun query string dari konfigurasi di atas.
    $query = "type=daily&key=$encodedSecret&windowHours=$StartReport"
    if ($null -ne $CutOffHour)    { $query += "&startHour=$CutOffHour" }
    if ($null -ne $CutOffMinute)  { $query += "&startMinute=$CutOffMinute" }

    $url = "http://localhost:3000/api/cron/send-report?$query"
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 120
    Write-ReportLog "SUCCESS: daily report sent (windowHours=$StartReport); HTTP $($response.StatusCode)."
} catch {
    Write-ReportLog "FAILED: $($_.Exception.Message)"
    exit 1
}
