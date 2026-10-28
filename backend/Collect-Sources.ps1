$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Start-Api.ps1') -MigrateOnly
dotnet run --project (Join-Path $PSScriptRoot 'NextStep.Api/NextStep.Api.csproj') --no-build -- --collect-sources
exit $LASTEXITCODE
