# ExThrifts Admin — the order-alert Android app

A small sideloaded Android app for the owner. It does two things:

1. **Opens the admin** (`https://exthrifts.com/admin`) full screen as a Trusted Web Activity (TWA): the real website running in Chrome, with no address bar once the site and the app trust each other.
2. **Alerts on every new order.** The website sends a Firebase Cloud Messaging (FCM) data message for each order. The app shows a heads-up notification with sound, and tapping it opens that order's admin page.

There is no native login. The phone pairs itself with whoever is signed in to the admin inside the app (see [Pairing](#pairing-contract)).

Source: `android/` (Java, package `com.exthrifts.admin`). It is modelled on the Us Together Android shell, including the manifest fix that stopped its TWA crashing on launch.

---

## Owner setup, once

Do these in order. Steps 1–3 can be done before the website is live; step 6 needs the live site.

### 1. Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `exthrifts`). Analytics is not needed.
2. **Project settings → General → Your apps → Add app → Android**. Package name: `com.exthrifts.admin`. Leave the SHA-1 empty and skip the "add the SDK" steps; this app initialises Firebase itself.
3. Download `google-services.json`. Copy **four values** from it into `android/set-build-env.local.ps1` (step 3), then **delete the file**. It is not committed and no Gradle plugin reads it:

   | Build variable | Field in `google-services.json` |
   | --- | --- |
   | `ADMIN_APP_FIREBASE_APP_ID` | `client[0].client_info.mobilesdk_app_id` |
   | `ADMIN_APP_FIREBASE_SENDER_ID` | `project_info.project_number` |
   | `ADMIN_APP_FIREBASE_API_KEY` | `client[0].api_key[0].current_key` |
   | `ADMIN_APP_FIREBASE_PROJECT_ID` | `project_info.project_id` |

   These are public client identifiers that end up inside the APK. They are not secrets.
4. **Project settings → Service accounts → Generate new private key.** This JSON *is* a secret. Put its whole contents in the **website's** environment as `FIREBASE_SERVICE_ACCOUNT_JSON` (Hostinger hPanel → the Node.js app → environment variables), then restart the app. Never commit it, never put it in the Android build. The admin's Devices page has a **Send test** button that confirms it works.

### 2. Release signing key

The key signs every APK. Android only installs an update signed with the same key as the installed copy, and the site's `assetlinks.json` names this key's fingerprint. **Back the keystore and its password up somewhere safe.** If the key is lost, the phone must uninstall and reinstall, and `assetlinks.json` must change.

```powershell
keytool -genkeypair -v -keystore C:\keys\exthrifts-admin-release.jks -alias exthrifts-admin -keyalg RSA -keysize 4096 -validity 10000
```

(`keytool` is in any JDK's `bin` folder, including Android Studio's `jbr\bin`.) Use one password for both the store and the key; the env script assumes that.

Read the release fingerprint:

```powershell
keytool -list -v -keystore C:\keys\exthrifts-admin-release.jks -alias exthrifts-admin
```

Copy the `SHA256:` line, e.g. `AB:CD:…:EF`.

### 3. Local build settings

```powershell
cd android
Copy-Item set-build-env.example.ps1 set-build-env.local.ps1   # gitignored
notepad set-build-env.local.ps1                               # fill in the values
```

`ADMIN_APP_SITE_URL` defaults to `https://exthrifts.com`. A release build refuses any URL that is not https. Set `JAVA_HOME` to a **JDK 17**: Android Studio's bundled JDK 25 fails with Gradle 8.14 (`Unsupported class file major version 69`).

### 4. Digital Asset Links (full-screen TWA)

Edit `public/.well-known/assetlinks.json` and replace `REPLACE_WITH_RELEASE_SHA256` with the fingerprint from step 2, keeping the colons:

```json
"sha256_cert_fingerprints": ["AB:CD:...:EF"]
```

Deploy the website, then check that `https://exthrifts.com/.well-known/assetlinks.json` returns that JSON with status 200, with no redirect and no login. If the site's middleware or proxy guards paths, `/.well-known/` must be let through. Google's checker is at <https://developers.google.com/digital-asset-links/tools/generator>.

Until this matches, the app still works, but it opens the admin as a Custom Tab with a thin address bar instead of full screen. Debug builds always show that bar, because they are signed with the debug key. Adding the debug key's fingerprint as a second entry in the array removes it for testing.

### 5. GitHub secrets (automatic releases)

Needs the GitHub CLI signed in to the `DevilSinister/exthrifts` repository (`gh auth status`).

```powershell
cd android
.\publish-release-secrets.ps1
```

This sets `ADMIN_APP_KEYSTORE_BASE64`, `ADMIN_APP_KEYSTORE_PASSWORD`, `ADMIN_APP_KEY_ALIAS`, `ADMIN_APP_KEY_PASSWORD`, the four `ADMIN_APP_FIREBASE_*` values and, if set, `ADMIN_APP_SITE_URL`. Values go to `gh` on stdin; nothing is printed. From then on, every push to `main` that changes `android/**` (or a manual **Run workflow** on *Android release*) builds a signed APK and publishes the GitHub release `android-v<100 + run number>`. The release carries `exthrifts-admin.apk` and `update.json`. The repository is public, so the APK is public too. It contains only the site URL and the public Firebase client values.

### 6. First install on the phone

1. Get the APK: the latest release's `exthrifts-admin.apk` from <https://github.com/DevilSinister/exthrifts/releases/latest>. Or build one locally with `. .\set-build-env.local.ps1; .\gradlew.bat :app:assembleRelease` → `android\app\build\outputs\apk\release\app-release.apk`.
2. Open it on the phone. Android asks to **allow installs from this source** (Chrome, Files or whichever app opened it): allow it once, then **Install**. Play Protect may warn about an unknown developer: **More details → Install anyway**.
3. Open **ExThrifts Admin**. On Android 13+ it first asks to allow notifications: tap **Turn on order alerts → Allow**.
4. Sign in to the admin. The phone pairs itself, and a note confirms it ("This phone will now get an alert for every new order").
5. In the admin's **Devices** page, tap **Send test**. A heads-up alert should arrive, and tapping it should open the orders list.
6. Recommended on Samsung/Xiaomi/Oppo: **Settings → Apps → ExThrifts Admin → Battery → Unrestricted**, so alerts arrive while the phone sleeps.

### Self-update

The app checks `update.json` of the latest release on launch (at most every 30 minutes) and every six hours. When a newer `versionCode` exists, it posts an "Update ready" notification, and a plain launch asks **Update now / Later**. Tapping an order alert never shows that dialog. The update is downloaded, checked against the manifest's SHA-256, and handed to Android's installer.

- The **first** self-update asks once for **Install unknown apps** permission for ExThrifts Admin, then shows Android's own "Update this app?" sheet. On Android 12+, later updates install without a prompt.
- A phone running a **debug** build, or a build signed with another key, cannot take these updates. Uninstall it once and install the release APK.
- Debug builds never check for updates.

---

## Pairing contract

There is no native sign-in. The app hands its FCM token to the website, and the website ties it to the signed-in admin's cookie session.

- On every launch the app opens `<site>/admin` (or the deep-linked admin URL) with this URL **fragment** appended:

  ```
  #device=<FCM token, percent-encoded>&label=<Build.MODEL, percent-encoded>
  ```

  Spaces are `%20`, never `+`, so `decodeURIComponent` reverses it exactly. A fragment is never sent to the server, so the token stays out of server and proxy logs.
- The fragment is only added to URLs on the configured site origin (same scheme, host and port). A launch intent naming any other URL opens `<site>/admin` instead, and nothing is appended if the URL already has a fragment.
- The token is cached on the phone and refreshed by Firebase (`onNewToken`). A changed token reaches the website on the next launch, so re-opening the app always re-pairs. On the very first launch the app waits up to 4 s for Firebase to issue a token. If none arrives, that launch opens without pairing, and the next one pairs.
- **Website side** (`src/components/admin/DevicePairing.tsx`, `src/app/api/admin/devices/route.ts`): read `device` from `location.hash`, clear the hash with `history.replaceState`, keep it across the login redirect (the login form stashes it in `sessionStorage`), then:

  ```http
  POST /api/admin/devices
  Content-Type: application/json
  (admin session cookie)

  {"token": "<FCM token>", "label": "<Build.MODEL>"}
  ```

  The route upserts by token, so the same phone used by a different admin moves to that admin. The app also sends `label` in the fragment. As of this writing the website derives its own label from the user agent instead; reading `label` from the fragment would show the phone's model on the Devices page.

## Push payload contract

The website (`src/lib/push/fcm.ts`, `rules.ts`) sends **data-only** FCM HTTP v1 messages with `android.priority: "HIGH"`. A message with a `notification` block would be shown by Android itself, without this app's tag, channel or tap target, so it must not have one.

New order:

| Key | Required | Meaning / validation in the app |
| --- | --- | --- |
| `type` | yes | `"order"`. Any other value except `"test"` is ignored. |
| `orderId` | yes | `[A-Za-z0-9_-]{1,64}`, or the message is dropped. The notification tag is `order-<orderId>` with id 0, so a retried send replaces the alert instead of stacking a second one. |
| `number` | no | Display number, e.g. `EX-1042`. Used in the fallback title `New order EX-1042`. |
| `title` | no | Clipped to 120 characters. Falls back as above. |
| `body` | no | Clipped to 240 characters. Falls back to "Tap to open the order." |
| `targetPath` | no | Must be an absolute `/admin/…` path on the same origin: no scheme, no host, no `//`, no `..`, no `%`, `#`, `\`, `:` or whitespace, at most 200 characters. Anything else becomes `/admin/orders`. |

Test alert (admin → Devices → Send test): `type: "test"`, `title`, `body`, `targetPath`, and an optional `tag` (`[A-Za-z0-9_-]{1,80}`, else `test`).

Tap behaviour: an `ACTION_VIEW` intent for `<site><targetPath>`, restricted with `setPackage` to this app, `FLAG_IMMUTABLE | FLAG_UPDATE_CURRENT`, request code `tag.hashCode()`. It opens the app's launcher directly into that page, and deep-link launches never show the update or notification prompts.

Channel: `new_orders` ("New orders"), importance HIGH, default sound. The owner can change its sound or turn it off under Android's app notification settings; the app does not override that choice.

---

## Build and verify locally

```powershell
cd android
$env:JAVA_HOME = "<JDK 17>"
.\gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
```

The debug APK is at `app\build\outputs\apk\debug\app-debug.apk`. Without the Firebase variables it builds as the admin shell with no alerts. To point a debug build at a dev server, set `ADMIN_APP_SITE_URL` (e.g. `http://10.0.2.2:3000` for the emulator). The TWA then falls back to a Custom Tab, and release builds refuse it.

After any manifest change, install on a real phone and run `adb logcat -b crash` after one launch. Us Together's TWA built, linted and passed its tests while crashing on every launch, because `ManageDataLauncherActivity` was not declared. This app declares it, with `android:manageSpaceActivity` and `MANAGE_SPACE_URL`.

## What is verified, and what is not

Verified on the build machine (2026-10-17, JDK 17, Firebase variables unset):

- `gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest`: `BUILD SUCCESSFUL`, exit 0.
- JUnit: 23 tests, 0 failures, 0 skipped. `OrderAlertTest` 10 (payload parsing, tags, clipping, `targetPath` validation), `PairingTest` 7 (fragment format, origin check, encoding), `ReleaseInfoTest` 6 (update manifest validation).
- Lint: 0 errors, 3 warnings. `TargetApi` should be `RequiresApi`; `allowBackup` has no `dataExtractionRules` (backup is off anyway); `mipmap-anydpi-v26` is redundant at minSdk 26. Moving the icon to the unversioned folder made AAPT report `mipmap/ic_launcher not found`, so it stays in `-v26`.
- Release guard: `ADMIN_APP_SITE_URL=http://example.com gradlew :app:assembleRelease --dry-run` fails with "ADMIN_APP_SITE_URL must be an https origin for a release build."

**Not verified, and owed by the owner on a real phone:**

- The app launches without crashing (`adb logcat -b crash`), and opens full screen once `assetlinks.json` carries the release fingerprint.
- The Android 13+ notification screen and system prompt.
- Pairing end to end: the fragment is read, the login keeps it, and the Devices page shows the phone.
- A real order produces a heads-up alert with sound, while the app is closed and while the phone is asleep. Tapping it opens that order.
- A retried send replaces the alert rather than duplicating it.
- Self-update: the GitHub release is published by CI, the first update asks for Install-unknown-apps plus the system sheet, and later ones are silent on Android 12+.
- A signed release build. The release workflow has not run yet; it needs the secrets from step 5.
