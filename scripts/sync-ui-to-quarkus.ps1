$ErrorActionPreference = "Stop"
$FrontendRoot = "D:\from recent\hospitaldesktop\development\frontend_veneranda\ngwiki"
$BackendResources = "D:\from recent\hospitaldesktop\development\backend\hospital\hospital\src\main\resources\META-INF\resources\app"
$dist = Join-Path $FrontendRoot "dist\quarkus-ui"

Write-Host "Building Angular UI for Quarkus..."
Set-Location -LiteralPath $FrontendRoot
if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
$env:NODE_OPTIONS = "--max-old-space-size=8192"
node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng build --configuration production --base-href /health_care/app/ --output-path dist/quarkus-ui
if ($LASTEXITCODE -ne 0) { throw "ng build failed: $LASTEXITCODE" }
if (-not (Test-Path (Join-Path $dist "index.html"))) { throw "Missing index.html in $dist" }

Write-Host "Syncing to $BackendResources"
if (Test-Path -LiteralPath $BackendResources) { Remove-Item -LiteralPath $BackendResources -Recurse -Force }
New-Item -ItemType Directory -Path $BackendResources -Force | Out-Null
Copy-Item -Path (Join-Path $dist "*") -Destination $BackendResources -Recurse -Force
Write-Host "Done. Restart Quarkus, then open http://localhost:8080/health_care/app/"