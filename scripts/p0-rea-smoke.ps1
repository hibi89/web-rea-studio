param(
  [switch]$Execute,
  [string]$BrowserPath = '',
  [ValidateRange(1,65535)][int]$Port = 4317
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js required.' }
$nodeVersion = (& node -p 'process.versions.node').Trim()
$segments = $nodeVersion.Split('.')
$major = [int]$segments[0]
$minor = [int]$segments[1]
$compatible = (($major -eq 22 -and $minor -ge 19) -or ($major -eq 24 -and $minor -ge 11) -or ($major -ge 26))
if (-not $compatible) { throw "Unsupported REA Node.js version: $nodeVersion" }
$paths = @(
  $BrowserPath,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
$selected = $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
if (-not $selected) { throw 'Chrome/Edge not found. Supply -BrowserPath.' }
$env:REA_BROWSER_EXECUTABLE = [string]$selected
$env:P0_PORT = [string]$Port
Write-Host "Node: $nodeVersion"
Write-Host "Browser: $selected"
Write-Host "Fixture: http://127.0.0.1:$Port"
Write-Host 'REA release: rea-agents@6.5.0'
if (-not $Execute) {
  Write-Host 'PLAN ONLY: no network downloads or REA execution.'
  Write-Host 'Run .\scripts\p0-rea-smoke.ps1 -Execute after review.'
  exit 0
}
if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) { throw 'npx.cmd unavailable.' }
New-Item -ItemType Directory -Path results -Force | Out-Null
$fixtureProc = $null
try {
  $fixtureProc = Start-Process -FilePath 'node.exe' -ArgumentList @('fixtures/site/server.mjs') -WorkingDirectory $ProjectRoot -PassThru -NoNewWindow -RedirectStandardOutput 'results/fixture.stdout.log' -RedirectStandardError 'results/fixture.stderr.log'
  $up = $false
  for ($i=0; $i -lt 24; $i++) {
    if ($fixtureProc.HasExited) { break }
    try {
      $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 1
      if ($status.ok) { $up = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $up) { throw 'Fixture did not pass readiness check.' }
  & node scripts/generate-scenario.mjs
  if ($LASTEXITCODE -ne 0) { throw "Scenario generation failed: $LASTEXITCODE" }
  Write-Host 'Running pinned REA against the synthetic fixture...'
  # Windows PowerShell 5.1 can turn npm stderr warnings into NativeCommandError.
  # Redirect at the child-process boundary; never ignore the actual exit code.
  $reaStdout = Join-Path $ProjectRoot 'results/rea-capture.json'
  $reaStderr = Join-Path $ProjectRoot 'results/rea-stderr.log'
  $reaArguments = '/d /s /c "npx.cmd -y rea-agents@6.5.0 capture-browser-scenario results/browser-scenario.json --json"'
  $reaProcess = Start-Process -FilePath $env:ComSpec -ArgumentList $reaArguments -WorkingDirectory $ProjectRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $reaStdout -RedirectStandardError $reaStderr
  if ($reaProcess.ExitCode -ne 0) { throw "REA failed: exit $($reaProcess.ExitCode). Inspect results/rea-stderr.log." }
  & node scripts/check-capture.mjs results/rea-capture.json
  if ($LASTEXITCODE -ne 0) { throw 'REA capture output requires inspection.' }
  Write-Host 'Capture JSON parsed. Browser actions and evidence are NOT YET independently validated.'
}
finally {
  if ($fixtureProc -and -not $fixtureProc.HasExited) { Stop-Process -Id $fixtureProc.Id -Force -ErrorAction SilentlyContinue }
}
