package com.exthrifts.admin;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * The launcher: the admin in a Trusted Web Activity, with this phone's FCM token in the
 * URL fragment so the signed-in admin pairs it (see Pairing).
 *
 * A plain launch may hold the web view for three things, in order: an update offer, the
 * one-time notification screen, and (first launch only) up to a few seconds for Firebase
 * to issue a token. A deep link from an order alert skips the first two: nobody tapping
 * "New order" should meet a dialog instead of the order.
 */
public final class AppLauncherActivity extends LauncherActivity {
    private static final int REQUEST_NOTIFICATIONS = 1;
    private static final long TOKEN_WAIT_MS = 4000;
    private static final String PREFS = "launcher";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ReleaseInfo waiting;
    private boolean holdForPermission, holdForToken, launched;

    @Override protected void onCreate(Bundle state) {
        Intent intent = getIntent();
        boolean plainLaunch = state == null && intent != null
            && Intent.ACTION_MAIN.equals(intent.getAction()) && intent.getData() == null;
        waiting = plainLaunch && AppUpdates.shouldPrompt(this) ? AppUpdates.available(this) : null;
        holdForPermission = plainLaunch && waiting == null && shouldAskForNotifications(this);
        holdForToken = AdminApplication.pushConfigured() && DeviceToken.cached(this) == null;
        launched = waiting == null && !holdForPermission && !holdForToken;
        super.onCreate(state);
        if (isFinishing()) return;

        // Always refresh the cache; on a first launch this is also what releases the hold.
        DeviceToken.refresh(this, token -> release(() -> holdForToken = false));
        if (holdForToken) handler.postDelayed(() -> release(() -> holdForToken = false), TOKEN_WAIT_MS);
        UpdateCheckJob.runSoon(this);
        if (waiting != null) askToUpdate();
        else if (holdForPermission) askForNotifications();
    }

    @Override protected boolean shouldLaunchImmediately() { return launched; }

    @Override protected Uri getLaunchingUrl() {
        Uri requested = super.getLaunchingUrl();
        return Uri.parse(Pairing.launchUrl(requested == null ? null : requested.toString(),
            BuildConfig.SITE_URL, DeviceToken.cached(this), Build.MODEL));
    }

    /** Clears one hold, then opens the admin once nothing else is pending. */
    private void release(Runnable clear) {
        clear.run();
        if (launched || isFinishing() || waiting != null || holdForPermission || holdForToken) return;
        launched = true;
        handler.removeCallbacksAndMessages(null);
        launchTwa();
    }

    private void askToUpdate() {
        new AlertDialog.Builder(this)
            .setTitle(R.string.update_prompt_title)
            .setMessage(getString(R.string.update_prompt_message, waiting.versionName))
            .setPositiveButton(R.string.update_now, (dialog, which) -> {
                startActivity(UpdateActivity.intent(this, true));
                finish();
            })
            .setNegativeButton(R.string.update_later, (dialog, which) -> later())
            .setOnCancelListener(dialog -> later())
            .show();
    }

    private void later() {
        if (waiting == null) return;
        AppUpdates.snooze(this, waiting);
        release(() -> waiting = null);
    }

    /** Android 13+ only, not yet granted, and our explanation screen not shown before on this install. */
    static boolean shouldAskForNotifications(Context context) {
        return Build.VERSION.SDK_INT >= 33 && AdminApplication.pushConfigured()
            && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            && !context.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("notifications_asked", false);
    }

    private void askForNotifications() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("notifications_asked", true).apply();
        startActivityForResult(new Intent(this, NotificationPermissionActivity.class), REQUEST_NOTIFICATIONS);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        // Granted or not, the admin opens; alerts can be turned on later in system settings.
        if (requestCode == REQUEST_NOTIFICATIONS) release(() -> holdForPermission = false);
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
