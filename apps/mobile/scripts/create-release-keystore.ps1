# One-time: create the Android upload keystore. Do NOT commit the .jks.
# Then add the printed values as GitHub Actions secrets (docs/PUBLISH.md).
param(
  [string]$Out = (Join-Path $env:USERPROFILE "cubecontrol-release.jks"),
  [string]$Alias = "cubecontrol"
)

$ErrorActionPreference = "Stop"

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
  throw "keytool not found. Install a JDK 17+ and reopen the terminal."
}

if (Test-Path $Out) {
  throw "Already exists: $Out. Move that file aside only if you really want a new key (users could not update the old APK)."
}

$storePass = Read-Host "Keystore password" -AsSecureString
$keyPass = Read-Host "Key password (same as keystore is fine)" -AsSecureString

function Convert-SecureToPlain([Security.SecureString]$value) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$storePassText = Convert-SecureToPlain $storePass
$keyPassText = Convert-SecureToPlain $keyPass

& keytool -genkeypair -v -keystore $Out -alias $Alias -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=CubeControl, OU=CubeControl, O=CubeControl, L=Unknown, ST=Unknown, C=US" `
  -storepass $storePassText -keypass $keyPassText

if ($LASTEXITCODE -ne 0) {
  throw "keytool failed with exit code $LASTEXITCODE"
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Out))
Write-Host ""
Write-Host "File: $Out"
Write-Host "Keep a backup offline. Losing this file means testers must uninstall to install a new APK."
Write-Host ""
Write-Host "GitHub secrets:"
Write-Host "  ANDROID_KEY_ALIAS             = $Alias"
Write-Host "  ANDROID_KEYSTORE_PASSWORD     = (the keystore password you typed)"
Write-Host "  ANDROID_KEY_PASSWORD          = (the key password you typed)"
Write-Host "  ANDROID_KEYSTORE_BASE64       = (paste the next line, one line, no wraps)"
Write-Host $b64
