# Publica a linha legado (Windows 7 / 8 / 8.1) em web/public/downloads/legacy.
# SOMENTE Windows nativo (PowerShell ou CMD). Não use WSL.
#
# Uso (na pasta desktop-legacy):
#   npm.cmd ci
#   npm.cmd run dist:win
#   pwsh -File scripts/publish-windows.ps1

$ErrorActionPreference = "Stop"

if ($env:WSL_DISTRO_NAME -or $env:WSL_INTEROP) {
    Write-Error @"
Detectado WSL. O instalador NSIS NÃO funciona aqui.
Abra PowerShell nativo do Windows (não Ubuntu/WSL) em:
  C:\Users\<voce>\Projects\DawloaderJogos\desktop-legacy
"@
}

$legacy = Split-Path $PSScriptRoot -Parent
$root = Split-Path $legacy -Parent
$downloads = Join-Path $root "web\public\downloads\legacy"

$pkg = Get-Content (Join-Path $legacy "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
$outDir = Join-Path $legacy "release-legacy"

$required = @(
    "MontaHD-$version-legacy-x64-setup.exe",
    "MontaHD-$version-legacy-ia32-setup.exe",
    "latest.yml",
    "latest-ia32.yml"
)

foreach ($name in $required) {
    $path = Join-Path $outDir $name
    if (-not (Test-Path $path)) {
        Write-Error "Arquivo ausente: $path`nRode antes: npm.cmd run dist:win"
    }
}

foreach ($name in @("MontaHD-$version-legacy-x64-setup.exe", "MontaHD-$version-legacy-ia32-setup.exe")) {
    $size = (Get-Item (Join-Path $outDir $name)).Length
    if ($size -lt 40MB) {
        Write-Error "Setup legado inválido ($name, $([math]::Round($size / 1MB, 2)) MB)."
    }
}

New-Item -ItemType Directory -Force -Path $downloads | Out-Null

$copyNames = @(
    "MontaHD-$version-legacy-x64-setup.exe",
    "MontaHD-$version-legacy-ia32-setup.exe",
    "MontaHD-$version-legacy-x64-portable.exe",
    "MontaHD-$version-legacy-ia32-portable.exe",
    "MontaHD-$version-legacy-x64-setup.exe.blockmap",
    "MontaHD-$version-legacy-ia32-setup.exe.blockmap",
    "latest.yml",
    "latest-ia32.yml"
)

foreach ($name in $copyNames) {
    $path = Join-Path $outDir $name
    if (Test-Path $path) { Copy-Item $path $downloads -Force }
}

Write-Host "OK — copiado para web\public\downloads\legacy\"
Get-ChildItem $downloads
Write-Host ""
Write-Host "Proximo passo (na raiz do repo):"
Write-Host "  git add web/public/downloads/legacy/"
Write-Host "  git commit -m 'Publica MontaHD legado $version'"
Write-Host "  git push"
