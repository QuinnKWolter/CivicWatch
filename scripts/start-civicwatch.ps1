param(
  [switch]$SkipDbStart
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -le 0) {
      continue
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Set-DefaultEnv {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
  }
}

Import-DotEnv (Join-Path $repoRoot ".env")

Set-DefaultEnv "POSTGRES_HOST" "localhost"
Set-DefaultEnv "POSTGRES_PORT" "55432"
Set-DefaultEnv "POSTGRES_DB" "civicwatch_explore"
Set-DefaultEnv "POSTGRES_USER" "postgres"
Set-DefaultEnv "DATABASE_URL" "postgres://$($env:POSTGRES_USER)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
Set-DefaultEnv "API_PORT" "4000"
Set-DefaultEnv "API_HOST" "127.0.0.1"
Set-DefaultEnv "API_BASE_URL" "http://127.0.0.1:$($env:API_PORT)/api/v1"
Set-DefaultEnv "PUBLIC_API_BASE_URL" $env:API_BASE_URL

$dataDir = Join-Path $repoRoot ".postgres-data"
$logDir = Join-Path $repoRoot ".postgres-log"
$dbPort = $env:POSTGRES_PORT

if (-not (Test-Path -LiteralPath $dataDir)) {
  throw "Postgres data directory not found at $dataDir. Restore the CivicWatch dump before launching."
}

if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

if (-not $SkipDbStart) {
  $pgCtl = Get-Command pg_ctl -ErrorAction SilentlyContinue
  if (-not $pgCtl) {
    throw "pg_ctl was not found on PATH. Add PostgreSQL's bin directory to PATH, then run this script again."
  }

  & $pgCtl.Source status -D $dataDir *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting isolated CivicWatch Postgres on localhost:$dbPort..."
    & $pgCtl.Source `
      -D $dataDir `
      -o "-p $dbPort -c listen_addresses=localhost -c shared_buffers=1GB -c work_mem=32MB -c maintenance_work_mem=1GB" `
      -l (Join-Path $logDir "postgres.log") `
      start

    if ($LASTEXITCODE -ne 0) {
      throw "Could not start CivicWatch Postgres. See .postgres-log\postgres.log."
    }
  } else {
    Write-Host "CivicWatch Postgres is already running from .postgres-data."
  }
}

Write-Host "Launching CivicWatch..."
Write-Host "Web: http://127.0.0.1:5173/"
Write-Host "API: http://$($env:API_HOST):$($env:API_PORT)/"
pnpm run dev
