package com.exthrifts.admin;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * One data-only FCM message from the website, validated before it can become a
 * notification or an intent. A message that is not ours is dropped; a target path
 * that is not an admin path on our own origin falls back to the orders list.
 *
 * Contract (docs/ANDROID.md): {type:"order", orderId, number, title, body, targetPath}.
 * The website's "Send test" uses {type:"test", title, body, targetPath, tag}.
 */
final class OrderAlert {
    static final String FALLBACK_PATH = "/admin/orders";
    static final int MAX_TITLE = 120;
    static final int MAX_BODY = 240;
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Pattern TAG = Pattern.compile("[A-Za-z0-9_-]{1,80}");
    // Letters, digits and the few characters an admin path or query needs. No %, no backslash, no colon.
    private static final Pattern PATH = Pattern.compile("/admin/[A-Za-z0-9/_.~?=&-]*");

    final String tag;
    final String title;
    final String body;
    final String targetPath;

    private OrderAlert(String tag, String title, String body, String targetPath) {
        this.tag = tag;
        this.title = title;
        this.body = body;
        this.targetPath = targetPath;
    }

    /** Returns null when the message is not an order or test alert. */
    static OrderAlert parse(Map<String, String> data, String defaultTitle, String defaultBody) {
        if (data == null) return null;
        String type = data.get("type");
        String tag;
        String fallbackTitle = defaultTitle;
        if ("order".equals(type)) {
            String orderId = data.get("orderId");
            if (orderId == null || !ID.matcher(orderId).matches()) return null;
            // One alert per order: a retried send replaces it instead of stacking a second one.
            tag = "order-" + orderId;
            String number = value(data.get("number"), null);
            if (number != null) fallbackTitle = defaultTitle + " " + clip(number, 32);
        } else if ("test".equals(type)) {
            String given = data.get("tag");
            tag = given != null && TAG.matcher(given).matches() ? given : "test";
        } else {
            return null;
        }
        String title = clip(value(data.get("title"), fallbackTitle), MAX_TITLE);
        String body = clip(value(data.get("body"), defaultBody), MAX_BODY);
        return new OrderAlert(tag, title, body, safePath(data.get("targetPath")));
    }

    /** Accepts only an absolute /admin/ path on our own origin; anything else opens the orders list. */
    static String safePath(String path) {
        if (path == null || path.length() > 200) return FALLBACK_PATH;
        if (path.startsWith("//") || path.contains("..") || path.contains("//")) return FALLBACK_PATH;
        return PATH.matcher(path).matches() ? path : FALLBACK_PATH;
    }

    private static String value(String candidate, String fallback) {
        return candidate == null || candidate.trim().isEmpty() ? fallback : candidate.trim();
    }

    private static String clip(String text, int max) {
        return text.length() > max ? text.substring(0, max) : text;
    }
}
