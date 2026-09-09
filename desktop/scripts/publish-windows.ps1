# Publica MontaHD — manifestos no repo + instaladores no R2 (não na Vercel).
# SOMENTE Windows nativo (PowerShell ou CMD). NÃO rode no WSL.
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
  C:\Users\<voce>\Projects\DawloaderJogos\desktop
"@
}

$desktop = Split-Path $PSScriptRoot -Parent
$root = Split-Path $desktop -Parent
$updates = Join-Path $root "web\content\desktop-updates"
$webRoot = Join-Path $root "web"

$pkg = Get-Content (Join-Path $desktop "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
$outName = $pkg.build.directories.output
if (-not $outName) { $outName = "release" }
$outDir = Join-Path $desktop $outName
$setup = Join-Path $outDir "MontaHD-$version-setup.exe"
$portable = Join-Path $outDir "MontaHD-$version-portable.exe"
$yml = Join-Path $outDir "latest.yml"
$setupIa32 = Join-Path $outDir "MontaHD-$version-ia32-setup.exe"
$ymlIa32 = Join-Path $outDir "latest-ia32.yml"

foreach ($path in @($setup, $portable, $yml)) {
    if (-not (Test-Path $path)) {
        Write-Error "Arquivo ausente: $path`nRode antes: npm.cmd run dist:win:x64"
    }
}

$setupSize = (Get-Item $setup).Length
if ($setupSize -lt 50MB) {
    Write-Error @"
Setup inválido ($([math]::Round($setupSize / 1MB, 2)) MB). Esperado ~80 MB.
Se rodou no WSL ou Linux, delete a pasta de output e compile de novo no Windows nativo.
"@
}

New-Item -ItemType Directory -Force -Path $updates | Out-Null
Copy-Item $yml $updates -Force

if (Test-Path $setupIa32) {
    $ia32Size = (Get-Item $setupIa32).Length
    if ($ia32Size -lt 50MB) {
        Write-Error "Setup ia32 inválido ($([math]::Round($ia32Size / 1MB, 2)) MB)."
    }
    if (Test-Path $ymlIa32) { Copy-Item $ymlIa32 $updates -Force }
} else {
    Write-Warning "Build ia32 ausente. Rode: npm.cmd run dist:win:ia32"
}

Write-Host "Manifestos -> web\content\desktop-updates\"
Get-ChildItem $updates | Where-Object {
    $_.Name -like "latest*.yml"
}

Write-Host ""
Write-Host "Enviando instaladores para o R2..."
Push-Location $webRoot
node --env-file=.env.local scripts/upload-installers-r2.mjs $outDir
Pop-Location

Write-Host ""
Write-Host "Proximo passo (na raiz do repo):"
Write-Host "  git add web/content/desktop-updates/"
Write-Host "  git commit -m 'Publica MontaHD $version (R2)'"
Write-Host "  git push"
