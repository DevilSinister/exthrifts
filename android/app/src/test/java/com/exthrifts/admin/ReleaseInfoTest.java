package com.exthrifts.admin;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class ReleaseInfoTest {
    private static final String MANIFEST = "https://github.com/DevilSinister/exthrifts/releases/latest/download/update.json";
    private static final String APK = "https://github.com/DevilSinister/exthrifts/releases/download/android-v120/exthrifts-admin.apk";
    private static final String DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test public void acceptsAReleaseFromTheManifestHost() {
        ReleaseInfo release = ReleaseInfo.of(120, " 0.1.20 ", APK, DIGEST.toUpperCase(), MANIFEST);
        assertNotNull(release);
        assertEquals(120, release.versionCode);
        assertEquals("0.1.20", release.versionName);
        assertEquals(DIGEST, release.sha256);
    }

    @Test public void comparesAgainstTheInstalledVersionCode() {
        ReleaseInfo release = ReleaseInfo.of(120, "0.1.20", APK, DIGEST, MANIFEST);
        assertTrue(release.isNewerThan(119));
        assertFalse(release.isNewerThan(120));
        assertFalse(release.isNewerThan(121));
    }

    @Test public void rejectsAnApkFromAnotherHost() {
        assertNull(ReleaseInfo.of(120, "0.1.20", "https://example.com/exthrifts-admin.apk", DIGEST, MANIFEST));
    }

    @Test public void rejectsPlainHttpAndCredentials() {
        assertNull(ReleaseInfo.of(120, "0.1.20", "http://github.com/o/r/a.apk", DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", "https://user:pass@github.com/o/r/a.apk", DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", APK, DIGEST, "http://github.com/o/r/update.json"));
    }

    @Test public void rejectsMalformedFields() {
        assertNull(ReleaseInfo.of(0, "0.1.0", APK, DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "", APK, DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, null, APK, DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "x".repeat(41), APK, DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", APK, "not-a-digest", MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", APK, null, MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", "not a url", DIGEST, MANIFEST));
        assertNull(ReleaseInfo.of(120, "0.1.20", null, DIGEST, MANIFEST));
    }

    @Test public void readsOnlyHttpsHosts() {
        assertEquals("github.com", ReleaseInfo.httpsHost("https://GitHub.com/x"));
        assertNull(ReleaseInfo.httpsHost("ftp://github.com/x"));
        assertNull(ReleaseInfo.httpsHost(""));
        assertNull(ReleaseInfo.httpsHost(null));
    }
}
