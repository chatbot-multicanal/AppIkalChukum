$ErrorActionPreference = "SilentlyContinue"
$webDir = "F:\AppIkalChukum\web"

while ($true) {
  $isRunning = $false
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:3005/status" -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) {
      $isRunning = $true
    }
  } catch {
    $isRunning = $false
  }

  if (-not $isRunning) {
    Set-Location $webDir
    Start-Process -FilePath "node" -ArgumentList "scripts/whatsapp-service.mjs" -WorkingDirectory $webDir -WindowStyle Hidden
  }

  Start-Sleep -Seconds 20
}
