$ErrorActionPreference = "Stop"

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
    $url = "http://localhost:3000/api/cron/send-report?type=daily&key=$encodedSecret"
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 120
    Write-ReportLog "SUCCESS: daily report sent; HTTP $($response.StatusCode)."
} catch {
    Write-ReportLog "FAILED: $($_.Exception.Message)"
    exit 1
}
