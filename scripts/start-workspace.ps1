param(
    [ValidateRange(1, 65535)][int]$DatabasePort = 5432,
    [ValidateRange(1, 65535)][int]$BackendPort = 8000,
    [ValidateRange(1, 65535)][int]$FrontendPort = 3000
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$autoBackendPort = -not $PSBoundParameters.ContainsKey('BackendPort') -and -not $env:NEXUSAI_BACKEND_PORT
if (-not $PSBoundParameters.ContainsKey('BackendPort') -and $env:NEXUSAI_BACKEND_PORT) {
    $BackendPort = [int]$env:NEXUSAI_BACKEND_PORT
}
if (-not $PSBoundParameters.ContainsKey('FrontendPort') -and $env:NEXUSAI_FRONTEND_PORT) {
    $FrontendPort = [int]$env:NEXUSAI_FRONTEND_PORT
}

function Get-DockerEngineState {
    $ErrorActionPreference = 'Continue'
    $output = docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -eq 0) { return 'ready' }
    if (($output | Out-String) -match 'manually paused') { return 'paused' }
    if (($output | Out-String) -match '(?im)^.*(?:error during connect|failed to connect|docker_engine|dockerDesktopLinuxEngine).*(?:Access is denied|permission denied)') {
        return 'access-denied'
    }
    return 'unavailable'
}

function Start-DockerEngine {
    if (-not (Get-Command docker -CommandType Application -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI was not found. Install Docker Desktop and reopen the terminal.'
    }
    $state = Get-DockerEngineState
    if ($state -eq 'ready') { return }
    if ($state -eq 'paused') {
        throw 'Docker Desktop is manually paused. Click Resume in the Docker Desktop dashboard or tray menu, then run START_ALL.cmd again.'
    }
    if ($state -eq 'access-denied') {
        throw 'This terminal cannot access Docker. Run START_ALL.cmd from your normal Windows terminal with access to Docker Desktop.'
    }

    Write-Host 'Starting Docker Desktop and waiting for the engine...'
    docker desktop start --timeout 120
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $state = Get-DockerEngineState
        if ($state -eq 'ready') { return }
        if ($state -eq 'paused') {
            throw 'Docker Desktop is manually paused. Click Resume in the Docker Desktop dashboard or tray menu, then run START_ALL.cmd again.'
        }
        if ($state -eq 'access-denied') {
            throw 'Docker started, but this terminal cannot access its engine. Run START_ALL.cmd from your normal Windows terminal.'
        }
        Start-Sleep -Seconds 2
    }
    throw 'Docker Desktop did not make its engine available. Check Docker Desktop for a setup or startup message, then retry.'
}

function Test-LoopbackPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', $Port); return $true }
    catch [Net.Sockets.SocketException] {
        return $_.Exception.SocketErrorCode -ne [Net.Sockets.SocketError]::ConnectionRefused
    }
    finally { $client.Dispose() }
}

function Test-RunningWorkspace([int]$ApiPort, [int]$WebPort) {
    try {
        $ready = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/ready" -TimeoutSec 3
        if ($ready.database -ne 'available') { return $false }
    }
    catch { return $false }

    try {
        $dashboard = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$WebPort/dashboard" -TimeoutSec 3
        if ($dashboard.Content -notmatch '<title>[^<]*NexusAI</title>') { return $false }
    }
    catch { return $false }

    try {
        $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$WebPort/api/workspace/workspaces" -TimeoutSec 3
        return $false
    }
    catch {
        $response = $_.Exception.Response
        return ($null -ne $response) -and ([int]$response.StatusCode -eq 401) -and
            [bool]$response.Headers['X-Request-ID']
    }
}

$hasher = [Security.Cryptography.SHA256]::Create()
try {
    $key = $hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))
    $project = 'nexusai-dev-' + ([BitConverter]::ToString($key).Replace('-', '').Substring(0, 12)).ToLowerInvariant()
}
finally { $hasher.Dispose() }

$names = @('NEXUSAI_POSTGRES_PASSWORD', 'NEXUSAI_POSTGRES_PORT', 'NEXUSAI_DATABASE_URL', 'NEXUSAI_BACKEND_PORT', 'NEXUSAI_FRONTEND_PORT')
$original = @{}
foreach ($name in $names) { $original[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

Push-Location -LiteralPath $root
try {
    if ($autoBackendPort -and (Test-LoopbackPort $BackendPort) -and
        -not (Test-RunningWorkspace $BackendPort $FrontendPort)) {
        $BackendPort = 8001
        Write-Host 'Port 8000 is in use. Using backend port 8001 for this workspace.'
    }
    if ($BackendPort -eq $FrontendPort -or $BackendPort -eq $DatabasePort -or $FrontendPort -eq $DatabasePort) {
        throw 'The frontend, backend and database ports must be different.'
    }
    if (Test-LoopbackPort $BackendPort) {
        if (Test-RunningWorkspace $BackendPort $FrontendPort) {
            Write-Host "NexusAI workspace is already running. Open http://127.0.0.1:$FrontendPort/dashboard"
            return
        }
        throw "Backend port $BackendPort is already in use. Stop your previous launcher or choose a different BackendPort."
    }
    if (Test-LoopbackPort $FrontendPort) {
        throw "Frontend port $FrontendPort is already in use. Stop your previous launcher or choose a different FrontendPort."
    }
    if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue) -or
        -not (Get-Command uv -CommandType Application -ErrorAction SilentlyContinue)) {
        throw 'Node.js and uv are required. Install them and reopen the terminal.'
    }
    if (-not (Test-Path -LiteralPath '.venv/Scripts/alembic.exe' -PathType Leaf) -or
        -not (Test-Path -LiteralPath 'frontend/node_modules/next/dist/bin/next' -PathType Leaf) -or
        -not (Test-Path -LiteralPath 'frontend/.next/BUILD_ID' -PathType Leaf)) {
        throw 'Project dependencies or the frontend build are missing. Run powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -WithAgents first.'
    }
    Start-DockerEngine
    $container = docker compose -p $project --profile database ps -a -q database
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the NexusAI database container.' }

    if ($container) {
        $containerEnv = docker inspect --format '{{json .Config.Env}}' $container | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the NexusAI database configuration.' }
        $passwordEntry = @($containerEnv | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' })
        if ($passwordEntry.Count -ne 1 -or $passwordEntry[0] -eq 'POSTGRES_PASSWORD=') {
            throw 'The existing NexusAI database has no configured password.'
        }
        $password = $passwordEntry[0].Substring('POSTGRES_PASSWORD='.Length)
        $bindings = docker inspect --format '{{json .HostConfig.PortBindings}}' $container | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or [int]$bindings.'5432/tcp'[0].HostPort -ne $DatabasePort) {
            throw 'Use the DatabasePort from the existing NexusAI database container.'
        }
    }
    else {
        $bytes = New-Object byte[] 32
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($bytes) }
        finally { $generator.Dispose() }
        $password = [Convert]::ToBase64String($bytes)
    }
    $env:NEXUSAI_POSTGRES_PASSWORD = $password
    $env:NEXUSAI_POSTGRES_PORT = [string]$DatabasePort
    $env:NEXUSAI_DATABASE_URL = 'postgresql+psycopg://nexusai:{0}@127.0.0.1:{1}/nexusai' -f [Uri]::EscapeDataString($password), $DatabasePort
    $env:NEXUSAI_BACKEND_PORT = [string]$BackendPort
    $env:NEXUSAI_FRONTEND_PORT = [string]$FrontendPort

    docker compose -p $project --profile database up -d --no-recreate database
    if ($LASTEXITCODE -ne 0) { throw 'The NexusAI PostgreSQL container could not start.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 25; $attempt++) {
        docker compose -p $project --profile database exec -T database pg_isready -h 127.0.0.1 -U nexusai -d nexusai | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'PostgreSQL did not become ready.' }

    uv run --locked --no-sync alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Review the Alembic output above.' }

    if (Test-LoopbackPort $BackendPort) {
        throw "Backend port $BackendPort was taken during startup. Choose a different BackendPort."
    }
    node (Join-Path $root 'scripts/nexusai.mjs') start
    if ($LASTEXITCODE -ne 0) { throw 'NexusAI application startup failed.' }
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $original[$name], 'Process') }
    Pop-Location
}
