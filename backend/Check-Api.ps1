$ErrorActionPreference = 'Stop'
$privateEnv = Join-Path $PSScriptRoot '.secrets/mysql.env'
if (-not $env:NEXTSTEP_CHECKS_CONNECTION -and (Test-Path -LiteralPath $privateEnv)) {
    $line = [IO.File]::ReadAllLines($privateEnv) | Where-Object { $_.StartsWith('MYSQL_PASSWORD=') } | Select-Object -First 1
    $password = $line.Substring('MYSQL_PASSWORD='.Length)
    $env:NEXTSTEP_CHECKS_CONNECTION = "Server=127.0.0.1;Port=33306;Database=nextstep;User ID=nextstep;Password=$password;Connection Timeout=5;"
}
if (-not $env:NEXTSTEP_CHECKS_CONNECTION) { throw 'Set NEXTSTEP_CHECKS_CONNECTION for the local MySQL checks.' }
dotnet run --project (Join-Path $PSScriptRoot 'NextStep.Api.Checks/NextStep.Api.Checks.csproj') --configuration Release --verbosity quiet
exit $LASTEXITCODE
