# Publica a linha legado (Windows 7 / 8 / 8.1) — manifestos no repo + .exe no R2.
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
$updates = Join-Path $root "web\content\desktop-updates\legacy"
$webRoot = Join-Path $root "web"

$pkg = Get-Content (Join-Path $legacy "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
$outDir = Join-Path $legacy "release631-legacy"

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

New-Item -ItemType Directory -Force -Path $updates | Out-Null
Copy-Item (Join-Path $outDir "latest.yml") $updates -Force
Copy-Item (Join-Path $outDir "latest-ia32.yml") $updates -Force

Write-Host "Manifestos -> web\content\desktop-updates\legacy\"
Get-ChildItem $updates

Write-Host ""
Write-Host "Enviando instaladores legado para o R2..."
Push-Location $webRoot
node --env-file=.env.local scripts/upload-installers-r2.mjs $outDir
Pop-Location

Write-Host ""
Write-Host "Proximo passo (na raiz do repo):"
Write-Host "  git add web/content/desktop-updates/legacy/"
Write-Host "  git commit -m 'Publica MontaHD legado $version (R2)'"
Write-Host "  git push"
