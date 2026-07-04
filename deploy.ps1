param(
  [string]$Version = "",
  [string]$Notes = "",
  [switch]$SkipExe
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Check for uncommitted changes
Set-Location $root
$status = git status --porcelain
if (-not $status) {
  Write-Host "No changes detected. Nothing to deploy." -ForegroundColor Yellow
  exit 0
}

# Get current version info
$currentVersionData = Get-Content "$root\server\updates\version.json" -Raw | ConvertFrom-Json

if ($SkipExe) {
  $Version = $currentVersionData.version
  $installer = $currentVersionData.installer
} elseif (-not $Version) {
  $parts = $currentVersionData.version.Split(".")
  $patch = [int]$parts[2] + 1
  $Version = "$($parts[0]).$($parts[1]).$patch"
}

Write-Host "=== GameVault Deploy v$Version ===" -ForegroundColor Cyan

# 2. Build frontend
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Green
Set-Location "$root\client"
npm run build
if (-not $?) { throw "Frontend build failed" }

# 3. Build .exe (unless skipped)
if ($SkipExe) {
  Write-Host "`n[2/4] Skipping .exe build (-SkipExe)" -ForegroundColor Yellow
} else {
  Write-Host "`n[2/4] Building .exe installer..." -ForegroundColor Green
  npm run electron:build
  if (-not $?) { throw "Electron build failed" }

  Write-Host "`n[3/4] Copying installer to updates..." -ForegroundColor Green
  $installer = "GameVault-Setup-$Version.exe"
  Copy-Item "release\$installer" "$root\server\updates\$installer" -Force
}

# 4. Update version.json
Write-Host "`n[4/4] Updating version.json..." -ForegroundColor Green
$versionJson = @{
  version   = $Version
  installer = $installer
  notes     = $Notes
} | ConvertTo-Json
Set-Content "$root\server\updates\version.json" $versionJson -Encoding UTF8

# 5. Commit and push
Write-Host "Committing and pushing..." -ForegroundColor Green
Set-Location $root
git add -A
$msg = if ($Notes -ne "") { "v$Version — $Notes" } else { "v$Version" }
git commit -m $msg
git push

Write-Host "`n=== Done! v$Version deployed ===" -ForegroundColor Cyan
