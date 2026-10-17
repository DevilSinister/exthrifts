package com.exthrifts.admin;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Turns the website's data-only order messages into heads-up alerts that open the order. */
public final class OrderMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        // The website learns the new token on the next launch, from the URL fragment (see Pairing).
        DeviceToken.store(this, token);
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        OrderAlert alert = OrderAlert.parse(message.getData(),
            getString(R.string.order_default_title), getString(R.string.order_default_body));
        if (alert == null) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        long sentAt = message.getSentTime();
        Notification notification = new Notification.Builder(this, AdminApplication.CHANNEL_NEW_ORDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(getColor(R.color.ink))
            .setContentTitle(alert.title)
            .setContentText(alert.body)
            .setStyle(new Notification.BigTextStyle().bigText(alert.body))
            .setCategory(Notification.CATEGORY_EVENT)
            .setWhen(sentAt > 0 ? sentAt : System.currentTimeMillis())
            .setShowWhen(true)
            .setAutoCancel(true)
            .setContentIntent(openIntent(this, alert))
            .build();
        // Tag "order-<id>", id 0: a retried send replaces the alert instead of stacking a second one.
        manager.notify(alert.tag, 0, notification);
    }

    /** Opens the admin at the alert's path inside this app; never hands the URL to another app. */
    static PendingIntent openIntent(Context context, OrderAlert alert) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.SITE_URL + alert.targetPath))
            .setPackage(context.getPackageName())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // The https VIEW filter only matches an https site; a local http debug build names the launcher directly.
        if (!BuildConfig.SITE_URL.startsWith("https://")) intent.setClass(context, AppLauncherActivity.class);
        return PendingIntent.getActivity(context, alert.tag.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
