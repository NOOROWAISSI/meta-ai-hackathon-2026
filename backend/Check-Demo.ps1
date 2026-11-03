param(
    [string]$ApiBase = 'http://127.0.0.1:5080',
    [string]$FrontendBase = 'http://127.0.0.1:8082',
    [string]$OpportunityId = 'meta-global-ai-2026',
    [ValidateSet('Local', 'Submission')][string]$Mode = 'Submission',
    [string]$ReportPath
)
$ErrorActionPreference = 'Stop'
$checks = New-Object 'System.Collections.Generic.List[object]'
function Add-Check([string]$Name, [string]$Status, [string]$Detail) {
    $checks.Add([pscustomobject]@{ name = $Name; status = $Status; detail = $Detail })
}
function Read-Public([string]$Path) {
    Invoke-RestMethod -Method Get -Uri ($ApiBase.TrimEnd('/') + $Path) -TimeoutSec 15
}
try {
    $health = Read-Public '/api/health'
    if ($health.status -ne 'ok' -or $health.storage -ne 'mysql') { throw 'Unavailable' }
    Add-Check 'api_mysql' 'passed' 'API reports reachable MySQL. This does not certify schema compatibility between branches.'
    Add-Check 'meta_configuration' $(if ($health.modelConfigured) { 'info' } else { 'warning' }) $(if ($health.modelConfigured) { 'Provider configuration exists; no provider request was made and key validity is not established.' } else { 'Provider configuration is missing; plan generation cannot be demonstrated live.' })
} catch { Add-Check 'api_mysql' 'failed' 'API/MySQL health could not be confirmed.' }
try {
    $page = Invoke-WebRequest -UseBasicParsing -Method Get -Uri ($FrontendBase.TrimEnd('/') + '/opportunities') -TimeoutSec 15
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'NextStep') { throw 'Unavailable' }
    Add-Check 'frontend' 'passed' 'Discover returns NextStep HTML. Browser interaction must still be verified.'
} catch { Add-Check 'frontend' 'failed' 'Frontend Discover could not be loaded.' }
try {
    $proxied = Invoke-RestMethod -Method Get -Uri ($FrontendBase.TrimEnd('/') + '/api/health') -TimeoutSec 15
    if ($proxied.status -ne 'ok') { throw 'Unavailable' }
    Add-Check 'frontend_api_connection' 'passed' 'The frontend origin reaches the application API.'
} catch { Add-Check 'frontend_api_connection' 'failed' 'The frontend API proxy could not be confirmed.' }
try {
    $auth = Read-Public '/api/auth/config'
    if (-not $auth.passwordEnabled) { throw 'Unavailable' }
    Add-Check 'accounts' 'passed' 'Email/password authentication is enabled.'
    Add-Check 'google_configuration' $(if ($auth.googleEnabled) { 'info' } else { 'warning' }) 'Configuration only; Google sign-in and recovery-email delivery are not exercised by this script.'
} catch { Add-Check 'accounts' 'failed' 'Account configuration could not be loaded.' }
try {
    $listingResponse = Read-Public '/api/listings'
    $listings = @($listingResponse)
    if ($listings.Count -eq 0 -or @($listings | Where-Object { -not $_.id -or -not $_.title -or -not $_.kind }).Count -gt 0) { throw 'Invalid catalog' }
    $current = @($listings | Where-Object { $_.discoveryState -eq 'current' -and $_.registrationState -ne 'closed' -and $_.availabilityState -ne 'ended' })
    Add-Check 'public_opportunities' 'passed' ($listings.Count.ToString() + ' source listings available; ' + $current.Count + ' tagged current/upcoming. Availability and eligibility remain separate.')
} catch { Add-Check 'public_opportunities' 'failed' 'The public opportunity catalog could not be loaded.' }
try {
    $postResponse = Read-Public '/api/sources/posts'
    $posts = @($postResponse)
    if (@($posts | Where-Object { -not $_.id -or -not $_.title }).Count -gt 0) { throw 'Invalid posts' }
    Add-Check 'campus_posts' 'passed' ($posts.Count.ToString() + ' collected community posts; this is not a count of open registrations.')
} catch { Add-Check 'campus_posts' 'failed' 'Campus posts could not be loaded.' }
try {
    $access = Read-Public ('/api/opportunities/' + [Uri]::EscapeDataString($OpportunityId) + '/preparation-access')
    if ($access.state -ne 'workspace_available') { throw 'Review required' }
    Add-Check 'preparation_entry' 'passed' 'The selected event has a planning workspace. No plan, analysis, or eligibility decision was created.'
} catch { Add-Check 'preparation_entry' 'failed' 'The selected event is unavailable or requires source review before planning.' }
$gatesPath = Join-Path $PSScriptRoot '../docs/DEMO-RELEASE-GATES.json'
$gates = if (Test-Path -LiteralPath $gatesPath) { (Get-Content -Raw -LiteralPath $gatesPath | ConvertFrom-Json).gates } else { @([pscustomobject]@{ id = 'release_manifest'; status = 'unverified'; evidence = 'Release manifest missing.' }) }
$runtimeReady = @($checks | Where-Object { $_.status -eq 'failed' }).Count -eq 0
$pendingGates = @($gates | Where-Object { $_.status -ne 'passed' })
$submissionReady = $runtimeReady -and $pendingGates.Count -eq 0
$report = [pscustomobject]@{
    checkedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    mode = $Mode
    runtimeReady = $runtimeReady
    submissionReady = $submissionReady
    scope = 'Public GET requests only. No sign-in, email, Meta calls, student data or storage mutations.'
    checks = $checks.ToArray()
    releaseGates = $gates
}
$json = $report | ConvertTo-Json -Depth 8
if ($ReportPath) { [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath), $json) }
$json
if (-not $runtimeReady) { exit 1 }
if ($Mode -eq 'Submission' -and -not $submissionReady) { exit 2 }
exit 0
