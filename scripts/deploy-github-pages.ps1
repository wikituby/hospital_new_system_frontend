# Build and deploy ngwiki production bundle to GitHub Pages.
# Requires GH_PAGES_TOKEN or GH_TOKEN with Contents:write on
# venerandahospital/ihms_online_ui_for_local_veneranda
#
# Publishes the full Angular build (index, JS/CSS bundles, fonts, and assets/).

param(
  [string]$CommitMessage = "Deploy frontend to GitHub Pages",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repoRoot 'dist\wiki-pages-deploy'
$pagesRepo = 'venerandahospital/ihms_online_ui_for_local_veneranda'
$tokenFile = Join-Path $repoRoot '.gh-pages-token'
$token = $env:GH_PAGES_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }
if (-not $token -and (Test-Path -LiteralPath $tokenFile)) {
  $token = [System.IO.File]::ReadAllText($tokenFile).Trim() -replace "`0", ''
}
if (-not $token) {
  throw 'Set GH_PAGES_TOKEN, GH_TOKEN, or create .gh-pages-token with a fine-grained PAT (Contents: write on ihms_online_ui_for_local_veneranda).'
}

$env:GH_TOKEN = $token
$env:GIT_TERMINAL_PROMPT = '0'

if (-not $SkipBuild) {
  Set-Location -LiteralPath $repoRoot
  Remove-Item -LiteralPath $dist -Recurse -Force -ErrorAction SilentlyContinue
  node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng build --configuration production --base-href / --output-path dist/wiki-pages-deploy
  if ($LASTEXITCODE -ne 0) { throw "ng build failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
  throw "Missing build output at $dist"
}

$mainBundle = Get-ChildItem -LiteralPath $dist -Filter 'main.*.js' | Select-Object -First 1
if (-not $mainBundle) { throw 'No main.*.js bundle in build output.' }

$work = Join-Path $env:TEMP 'pages-deploy-ngwiki'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null
Set-Location $work

$remote = 'https://x-access-token:' + $token + '@github.com/' + $pagesRepo + '.git'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
git clone --depth 1 -b main $remote repo 2>&1 | ForEach-Object { $_ -replace [regex]::Escape($token), '***' }
$cloneExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($cloneExit -ne 0) { throw "git clone failed with exit code $cloneExit" }
Set-Location repo
git config user.email 'venerandahospital@users.noreply.github.com'
git config user.name 'venerandahospital'

# Clear previous site files (keep .git) so removed assets/bundles do not linger.
Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

# Copy full production build, including assets/images.
Copy-Item -Path (Join-Path $dist '*') -Destination (Get-Location) -Recurse -Force

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host 'No changes to deploy.'
  exit 0
}

git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m $CommitMessage
$ErrorActionPreference = 'Continue'
git -c http.postBuffer=524288000 push origin main 2>&1 | ForEach-Object { $_ -replace [regex]::Escape($token), '***' }
$pushExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($pushExit -ne 0) { throw "git push failed with exit code $pushExit" }

$assetCount = 0
if (Test-Path -LiteralPath '.\assets') {
  $assetCount = (Get-ChildItem -LiteralPath '.\assets' -Recurse -File).Count
}
Write-Host "Deployed $($mainBundle.Name) + $assetCount asset files to https://venerandahospital.org/"
