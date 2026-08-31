# Publica MontaHD no site — SOMENTE Windows nativo (PowerShell ou CMD).
# NÃO rode no WSL/Git Bash no Linux: o setup.exe fica corrompido (~450 KB).
#
# Uso (na pasta desktop):
#   npm.cmd ci
#   npm.cmd run dist:win
#   pwsh -File scripts/publish-windows.ps1

$ErrorActionPreference = "Stop"

if ($env:WSL_DISTRO_NAME -or $env:WSL_INTEROP) {
    Write-Error @"
Detectado WSL. O instalador NSIS NÃO funciona aqui.
Abra PowerShell nativo do Windows (não Ubuntu/WSL) em:
  C:\Users\<voce>\Documents\DawloaderJogos\desktop
"@
}

$desktop = Split-Path $PSScriptRoot -Parent
$root = Split-Path $desktop -Parent
$downloads = Join-Path $root "web\public\downloads"

$version = (Get-Content (Join-Path $desktop "package.json") -Raw | ConvertFrom-Json).version
$setup = Join-Path $desktop "release20\MontaHD-$version-setup.exe"
$portable = Join-Path $desktop "release20\MontaHD-$version-portable.exe"
$yml = Join-Path $desktop "release20\latest.yml"

foreach ($path in @($setup, $portable, $yml)) {
    if (-not (Test-Path $path)) {
        Write-Error "Arquivo ausente: $path`nRode antes: npm.cmd run dist:win"
    }
}

$setupSize = (Get-Item $setup).Length
if ($setupSize -lt 50MB) {
    Write-Error @"
Setup inválido ($([math]::Round($setupSize / 1MB, 2)) MB). Esperado ~80 MB.
Se rodou no WSL ou Linux, delete release20\ e compile de novo no Windows nativo.
"@
}

New-Item -ItemType Directory -Force -Path $downloads | Out-Null
Copy-Item $setup $downloads -Force
Copy-Item $portable $downloads -Force
Copy-Item $yml $downloads -Force
$blockmap = Join-Path $desktop "release20\MontaHD-$version-setup.exe.blockmap"
if (Test-Path $blockmap) { Copy-Item $blockmap $downloads -Force }

Write-Host "OK — copiado para web\public\downloads\"
Get-ChildItem $downloads | Where-Object { $_.Name -like "MontaHD-$version*" -or $_.Name -eq "latest.yml" }
Write-Host ""
Write-Host "Próximo passo (na raiz do repo):"
Write-Host "  git add web/public/downloads/"
Write-Host "  git commit -m ""Publica MontaHD $version"""
Write-Host "  git push"
