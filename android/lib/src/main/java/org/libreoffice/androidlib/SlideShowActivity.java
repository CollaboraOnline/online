/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidlib;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.util.Log;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class SlideShowActivity extends AppCompatActivity {

    private WebView slideShowWebView;
    private String slidesSvgUri;

    private static final String TAG = "SlideShowActivity";
    static final String SVG_URI_KEY = "svgUriKey";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.lolib_activity_slide_show);
        slideShowWebView = findViewById(R.id.slide_show_webView);
        if (savedInstanceState == null) {
            slidesSvgUri = getIntent().getStringExtra(SVG_URI_KEY);
        } else {
            slidesSvgUri = savedInstanceState.getString(SVG_URI_KEY);
        }
        Log.d(TAG, "SlideShow Svg Uri "+slidesSvgUri);
        SharedPreferences sPrefs = PreferenceManager.getDefaultSharedPreferences(getApplicationContext());

        // allow debugging (when building the debug version); see details in
        // https://developers.google.com/web/tools/chrome-devtools/remote-debugging/webviews
        boolean isChromeDebugEnabled = sPrefs.getBoolean("ENABLE_CHROME_DEBUGGING", false);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 || isChromeDebugEnabled) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        slideShowWebView.setBackgroundColor(Color.BLACK);
        WebSettings slideShowWebViewSettings = slideShowWebView.getSettings();
        slideShowWebViewSettings.setLoadWithOverviewMode(true);
        slideShowWebViewSettings.setLoadsImagesAutomatically(true);
        slideShowWebViewSettings.setUseWideViewPort(true);
        slideShowWebViewSettings.setJavaScriptEnabled(true);
        slideShowWebViewSettings.setSupportZoom(true);
        slideShowWebViewSettings.setBuiltInZoomControls(true);
        slideShowWebView.loadUrl(slidesSvgUri);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(SVG_URI_KEY, slidesSvgUri);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }
}
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
