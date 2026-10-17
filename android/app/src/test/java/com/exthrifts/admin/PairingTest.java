package com.exthrifts.admin;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class PairingTest {
    private static final String SITE = "https://exthrifts.com";
    // Real FCM tokens look like this: letters, digits, '-', '_' and one ':'.
    private static final String TOKEN = "dX1b2C3d4E5:APA91bH-abc_DEF123";

    @Test public void addsTheTokenAndLabelToTheAdminHome() {
        assertEquals("https://exthrifts.com/admin#device=dX1b2C3d4E5%3AAPA91bH-abc_DEF123&label=Pixel%208",
            Pairing.launchUrl("https://exthrifts.com/admin", SITE, TOKEN, "Pixel 8"));
    }

    @Test public void keepsADeepLinkOnOurSite() {
        assertEquals("https://exthrifts.com/admin/orders/abc#device=dX1b2C3d4E5%3AAPA91bH-abc_DEF123",
            Pairing.launchUrl("https://exthrifts.com/admin/orders/abc", SITE, TOKEN, null));
    }

    @Test public void neverSendsTheTokenToAnotherOrigin() {
        String expected = "https://exthrifts.com/admin#device=dX1b2C3d4E5%3AAPA91bH-abc_DEF123";
        assertEquals(expected, Pairing.launchUrl("https://evil.example/admin", SITE, TOKEN, ""));
        assertEquals(expected, Pairing.launchUrl("http://exthrifts.com/admin", SITE, TOKEN, ""));
        assertEquals(expected, Pairing.launchUrl("https://exthrifts.com:8443/admin", SITE, TOKEN, ""));
        assertEquals(expected, Pairing.launchUrl("https://exthrifts.com.evil.example/admin", SITE, TOKEN, ""));
        assertEquals(expected, Pairing.launchUrl("https://user@exthrifts.com/admin", SITE, TOKEN, ""));
        assertEquals(expected, Pairing.launchUrl(null, SITE, TOKEN, ""));
    }

    @Test public void leavesTheUrlAloneWithoutAToken() {
        assertEquals("https://exthrifts.com/admin", Pairing.launchUrl("https://exthrifts.com/admin", SITE, null, "Pixel"));
        assertEquals("https://exthrifts.com/admin", Pairing.launchUrl("https://exthrifts.com/admin", SITE, "", "Pixel"));
    }

    @Test public void doesNotClobberAnExistingFragment() {
        assertEquals("https://exthrifts.com/admin#section",
            Pairing.launchUrl("https://exthrifts.com/admin#section", SITE, TOKEN, "Pixel"));
    }

    @Test public void comparesOriginsByEffectivePort() {
        assertTrue(Pairing.sameOrigin("https://EXTHRIFTS.com:443/x", SITE));
        assertFalse(Pairing.sameOrigin("not a url", SITE));
    }

    @Test public void encodesForDecodeUriComponent() {
        assertEquals("a%20b%2Bc%26d%3De", Pairing.encode("a b+c&d=e"));
    }
}
