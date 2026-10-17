# Copies the Android release settings from set-build-env.local.ps1 into this repository's
# GitHub Actions secrets, so .github/workflows/android-release.yml can sign updates with
# the same key as the APK already on the phone. Run once, and again after changing a value:
#
#   cd android
#   .\publish-release-secrets.ps1
#
# Needs the GitHub CLI signed in (gh auth status). Values go to gh on stdin, never on a
# command line, and nothing secret is printed. Works in Windows PowerShell 5.1.

$ErrorActionPreference = "Stop"
# Windows PowerShell 5.1 pipes ASCII to native programs unless told otherwise.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
Set-Location $PSScriptRoot
if (-not (Test-Path .\set-build-env.local.ps1)) { throw "Create set-build-env.local.ps1 from set-build-env.example.ps1 first." }
. .\set-build-env.local.ps1

if (-not $env:ADMIN_APP_KEYSTORE_PATH -or -not (Test-Path $env:ADMIN_APP_KEYSTORE_PATH)) {
    throw "ADMIN_APP_KEYSTORE_PATH must name the release keystore the installed APK was signed with."
}

# Order alerts are the point of this app, so a release without Firebase is refused.
$required = "ADMIN_APP_KEYSTORE_PASSWORD", "ADMIN_APP_KEY_ALIAS", "ADMIN_APP_KEY_PASSWORD",
    "ADMIN_APP_FIREBASE_APP_ID", "ADMIN_APP_FIREBASE_SENDER_ID", "ADMIN_APP_FIREBASE_API_KEY", "ADMIN_APP_FIREBASE_PROJECT_ID"
$optional = @("ADMIN_APP_SITE_URL")

foreach ($name in $required + $optional) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not $value -or $value.Contains("<")) {
        if ($required -contains $name) { throw "$name is empty or still a placeholder in set-build-env.local.ps1." }
        Write-Host "Skipping $name (not set; the build default applies)."
        continue
    }
    $value | gh secret set $name
    if ($LASTEXITCODE -ne 0) { throw "gh secret set $name failed." }
    Write-Host "Set $name"
}

[Convert]::ToBase64String([IO.File]::ReadAllBytes($env:ADMIN_APP_KEYSTORE_PATH)) | gh secret set ADMIN_APP_KEYSTORE_BASE64
if ($LASTEXITCODE -ne 0) { throw "gh secret set ADMIN_APP_KEYSTORE_BASE64 failed." }
Write-Host "Set ADMIN_APP_KEYSTORE_BASE64"
Write-Host "Done. The next push to main that changes android/ publishes a release."
