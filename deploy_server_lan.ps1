param(
  [string]$ServerIp = "192.168.1.52",
  [string]$ShareName = "EnergyLinkServer",
  [string]$SubPath = "",
  [switch]$Full,
  [switch]$Seed,
  [string]$Username = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcRelease = Join-Path $repoRoot "dist\EnergyLink_v2.0"

if (-not (Test-Path $srcRelease)) {
  throw "Missing build output: $srcRelease. Run: npm run build (in frontend) then python build_exe.py"
}

$dstRoot = "\\$ServerIp\$ShareName"
if ($SubPath) {
  $clean = $SubPath.TrimStart('\').TrimStart('/')
  if ($clean) {
    $dstRoot = Join-Path $dstRoot $clean
  }
}

function Ensure-ShareAccess([string]$unc, [string]$user, [string]$pass) {
  if (Test-Path $unc) { return }

  if ($user -and $pass) {
    $cmd = "net use `"$unc`" /user:`"$user`" `"$pass`" /persistent:no"
    $out = cmd.exe /c $cmd 2>&1
  }

  if (-not (Test-Path $unc)) {
    $hint = @(
      "Cannot access destination: $unc",
      "",
      "Fix checklist (on Server):",
      "  1) Share folder exists: \\$ServerIp\$ShareName",
      "  2) Share permissions + NTFS permissions allow Write for your user",
      "  3) Network discovery + File and Printer Sharing enabled",
      "",
      "Fix checklist (on your PC):",
      "  - Try open in Explorer: $unc",
      "  - If it asks for credentials, rerun with:",
      "      -Username <SERVER\\user> -Password <password>",
      "",
      "Manual connect test:",
      "  net use `"$unc`" /user:`"<SERVER\\user>`" `"<password>`" /persistent:no"
    ) -join "`r`n"
    throw $hint
  }
}

Ensure-ShareAccess $dstRoot $Username $Password

if ($Full) {
  robocopy $srcRelease $dstRoot /MIR /R:2 /W:2 /NFL /NDL /NP | Out-Host
  Write-Host "Full deploy OK: $srcRelease -> $dstRoot"
  exit 0
}

$exeSrc = Join-Path $srcRelease "EnergyLinkServer_v2.exe"
$exeDst = Join-Path $dstRoot "EnergyLinkServer_v2.exe"

if (-not (Test-Path $exeSrc)) {
  throw "Missing EXE: $exeSrc"
}

Copy-Item -Path $exeSrc -Destination $exeDst -Force

$tplSrc = Join-Path $srcRelease "device_templates"
$tplDst = Join-Path $dstRoot "device_templates"
if (Test-Path $tplSrc) {
  robocopy $tplSrc $tplDst /MIR /R:2 /W:2 /NFL /NDL /NP | Out-Host
}

function Copy-IfMissing([string]$relativePath) {
  $src = Join-Path $srcRelease $relativePath
  $dst = Join-Path $dstRoot $relativePath
  if ((Test-Path $src) -and (-not (Test-Path $dst))) {
    $dstDir = Split-Path -Parent $dst
    if ($dstDir) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "Seed file copied: $relativePath"
  }
}

Copy-IfMissing "users.json"
Copy-IfMissing "sessions.json"
Copy-IfMissing "active_project.json"
Copy-IfMissing "manager\control.json"

if ($Seed) {
  $projSrc = Join-Path $srcRelease "projects"
  $projDst = Join-Path $dstRoot "projects"
  if ((Test-Path $projSrc) -and (-not (Test-Path $projDst))) {
    robocopy $projSrc $projDst /E /R:2 /W:2 /NFL /NDL /NP | Out-Host
    Write-Host "Seed projects copied (projects/)"
  }
}

Write-Host "Deploy OK: $dstRoot"

