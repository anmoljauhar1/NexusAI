param([switch]$WithAgents)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$frontend = Join-Path $root 'frontend'

Push-Location -LiteralPath $root
try {
    $dependencyGroup = @()
    if ($WithAgents) { $dependencyGroup = @('--group', 'agents') }
    uv sync --locked --python 3.13 @dependencyGroup
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency setup failed.' }
}
finally { Pop-Location }

Push-Location -LiteralPath $frontend
try {
    if (Test-Path -LiteralPath 'node_modules') {
        npm.cmd install --prefer-offline --cache .npm-cache
    }
    else {
        npm.cmd ci --cache .npm-cache
    }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency setup failed.' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
finally { Pop-Location }

Write-Host 'Setup complete. Run START_ALL.cmd from the project folder.'
