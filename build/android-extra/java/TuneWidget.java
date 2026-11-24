package com.h24creationz.tunetune;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Home-screen widget: one tap to Resume, Favorites, Offline Mix or Party Mode. */
public class TuneWidget extends AppWidgetProvider {
    private static PendingIntent open(Context c, String what, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("tunetune://open/" + what));
        i.setClass(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tune_widget);
            v.setOnClickPendingIntent(R.id.w_logo, open(c, "home", 10));
            v.setOnClickPendingIntent(R.id.w_resume, open(c, "resume", 11));
            v.setOnClickPendingIntent(R.id.w_liked, open(c, "liked", 12));
            v.setOnClickPendingIntent(R.id.w_offline, open(c, "offline", 13));
            v.setOnClickPendingIntent(R.id.w_party, open(c, "party", 14));
            m.updateAppWidget(id, v);
        }
    }
}
