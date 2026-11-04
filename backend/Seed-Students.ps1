$ErrorActionPreference = 'Stop'
$privateEnv = Join-Path $PSScriptRoot '.secrets/mysql.env'
if (-not $env:ConnectionStrings__NextStep -and (Test-Path -LiteralPath $privateEnv)) {
    $line = [IO.File]::ReadAllLines($privateEnv) | Where-Object { $_.StartsWith('MYSQL_PASSWORD=') } | Select-Object -First 1
    if ($line) { $env:ConnectionStrings__NextStep = 'Server=127.0.0.1;Port=33306;Database=nextstep;User ID=nextstep;Password=' + $line.Substring('MYSQL_PASSWORD='.Length) + ';Connection Timeout=5;' }
}
if (-not $env:ConnectionStrings__NextStep) { throw 'Configure the local database before seeding.' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$project = Join-Path $PSScriptRoot 'NextStep.Api/NextStep.Api.csproj'
dotnet run --project $project --configuration Release -- --migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; no accounts were seeded.' }
dotnet run --project $project --configuration Release --no-build -- --seed-students
exit $LASTEXITCODE
