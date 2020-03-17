/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidlib;

import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RatingBar;

import androidx.appcompat.app.AlertDialog;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Class to take care of reminding user that it is a good idea to rate the app. */
public class RateAppController {
    private static String RATE_ASK_COUNTER_KEY = "RATE_ASK_COUNTER";
    private static String RATE_COUNTER_LAST_UPDATE_KEY = "RATE_COUNTER_LAST_UPDATE_DATE";
    private static String RATE_ALREADY_RATED_KEY = "RATE_ALREADY_RATED";

    private LOActivity mActivity;

    RateAppController(LOActivity activity) {
        this.mActivity = activity;
    }

    /** Opens up the app page in Google Play. */
    private void openInGooglePlay() {
        String marketUri = String.format("market://details?id=%1$s", mActivity.getPackageName());
        String webUri = String.format("https://play.google.com/store/apps/details?id=%1$s", mActivity.getPackageName());

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(marketUri));
        if (mActivity.getPackageManager().queryIntentActivities(intent, 0).size() <= 0) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(webUri));
            if (mActivity.getPackageManager().queryIntentActivities(intent, 0).size() <= 0) {
                intent = null;
            }
        }

        if (intent != null) {
            mActivity.getPrefs().edit().putBoolean(RATE_ALREADY_RATED_KEY, true).apply();
            mActivity.startActivity(intent);
        }
    }

    /** Ask the user for rating from time to time (unless they've already rated, or it is not time yet. */
    public void askUserForRating() {
        if (!shouldAsk())
            return;

        AlertDialog.Builder builder = new AlertDialog.Builder(mActivity);
        final View rateAppLayout = mActivity.getLayoutInflater().inflate(R.layout.rate_app_layout, null);
        builder.setView(rateAppLayout);

        builder.setPositiveButton(R.string.rate_now, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // start google play activity for rating
                openInGooglePlay();
            }
        });
        builder.setNegativeButton(R.string.later, null);

        final AlertDialog alertDialog = builder.create();

        RatingBar ratingBar = rateAppLayout.findViewById(R.id.ratingBar);
        ratingBar.setOnRatingBarChangeListener(new RatingBar.OnRatingBarChangeListener() {
            @Override
            public void onRatingChanged(RatingBar ratingBar1, float v, boolean b) {
                // start google play activity for rating
                openInGooglePlay();
                alertDialog.dismiss();
            }
        });
        alertDialog.show();
    }

    /**
     * The counter is incremented once in each day when a document is opened successfully
     * If the counter is 4 (meaning it's the 5th day, starting from 0), return true unless the user is already rated
     * When the dialog is dismissed, ask again in another 5 days
     */
    private boolean shouldAsk() {
        // don't ask if the user has already rated
        if (mActivity.getPrefs().getBoolean(RATE_ALREADY_RATED_KEY, false))
            return false;

        final int COUNT_BETWEEN_RATINGS = 5;

        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd", Locale.US);
        Date today = new Date();
        long lastDate = mActivity.getPrefs().getLong(RateAppController.RATE_COUNTER_LAST_UPDATE_KEY, 0);

        // don't ask if we have already asked and/or increased the countar today
        if (dateFormat.format(today).equals(dateFormat.format(lastDate)))
            return false;

        boolean ret = false;
        int counter = mActivity.getPrefs().getInt(RATE_ASK_COUNTER_KEY, 0);
        if (counter == COUNT_BETWEEN_RATINGS - 1)
            ret = true;

        // update the counter and date
        mActivity.getPrefs().edit()
            .putInt(RATE_ASK_COUNTER_KEY, (counter + 1) % COUNT_BETWEEN_RATINGS)
            .putLong(RATE_COUNTER_LAST_UPDATE_KEY, today.getTime())
            .apply();

        return ret;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
