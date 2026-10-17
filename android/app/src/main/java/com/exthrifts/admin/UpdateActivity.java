package com.exthrifts.admin;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Downloads and installs a newer release. Opened from the launcher prompt or the update
 * notification; with EXTRA_START it begins at once, because the
 * person already chose "Update" to get here.
 */
public final class UpdateActivity extends Activity implements UpdateInstallReceiver.Listener {
    private static final String EXTRA_START = "start";

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextView heading, status;
    private ProgressBar progress;
    private Button primary, dismiss;
    private ReleaseInfo release;
    private boolean busy, awaitingPermission;

    static Intent intent(Context context, boolean start) {
        return new Intent(context, UpdateActivity.class).putExtra(EXTRA_START, start);
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        int gutter = Ui.dp(this, R.dimen.gutter_page);
        page.setPadding(gutter, Ui.dp(this, R.dimen.space_10), gutter, Ui.dp(this, R.dimen.space_8));
        page.setBackgroundColor(getColor(R.color.paper));

        page.addView(Ui.text(this, R.style.Text_Eyebrow, R.string.update_eyebrow));
        heading = Ui.spaced(this, Ui.text(this, R.style.Text_Display, R.string.update_checking), R.dimen.space_2);
        page.addView(heading);
        page.addView(Ui.spaced(this, Ui.text(this, R.style.Text_Lede, R.string.update_lede), R.dimen.space_4));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setVisibility(View.GONE);
        page.addView(Ui.spaced(this, progress, R.dimen.space_6));

        status = Ui.text(this, R.style.Text_Caption, "");
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        page.addView(Ui.spaced(this, status, R.dimen.space_3));

        primary = Ui.button(this, R.style.Widget_ExThrifts_Button_Primary, R.string.update_now);
        page.addView(Ui.spaced(this, primary, R.dimen.space_6));
        dismiss = Ui.button(this, R.style.Widget_ExThrifts_Button_Outline, R.string.update_not_now);
        page.addView(Ui.spaced(this, dismiss, R.dimen.space_2));
        primary.setOnClickListener(view -> start());
        dismiss.setOnClickListener(view -> finish());

        scroll.addView(page);
        setContentView(scroll);
        UpdateInstallReceiver.listen(this);

        release = AppUpdates.available(this);
        if (!AppUpdates.configured()) showUpToDate(R.string.update_not_configured);
        else if (release == null) checkNow();
        else showReady(getIntent().getBooleanExtra(EXTRA_START, false));
    }

    @Override protected void onResume() {
        super.onResume();
        // Back from "Install unknown apps": carry on without a second tap.
        if (awaitingPermission && getPackageManager().canRequestPackageInstalls()) {
            awaitingPermission = false;
            start();
        }
    }

    private void checkNow() {
        busy = true;
        primary.setVisibility(View.GONE);
        status.setText("");
        worker.execute(() -> {
            ReleaseInfo found;
            try { found = AppUpdates.check(this); }
            catch (Exception offline) { runOnUiThread(() -> fail(getString(R.string.update_check_failed))); return; }
            runOnUiThread(() -> {
                busy = false;
                release = found;
                if (found == null) showUpToDate(R.string.update_up_to_date_body);
                else showReady(getIntent().getBooleanExtra(EXTRA_START, false));
            });
        });
    }

    private void showReady(boolean startNow) {
        heading.setText(getString(R.string.update_ready_heading, release.versionName));
        primary.setVisibility(View.VISIBLE);
        primary.setText(R.string.update_now);
        if (startNow) start();
    }

    private void showUpToDate(int bodyRes) {
        heading.setText(R.string.update_up_to_date);
        status.setText(getString(bodyRes, BuildConfig.VERSION_NAME));
        primary.setVisibility(View.GONE);
        dismiss.setText(R.string.update_close);
    }

    private void start() {
        if (busy || release == null) return;
        if (!getPackageManager().canRequestPackageInstalls()) {
            awaitingPermission = true;
            status.setText(R.string.update_permission_needed);
            primary.setText(R.string.update_open_settings);
            primary.setOnClickListener(view -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getPackageName()))));
            return;
        }
        primary.setOnClickListener(view -> start());
        busy = true;
        primary.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        progress.setIndeterminate(true);
        status.setText(R.string.update_downloading);
        ReleaseInfo target = release;
        worker.execute(() -> {
            try {
                File apk = AppUpdates.download(this, target, (done, total) -> runOnUiThread(() -> {
                    if (total <= 0) return;
                    progress.setIndeterminate(false);
                    progress.setProgress((int) (done * 100 / total));
                }));
                runOnUiThread(() -> { progress.setIndeterminate(true); status.setText(R.string.update_installing); });
                AppUpdates.install(this, apk);
            } catch (Exception failure) {
                String message = failure.getMessage() == null ? getString(R.string.update_download_failed) : failure.getMessage();
                runOnUiThread(() -> fail(message));
            }
        });
    }

    @Override public void onInstallStatus(int installStatus, String message) {
        runOnUiThread(() -> {
            switch (installStatus) {
                case PackageInstaller.STATUS_PENDING_USER_ACTION:
                    status.setText(R.string.update_confirm);
                    break;
                case PackageInstaller.STATUS_SUCCESS:
                    // Usually never seen: Android stops this process to replace it.
                    progress.setVisibility(View.GONE);
                    status.setText(R.string.update_installed);
                    break;
                case PackageInstaller.STATUS_FAILURE_ABORTED:
                    fail(getString(R.string.update_cancelled));
                    break;
                case PackageInstaller.STATUS_FAILURE_CONFLICT:
                case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE:
                    fail(getString(R.string.update_signature_mismatch));
                    break;
                case PackageInstaller.STATUS_FAILURE_STORAGE:
                    fail(getString(R.string.update_no_space));
                    break;
                default:
                    fail(message == null || message.isEmpty() ? getString(R.string.update_install_failed) : message);
            }
        });
    }

    private void fail(String message) {
        busy = false;
        progress.setVisibility(View.GONE);
        status.setText(message);
        primary.setEnabled(true);
        primary.setVisibility(View.VISIBLE);
        primary.setText(R.string.update_try_again);
        primary.setOnClickListener(view -> { if (release == null) checkNow(); else start(); });
    }

    @Override protected void onDestroy() {
        UpdateInstallReceiver.listen(null);
        worker.shutdown();
        super.onDestroy();
    }
}
