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

# 2. Update package.json version
Write-Host "`n[1/5] Updating package.json version..." -ForegroundColor Green
$pkgContent = Get-Content "$root\client\package.json" -Raw
$pkgContent = $pkgContent -replace '"version":\s*".*?"', "`"version`": `"$Version`""
[System.IO.File]::WriteAllText("$root\client\package.json", $pkgContent)

# 3. Build frontend
Write-Host "`n[2/5] Building frontend..." -ForegroundColor Green
Set-Location "$root\client"
npm run build
if (-not $?) { throw "Frontend build failed" }

# 4. Build .exe (unless skipped)
if ($SkipExe) {
  Write-Host "`n[3/5] Skipping .exe build (-SkipExe)" -ForegroundColor Yellow
  # Keep existing installer name from version.json
} else {
  Write-Host "`n[3/5] Building .exe installer..." -ForegroundColor Green
  npm run electron:build
  if (-not $?) { throw "Electron build failed" }

  Write-Host "`n[4/5] Copying installer to updates..." -ForegroundColor Green
  $installer = "GameVault Setup $Version.exe"
  Copy-Item "release\$installer" "$root\server\updates\$installer" -Force
}

# 5. Update version.json
Write-Host "`n[5/5] Updating version.json..." -ForegroundColor Green
$versionJson = @{
  version   = $Version
  installer = $installer
  notes     = $Notes
} | ConvertTo-Json
[System.IO.File]::WriteAllText("$root\server\updates\version.json", $versionJson)

# 6. Commit and push
Write-Host "Committing and pushing..." -ForegroundColor Green
Set-Location $root
git add -A
$msg = if ($Notes -ne "") { "v$Version - $Notes" } else { "v$Version" }
git commit -m $msg
git push

Write-Host "`n=== Done! v$Version deployed ===" -ForegroundColor Cyan
