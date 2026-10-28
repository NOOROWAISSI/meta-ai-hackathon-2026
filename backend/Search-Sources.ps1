param([Parameter(Mandatory=$true)][string]$SourceId)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Start-Api.ps1') -MigrateOnly
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
dotnet run --project (Join-Path $PSScriptRoot 'NextStep.Api/NextStep.Api.csproj') --no-build -- --search-sources --source $SourceId
exit $LASTEXITCODE
