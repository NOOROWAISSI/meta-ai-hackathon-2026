$ErrorActionPreference = 'Stop'
$privateDirectory = Join-Path $PSScriptRoot '.secrets'
$privateEnv = Join-Path $privateDirectory 'mysql.env'
if (-not (Test-Path -LiteralPath $privateEnv)) {
    New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
    [IO.File]::WriteAllLines($privateEnv, @(('MYSQL_PASSWORD=' + [Guid]::NewGuid().ToString('N')), ('MYSQL_ROOT_PASSWORD=' + [Guid]::NewGuid().ToString('N'))))
}
docker compose --env-file $privateEnv -f (Join-Path $PSScriptRoot 'compose.yaml') -p nextstep-backend up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and retry. Existing database data has not been reset.' }
& (Join-Path $PSScriptRoot 'Start-Api.ps1') -MigrateOnly
