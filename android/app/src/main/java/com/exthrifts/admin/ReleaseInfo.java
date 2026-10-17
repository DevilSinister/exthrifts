package com.exthrifts.admin;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * One published release as the update manifest describes it. Everything is validated
 * before it can reach the downloader: the APK must come over https from the manifest's
 * own host, and its SHA-256 is checked after download. Android then refuses any APK
 * not signed with this app's key, so a forged manifest can waste a download but can
 * never install anything.
 */
final class ReleaseInfo {
    static final long MAX_APK_BYTES = 100L * 1024 * 1024;
    private static final Pattern SHA256 = Pattern.compile("[0-9a-f]{64}");

    final int versionCode;
    final String versionName;
    final String apkUrl;
    final String sha256;

    private ReleaseInfo(int versionCode, String versionName, String apkUrl, String sha256) {
        this.versionCode = versionCode;
        this.versionName = versionName;
        this.apkUrl = apkUrl;
        this.sha256 = sha256;
    }

    /** Returns null unless every field is usable. */
    static ReleaseInfo of(int versionCode, String versionName, String apkUrl, String sha256, String manifestUrl) {
        if (versionCode <= 0 || versionName == null) return null;
        String name = versionName.trim();
        if (name.isEmpty() || name.length() > 40) return null;
        String digest = sha256 == null ? "" : sha256.trim().toLowerCase(Locale.ROOT);
        if (!SHA256.matcher(digest).matches()) return null;
        String host = httpsHost(apkUrl);
        if (host == null || !host.equals(httpsHost(manifestUrl))) return null;
        return new ReleaseInfo(versionCode, name, apkUrl, digest);
    }

    boolean isNewerThan(int installedVersionCode) { return versionCode > installedVersionCode; }

    /** The lower-cased host of an https URL with no credentials in it, or null. */
    static String httpsHost(String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) return null;
            return uri.getHost().toLowerCase(Locale.ROOT);
        } catch (Exception invalid) {
            return null;
        }
    }
}
