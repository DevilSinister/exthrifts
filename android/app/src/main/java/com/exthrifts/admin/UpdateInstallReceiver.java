package com.exthrifts.admin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import java.lang.ref.WeakReference;

/**
 * Hears two things: PackageInstaller reporting on an update session, and the system
 * saying this package was just replaced. Not exported; the status intent is explicit
 * and MY_PACKAGE_REPLACED comes from the system.
 */
public final class UpdateInstallReceiver extends BroadcastReceiver {
    static final String ACTION_STATUS = "com.exthrifts.admin.action.UPDATE_STATUS";

    interface Listener { void onInstallStatus(int status, String message); }

    private static WeakReference<Listener> listener = new WeakReference<>(null);

    static void listen(Listener next) { listener = new WeakReference<>(next); }

    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AppUpdates.onUpdated(context);
            return;
        }
        if (!ACTION_STATUS.equals(action)) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // The first self-update, or any update before Android 12: the system's own sheet.
            Intent confirm = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : legacyIntent(intent);
            if (confirm != null) {
                try { context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                catch (RuntimeException blocked) { status = PackageInstaller.STATUS_FAILURE_BLOCKED; }
            }
        }
        Listener current = listener.get();
        if (current != null) current.onInstallStatus(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
    }

    @SuppressWarnings("deprecation")
    private static Intent legacyIntent(Intent intent) { return intent.getParcelableExtra(Intent.EXTRA_INTENT); }
}
