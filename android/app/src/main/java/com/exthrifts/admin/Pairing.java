package com.exthrifts.admin;

import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLEncoder;
import java.util.Locale;

/**
 * Pairs this phone with whichever admin is signed in on the website, with no native login.
 *
 * The launcher opens the admin as {@code <site>/admin#device=<FCM token>&label=<model>}. A
 * fragment never reaches the server or its logs; the admin page reads it, POSTs
 * {token, label} to /api/admin/devices with its own cookie session, and clears it.
 * Every launch re-sends the current token, so a refreshed token pairs itself.
 */
final class Pairing {
    private Pairing() {}

    /**
     * The URL to open: the requested one when it is on our own site, else the admin home,
     * with the device fragment added. A URL from anywhere else never receives the token.
     */
    static String launchUrl(String requested, String siteUrl, String token, String label) {
        String url = requested != null && sameOrigin(requested, siteUrl) ? requested : siteUrl + "/admin";
        if (token == null || token.isEmpty() || url.indexOf('#') >= 0) return url;
        String fragment = "device=" + encode(token);
        if (label != null && !label.trim().isEmpty()) fragment += "&label=" + encode(label.trim());
        return url + "#" + fragment;
    }

    /** Same scheme, host and effective port. */
    static boolean sameOrigin(String a, String b) {
        try {
            URI left = new URI(a), right = new URI(b);
            if (left.getScheme() == null || left.getHost() == null || right.getScheme() == null || right.getHost() == null) return false;
            if (left.getUserInfo() != null) return false;
            return left.getScheme().equalsIgnoreCase(right.getScheme())
                && left.getHost().toLowerCase(Locale.ROOT).equals(right.getHost().toLowerCase(Locale.ROOT))
                && port(left) == port(right);
        } catch (Exception invalid) {
            return false;
        }
    }

    private static int port(URI uri) {
        if (uri.getPort() != -1) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : "http".equalsIgnoreCase(uri.getScheme()) ? 80 : -1;
    }

    /** Percent-encoding the website's decodeURIComponent reverses exactly (space is %20, never +). */
    static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
