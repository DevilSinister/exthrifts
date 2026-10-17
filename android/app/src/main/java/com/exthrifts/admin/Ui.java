package com.exthrifts.admin;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Construction helpers for the two small native screens. Everything resolves through
 * res/values, so dimensions are dp and the type scale lives in styles.xml.
 *
 * Button styles passed as defStyleRes inherit the platform button style (see styles.xml);
 * a parentless style would drop the defaults that make a view clickable and focusable.
 */
final class Ui {
    private Ui() {}

    static int dp(Context context, int dimen) {
        return context.getResources().getDimensionPixelSize(dimen);
    }

    static TextView text(Context context, int styleRes, CharSequence value) {
        TextView view = new TextView(context, null, 0, styleRes);
        view.setText(value);
        return view;
    }

    static TextView text(Context context, int styleRes, int stringRes) {
        return text(context, styleRes, context.getString(stringRes));
    }

    static Button button(Context context, int styleRes, int stringRes) {
        Button view = new Button(context, null, 0, styleRes);
        view.setText(stringRes);
        return view;
    }

    /** Vertical rhythm between stacked children. */
    static <T extends View> T spaced(Context context, T view, int topDimen) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(context, topDimen);
        view.setLayoutParams(params);
        return view;
    }
}
