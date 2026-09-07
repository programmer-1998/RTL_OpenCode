#Requires -Version 5.1
# opencode Desktop RTL/bidi patch — Windows
# =====================================================================
# Injects `dir="auto"` + `unicode-bidi: plaintext` support into the
# opencode Desktop app (Electron) via the shared engine
# (..\lib\patch-asar.mjs). The script finds app.asar, re-launches
# itself with administrator rights (UAC) and runs the engine.
#
# Usage (from an elevated PowerShell, or it will ask via UAC):
#   powershell -ExecutionPolicy Bypass -File desktop-rtl.ps1
#   powershell -ExecutionPolicy Bypass -File desktop-rtl.ps1 -Unpatch
#   powershell -ExecutionPolicy Bypass -File desktop-rtl.ps1 -Asar C:\path\to\app.asar
param(
  [string]$Asar,
  [switch]$Unpatch,
  [switch]$NoBackup,
  [switch]$Elevated
)

$ErrorActionPreference = "Stop"

function Write-Info { Write-Host "[i] $args" -ForegroundColor Cyan }
function Write-Fail { Write-Host "[!] $args" -ForegroundColor Red; exit 1 }

# ---- locate node ------------------------------------------------------
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $candidate = Join-Path $env:ProgramFiles "nodejs\node.exe"
  if (Test-Path $candidate) { $node = $candidate }
}
if (-not $node) { Write-Fail "node.js not found — install Node 20+ from https://nodejs.org/" }

# ---- UAC elevation ----------------------------------------------------
$identity   = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal  = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin    = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  if ($Elevated) { Write-Fail "This instance is not running as administrator." }

  $arguments = " -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated"
  if ($Asar)    { $arguments += " -Asar `"$Asar`"" }
  if ($Unpatch) { $arguments += " -Unpatch" }
  if ($NoBackup){ $arguments += " -NoBackup" }

  Write-Info "Requesting administrator privileges (UAC)..."
  Start-Process -Verb RunAs powershell.exe -ArgumentList $arguments -Wait
  exit $LASTEXITCODE
}

# ---- locate app.asar --------------------------------------------------
if (-not $Asar) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA  "Programs\OpenCode\resources\app.asar"),
    (Join-Path $env:LOCALAPPDATA  "Programs\opencode\resources\app.asar"),
    (Join-Path $env:ProgramFiles  "OpenCode\resources\app.asar"),
    (Join-Path ${env:ProgramFiles(x86)} "OpenCode\resources\app.asar")
  ) | Where-Object { Test-Path $_ }
  $Asar = $candidates | Select-Object -First 1
}
if (-not $Asar -or -not (Test-Path $Asar)) {
  Write-Fail "app.asar not found — pass -Asar C:\path\to\opencode\resources\app.asar"
}
$Asar = (Resolve-Path $Asar).Path
Write-Info "patching: $Asar"

$engine = Join-Path $PSScriptRoot "..\lib\patch-asar.mjs"
if (-not (Test-Path $engine)) { Write-Fail "engine not found at $engine" }
$engine = (Resolve-Path $engine).Path

# ---- run the shared engine --------------------------------------------
$nodeArgs = @($engine, "--asar", $Asar)
if ($Unpatch)  { $nodeArgs += "--unpatch" }
if ($NoBackup) { $nodeArgs += "--no-backup" }

Write-Info "running patch engine..."
& $node @nodeArgs
exit $LASTEXITCODE