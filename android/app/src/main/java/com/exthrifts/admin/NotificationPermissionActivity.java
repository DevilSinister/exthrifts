package com.exthrifts.admin;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;

/**
 * Shown once, before the admin opens, on Android 13+ when alerts are not yet allowed:
 * says why, then asks. Either answer returns to the launcher, which opens the admin.
 * AppLauncherActivity.shouldAskForNotifications only starts it on API 33+.
 */
@TargetApi(33)
public final class NotificationPermissionActivity extends Activity {
    private static final int REQUEST = 1;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        int gutter = Ui.dp(this, R.dimen.gutter_page);
        page.setPadding(gutter, Ui.dp(this, R.dimen.space_10), gutter, Ui.dp(this, R.dimen.space_8));
        page.setBackgroundColor(getColor(R.color.paper));

        page.addView(Ui.text(this, R.style.Text_Eyebrow, R.string.permission_eyebrow));
        page.addView(Ui.spaced(this, Ui.text(this, R.style.Text_Display, R.string.permission_heading), R.dimen.space_2));
        page.addView(Ui.spaced(this, Ui.text(this, R.style.Text_Lede, R.string.permission_lede), R.dimen.space_4));

        Button allow = Ui.button(this, R.style.Widget_ExThrifts_Button_Primary, R.string.permission_allow);
        page.addView(Ui.spaced(this, allow, R.dimen.space_8));
        Button skip = Ui.button(this, R.style.Widget_ExThrifts_Button_Outline, R.string.permission_skip);
        page.addView(Ui.spaced(this, skip, R.dimen.space_2));
        allow.setOnClickListener(view -> requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST));
        skip.setOnClickListener(view -> finish());

        scroll.addView(page);
        setContentView(scroll);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST) finish();
    }
}
