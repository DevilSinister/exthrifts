package com.exthrifts.admin;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Self-update for the sideloaded APK. CI publishes a signed APK and an update.json to
 * a GitHub release on every push that changes this app; the manifest URL is baked in
 * at build time and always points at the latest release.
 *
 * Android never lets a sideloaded app replace itself silently the first time: that
 * install shows the system's own "Update this app?" sheet. After it, this app is the
 * installer of record, and on Android 12+ later updates go through without a prompt.
 */
final class AppUpdates {
    static final String CHANNEL = "app_updates";
    private static final String PREFS = "app_updates";
    private static final String NOTIFICATION_TAG = "app-update";
    private static final long CHECK_GAP_MS = 30 * 60_000L;
    private static final long SNOOZE_MS = 12 * 60 * 60_000L;
    private static final int MAX_MANIFEST_BYTES = 16 * 1024;

    private AppUpdates() {}

    interface Progress { void onProgress(long done, long total); }

    /** Debug builds carry the debug key, so no release APK could ever install over them. */
    static boolean configured() {
        return !BuildConfig.DEBUG && ReleaseInfo.httpsHost(BuildConfig.UPDATE_MANIFEST_URL) != null;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean checkDue(Context context) {
        return configured() && System.currentTimeMillis() - prefs(context).getLong("checked_at", 0) > CHECK_GAP_MS;
    }

    /** Reads the latest manifest; remembers and returns a newer release, or null when current. */
    static ReleaseInfo check(Context context) throws IOException, JSONException {
        if (!configured()) return null;
        HttpURLConnection connection = open(BuildConfig.UPDATE_MANIFEST_URL);
        String body;
        try {
            if (connection.getResponseCode() != 200) throw new IOException("Update check returned " + connection.getResponseCode());
            body = read(connection.getInputStream());
        } finally {
            connection.disconnect();
        }
        ReleaseInfo release = parse(body);
        SharedPreferences.Editor edit = prefs(context).edit().putLong("checked_at", System.currentTimeMillis());
        if (release == null || !release.isNewerThan(BuildConfig.VERSION_CODE)) {
            edit.remove("available").apply();
            return null;
        }
        edit.putString("available", body).apply();
        return release;
    }

    /** The newer release the last check found, if it is still newer than what is installed. */
    static ReleaseInfo available(Context context) {
        if (!configured()) return null;
        String stored = prefs(context).getString("available", null);
        if (stored == null) return null;
        try {
            ReleaseInfo release = parse(stored);
            return release != null && release.isNewerThan(BuildConfig.VERSION_CODE) ? release : null;
        } catch (JSONException corrupt) {
            return null;
        }
    }

    private static ReleaseInfo parse(String body) throws JSONException {
        JSONObject json = new JSONObject(body);
        return ReleaseInfo.of(json.optInt("versionCode"), json.optString("versionName", null),
            json.optString("apkUrl", null), json.optString("sha256", null), BuildConfig.UPDATE_MANIFEST_URL);
    }

    /** Whether the launcher should ask before opening: an update exists and "Later" has lapsed. */
    static boolean shouldPrompt(Context context) {
        ReleaseInfo release = available(context);
        if (release == null) return false;
        SharedPreferences stored = prefs(context);
        return stored.getInt("snoozed_code", 0) != release.versionCode
            || System.currentTimeMillis() >= stored.getLong("snoozed_until", 0);
    }

    static void snooze(Context context, ReleaseInfo release) {
        prefs(context).edit().putInt("snoozed_code", release.versionCode)
            .putLong("snoozed_until", System.currentTimeMillis() + SNOOZE_MS).apply();
    }

    /** One notification per release, so a six-hourly check does not nag. */
    static void notifyAvailable(Context context, ReleaseInfo release) {
        SharedPreferences stored = prefs(context);
        if (stored.getInt("notified_code", 0) == release.versionCode) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        PendingIntent open = PendingIntent.getActivity(context, 7101, UpdateActivity.intent(context, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(NOTIFICATION_TAG, 0, new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(context.getColor(R.color.ink))
            .setContentTitle(context.getString(R.string.update_notification_title))
            .setContentText(context.getString(R.string.update_notification_body, release.versionName))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build());
        stored.edit().putInt("notified_code", release.versionCode).apply();
    }

    /** After the new APK replaced this one: drop the stale offer and the downloaded file. */
    static void onUpdated(Context context) {
        prefs(context).edit().remove("available").remove("snoozed_code").remove("snoozed_until").apply();
        deleteDownloads(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.cancel(NOTIFICATION_TAG, 0);
        if (!manager.areNotificationsEnabled()) return;
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) return;
        PendingIntent open = PendingIntent.getActivity(context, 7102, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(NOTIFICATION_TAG, 0, new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(context.getColor(R.color.ink))
            .setContentTitle(context.getString(R.string.update_done_title))
            .setContentText(context.getString(R.string.update_done_body, BuildConfig.VERSION_NAME))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build());
    }

    /** Downloads the APK and refuses it unless its SHA-256 matches the manifest. */
    static File download(Context context, ReleaseInfo release, Progress progress) throws IOException {
        deleteDownloads(context);
        File directory = new File(context.getCacheDir(), "updates");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException(context.getString(R.string.update_no_space));
        File target = new File(directory, "exthrifts-admin-" + release.versionCode + ".apk");
        MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException impossible) { throw new IOException(impossible); }
        HttpURLConnection connection = open(release.apkUrl);
        connection.setReadTimeout(60_000);
        try {
            if (connection.getResponseCode() != 200) throw new IOException(context.getString(R.string.update_download_failed));
            long total = connection.getContentLengthLong();
            if (total > ReleaseInfo.MAX_APK_BYTES) throw new IOException(context.getString(R.string.update_download_failed));
            try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(target)) {
                byte[] buffer = new byte[64 * 1024];
                long done = 0;
                for (int read; (read = in.read(buffer)) != -1; ) {
                    done += read;
                    if (done > ReleaseInfo.MAX_APK_BYTES) throw new IOException(context.getString(R.string.update_download_failed));
                    digest.update(buffer, 0, read);
                    out.write(buffer, 0, read);
                    progress.onProgress(done, total);
                }
            }
        } catch (IOException failure) {
            target.delete();
            throw failure;
        } finally {
            connection.disconnect();
        }
        if (!hex(digest.digest()).equals(release.sha256)) {
            target.delete();
            throw new IOException(context.getString(R.string.update_checksum_failed));
        }
        return target;
    }

    /** Hands the APK to PackageInstaller; UpdateInstallReceiver hears the outcome. */
    static void install(Context context, File apk) throws IOException {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                byte[] buffer = new byte[64 * 1024];
                for (int read; (read = in.read(buffer)) != -1; ) out.write(buffer, 0, read);
                session.fsync(out);
            }
            // Mutable because the installer fills in the status extras; explicit, so nothing else can receive it.
            Intent status = new Intent(context, UpdateInstallReceiver.class).setAction(UpdateInstallReceiver.ACTION_STATUS);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(context, sessionId, status, flags).getIntentSender());
        } catch (IOException | RuntimeException failure) {
            installer.abandonSession(sessionId);
            throw failure;
        }
    }

    private static void deleteDownloads(Context context) {
        File[] files = new File(context.getCacheDir(), "updates").listFiles();
        if (files != null) for (File file : files) file.delete();
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        connection.setUseCaches(false);
        // GitHub answers release downloads with a redirect to its asset host, https to https.
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private static String read(InputStream stream) throws IOException {
        try (InputStream in = stream) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            for (int read; (read = in.read(buffer)) != -1; ) {
                out.write(buffer, 0, read);
                if (out.size() > MAX_MANIFEST_BYTES) throw new IOException("The update manifest is too large.");
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) out.append(String.format("%02x", value));
        return out.toString();
    }
}
