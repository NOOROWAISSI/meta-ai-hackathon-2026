param([string]$Email)
$ErrorActionPreference = 'Stop'
if (-not $Email) { $Email = Read-Host 'Project Gmail address' }
$Email = $Email.Trim()
try { $parsed = New-Object System.Net.Mail.MailAddress($Email) }
catch { throw 'Enter a valid project email address.' }
if ($parsed.Address -ne $Email) { throw 'Enter a valid project email address.' }
Write-Host 'Use a Google App Password from the project account, not its normal password.'
$securePassword = Read-Host 'Google App Password (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -replace '\s', '' }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $securePassword.Dispose() }
if ($appPassword.Length -ne 16) { throw 'A Google App Password must contain 16 characters, excluding spaces.' }
$privateDirectory = Join-Path $PSScriptRoot '.secrets'
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
$privateFile = Join-Path $privateDirectory 'email.json'
$pepper = $null
if (Test-Path -LiteralPath $privateFile) {
    $previous = [IO.File]::ReadAllText($privateFile) | ConvertFrom-Json
    $pepper = $previous.Authentication.RecoveryPepper
}
if (-not $pepper) {
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes); $pepper = [Convert]::ToBase64String($randomBytes) }
    finally { $generator.Dispose() }
}
$settings = @{ Email = @{ Host = 'smtp.gmail.com'; Port = 587; Username = $Email; From = $Email; Password = $appPassword }; Authentication = @{ RecoveryPepper = $pepper } }
[IO.File]::WriteAllText($privateFile, ($settings | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
$appPassword = $null
$settings = $null
Write-Host 'Gmail settings saved in the ignored local secrets directory. No email has been sent.'
Write-Host 'Restart the backend, then request a code from Forgot password for an existing password account.'
