package com.exthrifts.admin;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/** Looks for a newer release about every six hours, and soon after the app is opened. */
public final class UpdateCheckJob extends JobService {
    private static final int ID = 6251;

    static void schedule(Context context) {
        if (!AppUpdates.configured()) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        // Rescheduling would restart the period on every process start, so leave a live job alone.
        if (scheduler == null || scheduler.getPendingJob(ID) != null) return;
        scheduler.schedule(new JobInfo.Builder(ID, new ComponentName(context, UpdateCheckJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(6 * 60 * 60_000L)
            .setPersisted(true).build());
    }

    /** Throttled, so opening the app ten times an hour checks at most twice. */
    static void runSoon(Context context) {
        if (!AppUpdates.checkDue(context)) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;
        scheduler.schedule(new JobInfo.Builder(ID + 1, new ComponentName(context, UpdateCheckJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setOverrideDeadline(0).build());
    }

    @Override public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                ReleaseInfo release = AppUpdates.check(this);
                if (release != null) AppUpdates.notifyAvailable(this, release);
            } catch (Exception ignored) {
                // Offline or GitHub unreachable: the next period tries again.
            }
            jobFinished(params, false);
        }, "update-check").start();
        return true;
    }

    @Override public boolean onStopJob(JobParameters params) { return true; }
}
