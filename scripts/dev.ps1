param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RunDirectory = Join-Path $ProjectRoot ".run"
$PidFile = Join-Path $RunDirectory "dev.pid"
$StdoutLog = Join-Path $RunDirectory "dev.out.log"
$StderrLog = Join-Path $RunDirectory "dev.err.log"

function Assert-Command([string]$Name, [string]$Message) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $Message
    }
}

function Get-ServerProcess {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $serverProcessId = [int](Get-Content -Raw -LiteralPath $PidFile)
    return Get-Process -Id $serverProcessId -ErrorAction SilentlyContinue
}

function Start-Stack {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json"))) {
        throw "package.json was not found. Scaffold the application first."
    }

    Assert-Command "npm.cmd" "npm was not found. Install Node.js and npm first."
    New-Item -ItemType Directory -Force -Path $RunDirectory | Out-Null

    $existingProcess = Get-ServerProcess
    if ($existingProcess) {
        Write-Host "eFightersArena is already running (PID $($existingProcess.Id))."
        return
    }
    Remove-Item -Force -LiteralPath $PidFile -ErrorAction SilentlyContinue

    Push-Location $ProjectRoot
    try {
        Write-Host "Connecting to local PostgreSQL and applying migrations..."
        & npm.cmd run db:migrate
        if ($LASTEXITCODE -ne 0) { throw "Database migrations failed. Verify DATABASE_URL and that local PostgreSQL is running." }
        & npm.cmd run db:seed
        if ($LASTEXITCODE -ne 0) { throw "Database seeding failed." }

        $serverProcess = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/d", "/s", "/c", "npm.cmd run dev" `
            -WorkingDirectory $ProjectRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdoutLog `
            -RedirectStandardError $StderrLog `
            -PassThru

        Set-Content -LiteralPath $PidFile -Value $serverProcess.Id -NoNewline
        Start-Sleep -Seconds 3
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) {
            Remove-Item -Force -LiteralPath $PidFile -ErrorAction SilentlyContinue
            throw "Development server exited during startup. Run 'make logs' for details."
        }

        Write-Host "eFightersArena started in the background (PID $($serverProcess.Id))."
        Write-Host "Your terminal is ready. Use 'make stop' instead of Ctrl+C."
        Write-Host "Open http://localhost:3000"
    }
    finally {
        Pop-Location
    }
}

function Stop-Stack {
    $serverProcess = Get-ServerProcess
    if ($serverProcess) {
        & taskkill.exe /PID $serverProcess.Id /T /F | Out-Null
        Write-Host "eFightersArena web server stopped (PID $($serverProcess.Id))."
    }
    else {
        Write-Host "eFightersArena web server is not running."
    }
    Remove-Item -Force -LiteralPath $PidFile -ErrorAction SilentlyContinue

}

function Show-Status {
    $serverProcess = Get-ServerProcess
    if ($serverProcess) {
        Write-Host "eFightersArena web server is running (PID $($serverProcess.Id))."
    }
    else {
        Write-Host "eFightersArena web server is stopped."
    }

    $databaseReachable = Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    $databaseLabel = if ($databaseReachable) { "reachable on localhost:5432" } else { "not reachable on localhost:5432" }
    Write-Host "Local PostgreSQL is $databaseLabel."
}

function Show-Logs {
    if (Test-Path -LiteralPath $StderrLog) {
        $errors = Get-Content -LiteralPath $StderrLog -Tail 30
        if ($errors) {
            Write-Host "--- errors ---"
            $errors
        }
    }
    if (-not (Test-Path -LiteralPath $StdoutLog)) {
        Write-Host "No development log exists yet. Run 'make start' first."
        return
    }
    Write-Host "--- output (Ctrl+C only exits the log viewer) ---"
    Get-Content -LiteralPath $StdoutLog -Tail 50 -Wait
}

switch ($Action) {
    "start" { Start-Stack }
    "stop" { Stop-Stack }
    "restart" { Stop-Stack; Start-Stack }
    "status" { Show-Status }
    "logs" { Show-Logs }
}
