# Copy to set-build-env.local.ps1 (gitignored), fill the values, then in this folder:
#   . .\set-build-env.local.ps1
#   .\gradlew.bat :app:assembleRelease
# Works in Windows PowerShell 5.1. See docs/ANDROID.md for where each value comes from.

# The live store. The app opens <site>/admin; a release build refuses anything but https.
$env:ADMIN_APP_SITE_URL = "https://exthrifts.com"

# From google-services.json of the Android app (package com.exthrifts.admin) in the Firebase console.
# Read the four values, then delete the file; it is never committed and no plugin reads it.
# These are public client identifiers, not secrets. Leave all four empty for a build without alerts.
$env:ADMIN_APP_FIREBASE_APP_ID = "<client[0].client_info.mobilesdk_app_id>"
$env:ADMIN_APP_FIREBASE_SENDER_ID = "<project_info.project_number>"
$env:ADMIN_APP_FIREBASE_API_KEY = "<client[0].api_key[0].current_key>"
$env:ADMIN_APP_FIREBASE_PROJECT_ID = "<project_info.project_id>"

# Release signing. Keep the keystore outside the repository and back it up: every future
# update must be signed with this same key or it will not install over the phone's copy.
$env:ADMIN_APP_KEYSTORE_PATH = "C:\keys\exthrifts-admin-release.jks"
$env:ADMIN_APP_KEY_ALIAS = "exthrifts-admin"
$secure = Read-Host -AsSecureString "Keystore password"
# Windows PowerShell 5.1 has no ConvertFrom-SecureString -AsPlainText; unwrap via BSTR instead.
$env:ADMIN_APP_KEYSTORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:ADMIN_APP_KEY_PASSWORD = $env:ADMIN_APP_KEYSTORE_PASSWORD

# Gradle 8.14 needs JDK 17. Android Studio's bundled JBR (JDK 25) fails with
# "Unsupported class file major version 69".
$env:JAVA_HOME = "<path to a JDK 17>"
