# Generate a local TLS cert, trust it for this Windows user, and start the clinic HTTPS bridge.
# Required so https://venerandahospital.org can load data from LAN HTTP APIs (e.g. 192.168.1.130)
# without Chrome "Allow insecure content".

param(
  [switch]$SkipStart,
  [int]$Port = 8443
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $PSScriptRoot '.clinic-bridge-certs'
$pfxPath = Join-Path $certDir 'bridge.pfx'
$passPath = Join-Path $certDir 'bridge.pass'
$pass = 'clinic-bridge-local'

New-Item -ItemType Directory -Path $certDir -Force | Out-Null

$needNewCert = -not (Test-Path -LiteralPath $pfxPath)
if ($needNewCert) {
  Write-Host 'Creating local bridge certificate...'
  $cert = New-SelfSignedCertificate `
    -Subject 'CN=Veneranda Clinic HTTPS Bridge' `
    -DnsName @('localhost', '127.0.0.1') `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(10)

  $securePass = ConvertTo-SecureString -String $pass -Force -AsPlainText
  Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePass | Out-Null
  Set-Content -LiteralPath $passPath -Value $pass -NoNewline -Encoding ascii

  # Trust for this user so Chrome accepts https://127.0.0.1:8443
  $root = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::Root,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  $root.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
  $root.Add($cert)
  $root.Close()
  Write-Host "Trusted bridge cert thumbprint $($cert.Thumbprint)"
} else {
  Write-Host 'Using existing bridge certificate.'
}

if ($SkipStart) {
  Write-Host 'Cert ready. Skipping bridge start.'
  exit 0
}

$env:CLINIC_BRIDGE_PORT = "$Port"
Write-Host "Starting bridge on https://127.0.0.1:$Port ..."
Set-Location -LiteralPath $repoRoot
node "$PSScriptRoot\clinic-https-bridge.mjs"