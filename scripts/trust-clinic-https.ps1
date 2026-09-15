# One-time per PC: trust the clinic API certificate so https://venerandahospital.org
# can call https://CLINIC-IP:8443 from every computer (no "Allow insecure content", no bridge).
param(
  [string]$CerPath = ""
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$defaultCer = Join-Path $repoRoot '..\..\backend\hospital\hospital\certs\clinic-ca.cer'
if (-not $CerPath) {
  $local = Join-Path $PSScriptRoot 'clinic-ca.cer'
  if (Test-Path -LiteralPath $local) { $CerPath = $local }
  elseif (Test-Path -LiteralPath $defaultCer) { $CerPath = (Resolve-Path $defaultCer).Path }
  else { throw "clinic-ca.cer not found. Copy it next to this script or pass -CerPath." }
}

$CerPath = (Resolve-Path -LiteralPath $CerPath).Path
Write-Host "Importing $CerPath into CurrentUser Root (click Yes if Windows asks)..."
Import-Certificate -FilePath $CerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Write-Host 'Done. Reload https://venerandahospital.org and Connect to the clinic IP again.'