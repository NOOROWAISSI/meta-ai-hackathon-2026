param([string]$Source)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Start-Api.ps1') -MigrateOnly
$arguments = @('run', '--project', (Join-Path $PSScriptRoot 'NextStep.Api/NextStep.Api.csproj'), '--no-build', '--', '--collect-sources')
if ($Source) { $arguments += @('--source', $Source) }
& dotnet @arguments
exit $LASTEXITCODE
