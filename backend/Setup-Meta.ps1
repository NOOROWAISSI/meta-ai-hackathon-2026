param([switch]$Check)
$ErrorActionPreference = 'Stop'
$privateDirectory = Join-Path $PSScriptRoot '.secrets'
$privateFile = Join-Path $privateDirectory 'meta.json'
if ($Check) {
    $configured = $false
    if (Test-Path -LiteralPath $privateFile) {
        try { $settings = [IO.File]::ReadAllText($privateFile) | ConvertFrom-Json; $configured = -not [string]::IsNullOrWhiteSpace($settings.MetaAi.ApiKey) }
        catch { throw 'The local Meta configuration is unreadable. Re-run setup. Its contents were not printed.' }
    }
    Write-Host ('Local Meta key present: ' + $configured)
    Write-Host 'Presence is not provider verification. Restart the backend after setup; /api/health reports modelConfigured.'
    exit 0
}
Write-Host 'Use the project Meta Model API key. A Google OAuth secret or Gmail App Password is not a model key.'
$secureKey = Read-Host 'Meta Model API key (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureKey.Dispose() }
$apiKey = $apiKey.Trim()
if ($apiKey.Length -lt 16 -or $apiKey.Length -gt 16384 -or $apiKey -match '\s') { throw 'Enter a complete Meta Model API key without whitespace. No value was saved or printed.' }
$settings = @{ MetaAi = @{ ApiKey = $apiKey } }
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
[IO.File]::WriteAllText($privateFile, ($settings | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
$apiKey = $null; $settings = $null
Write-Host 'Meta settings saved in ignored backend/.secrets/meta.json. No key was printed and no provider request was made.'
Write-Host 'Restart the backend, then test Generate preparation draft using your confirmed profile facts.'
