param([switch]$MigrateOnly)
$ErrorActionPreference = 'Stop'
$backendRoot = $PSScriptRoot
$privateEnv = Join-Path $backendRoot '.secrets/mysql.env'
if (Test-Path -LiteralPath $privateEnv) {
    $passwordLine = [IO.File]::ReadAllLines($privateEnv) | Where-Object { $_.StartsWith('MYSQL_PASSWORD=') } | Select-Object -First 1
    if (-not $env:ConnectionStrings__NextStep -and $passwordLine) {
        $password = $passwordLine.Substring('MYSQL_PASSWORD='.Length)
        $env:ConnectionStrings__NextStep = "Server=127.0.0.1;Port=33306;Database=nextstep;User ID=nextstep;Password=$password;Connection Timeout=5;"
    }
}
if (-not $env:ConnectionStrings__NextStep) { throw 'Set ConnectionStrings__NextStep or create the private .secrets/mysql.env file first.' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$project = Join-Path $backendRoot 'NextStep.Api/NextStep.Api.csproj'
dotnet run --project $project -- --migrate
if ($LASTEXITCODE -ne 0) { throw 'Schema migration failed; the API was not started.' }
if (-not $MigrateOnly) { dotnet run --project $project --no-build --urls http://127.0.0.1:5080 }
