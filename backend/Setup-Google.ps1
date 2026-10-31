param([string]$CredentialsFile, [switch]$Check)
$ErrorActionPreference = 'Stop'
$privateDirectory = Join-Path $PSScriptRoot '.secrets'
$privateFile = Join-Path $privateDirectory 'google.json'
$redirects = @('http://127.0.0.1:8082/api/auth/google/callback', 'http://localhost:8082/api/auth/google/callback')
if ($Check) {
    $configured = $false
    if (Test-Path -LiteralPath $privateFile) {
        try {
            $current = [IO.File]::ReadAllText($privateFile) | ConvertFrom-Json
            $configured = -not [string]::IsNullOrWhiteSpace($current.Authentication.Google.ClientId) -and -not [string]::IsNullOrWhiteSpace($current.Authentication.Google.ClientSecret)
        } catch { throw 'Local Google configuration could not be read. Re-run setup with valid credentials.' }
    }
    Write-Host ('Local Google settings present: ' + $configured)
    Write-Host 'Authorized redirect URIs for the frontend proxy:'
    $redirects | ForEach-Object { Write-Host $_ }
    Write-Host 'Restart the backend after setup; /api/auth/config confirms runtime availability. No credentials are printed.'
    exit 0
}
if ($CredentialsFile) {
    try { $downloaded = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $CredentialsFile).Path) | ConvertFrom-Json }
    catch { throw 'Choose a valid downloaded Google OAuth web-client JSON file. Its contents were not printed.' }
    if (-not $downloaded.web) { throw 'Create a Web application OAuth client; a desktop or installed client is not supported.' }
    $clientId = [string]$downloaded.web.client_id
    $clientSecret = [string]$downloaded.web.client_secret
    if (-not ($redirects | Where-Object { $downloaded.web.redirect_uris -contains $_ })) { throw 'Add a frontend callback URI listed by -Check to this OAuth client, then download its updated JSON.' }
} else {
    $clientId = Read-Host 'Google Web application Client ID'
    $secureSecret = Read-Host 'Google Client secret (hidden)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    try { $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureSecret.Dispose() }
}
$clientId = $clientId.Trim()
if ($clientId -notmatch '^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$') { throw 'Use the Client ID of a Google Web application OAuth client.' }
if ([string]::IsNullOrWhiteSpace($clientSecret) -or $clientSecret.Length -lt 10 -or $clientSecret.Length -gt 4096 -or $clientSecret -match '\s') { throw 'Enter the Google OAuth client secret exactly as provided, without whitespace.' }
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
$settings = @{ Authentication = @{ Google = @{ ClientId = $clientId; ClientSecret = $clientSecret } } }
[IO.File]::WriteAllText($privateFile, ($settings | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
$clientSecret = $null; $settings = $null; $downloaded = $null
Write-Host 'Google credentials saved in ignored backend/.secrets/google.json. No keys or tokens were printed.'
Write-Host 'Restart the backend and open http://127.0.0.1:8082/login. Live Google sign-in has not been tested by this setup script.'
