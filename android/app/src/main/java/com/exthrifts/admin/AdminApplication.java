package com.exthrifts.admin;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

/** Starts Firebase from build settings (no google-services.json) and creates the channels. */
public final class AdminApplication extends Application {
    static final String CHANNEL_NEW_ORDERS = "new_orders";

    @Override public void onCreate() {
        super.onCreate();
        if (pushConfigured() && FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY).setProjectId(BuildConfig.FIREBASE_PROJECT_ID).build();
            FirebaseApp.initializeApp(this, options);
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        // Creating an existing channel only updates its name and description, so this is safe on every start.
        // High importance gives a heads-up alert with the default notification sound.
        NotificationChannel orders = new NotificationChannel(CHANNEL_NEW_ORDERS,
            getString(R.string.channel_new_orders), NotificationManager.IMPORTANCE_HIGH);
        orders.setDescription(getString(R.string.channel_new_orders_description));
        manager.createNotificationChannel(orders);
        NotificationChannel updates = new NotificationChannel(AppUpdates.CHANNEL,
            getString(R.string.channel_app_updates), NotificationManager.IMPORTANCE_DEFAULT);
        updates.setDescription(getString(R.string.channel_app_updates_description));
        manager.createNotificationChannel(updates);
        UpdateCheckJob.schedule(this);
    }

    /** All four Firebase values present. Without them the app is the admin shell with no alerts. */
    static boolean pushConfigured() {
        return !BuildConfig.FIREBASE_APP_ID.isEmpty() && !BuildConfig.FIREBASE_SENDER_ID.isEmpty()
            && !BuildConfig.FIREBASE_API_KEY.isEmpty() && !BuildConfig.FIREBASE_PROJECT_ID.isEmpty();
    }
}
