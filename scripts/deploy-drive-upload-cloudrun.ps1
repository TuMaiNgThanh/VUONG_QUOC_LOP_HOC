param(
  [string]$ProjectId = "vuongquoclophoc",
  [string]$Region = "asia-southeast1",
  [string]$ServiceName = "ck-drive-upload",
  [string]$DriveFolderId = "1HLfTQH_yTpySEnruBH5PolvfwN7XDaHE",
  [string]$ServiceAccountJsonPath = "assets/Json/vuongquoclophoc-e900de6ad73b.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ServiceAccountJsonPath)) {
  throw "Service account JSON not found: $ServiceAccountJsonPath"
}

$serviceJson = Get-Content -Raw $ServiceAccountJsonPath | ConvertFrom-Json | ConvertTo-Json -Compress
$tmpEnv = Join-Path $env:TEMP "ck-drive-env.yaml"

$escapedJson = $serviceJson -replace "'", "''"
@(
  "DRIVE_ROOT_FOLDER_ID: \"$DriveFolderId\"",
  "DRIVE_SERVICE_ACCOUNT_JSON: '$escapedJson'"
) | Set-Content -Path $tmpEnv

Write-Output "Deploying Cloud Run service $ServiceName ..."
gcloud run deploy $ServiceName `
  --source external/drive-upload-service `
  --region $Region `
  --allow-unauthenticated `
  --project $ProjectId `
  --env-vars-file $tmpEnv

$url = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format "value(status.url)"
if (-not $url) {
  throw "Cannot read deployed service URL"
}

Write-Output ""
Write-Output "Deployment success."
Write-Output "Upload endpoint: $url/upload"
Write-Output ""
Write-Output "Set this value into .env:"
Write-Output "VITE_DRIVE_UPLOAD_ENDPOINT=$url/upload"

# Cleanup secret temp file
if (Test-Path $tmpEnv) {
  try {
    Remove-Item $tmpEnv -Force
  } catch {
    Set-Content -Path $tmpEnv -Value "REDACTED=1"
  }
}
