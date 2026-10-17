package com.exthrifts.admin;

import android.app.Activity;
import android.content.Context;
import com.google.firebase.messaging.FirebaseMessaging;

/** This install's FCM token, cached so a launch can pair without waiting on the network. */
final class DeviceToken {
    private static final String PREFS = "push";
    private static final String KEY = "token";

    private DeviceToken() {}

    interface Callback { void onToken(String token); }

    static String cached(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
    }

    static void store(Context context, String token) {
        if (token == null || token.isEmpty()) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, token).apply();
    }

    /**
     * Asks Firebase for the current token, caches it and reports it (null on failure).
     * The listener is bound to the activity, so it is dropped once the activity stops.
     */
    static void refresh(Activity activity, Callback callback) {
        if (!AdminApplication.pushConfigured()) { callback.onToken(null); return; }
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(activity, task -> {
                String token = task.isSuccessful() ? task.getResult() : null;
                store(activity, token);
                callback.onToken(token);
            });
        } catch (RuntimeException unavailable) {
            // Firebase not initialised (e.g. Play services missing): open the admin without pairing.
            callback.onToken(null);
        }
    }
}
