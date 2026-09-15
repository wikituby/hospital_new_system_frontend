# Lasting multi-PC HTTPS for the clinic API.
# Run this ON the machine whose LAN IP staff type in Connect (or set -Upstream to the mother phone).
param(
  [string]$Upstream = '127.0.0.1:8080',
  [string]$Bind = '0.0.0.0',
  [int]$Port = 8443
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$env:CLINIC_UPSTREAM = $Upstream
$env:CLINIC_BRIDGE_BIND = $Bind
$env:CLINIC_BRIDGE_PORT = "$Port"
Write-Host "Starting clinic HTTPS gateway $Bind`:$Port -> http://$Upstream"
Set-Location -LiteralPath $repoRoot
node (Join-Path $PSScriptRoot 'clinic-https-bridge.mjs')