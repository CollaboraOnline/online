/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        final WebView browser = findViewById(R.id.browser);
        browser.setWebViewClient(new WebViewClient());

        WebSettings browserSettings = browser.getSettings();
        browserSettings.setJavaScriptEnabled(true);
        browser.addJavascriptInterface(new JavaScriptInterface(), "MainHandler");

        browser.loadUrl("file:///android_asset/dist/loleaflet.html");

        Button jsButton = findViewById(R.id.js_button);
        jsButton.setOnClickListener(new View.OnClickListener() {
                                        @Override
                                        public void onClick(View v) {
                                            browser.loadUrl("javascript:helloFromJavascript()");
                                        }
                                    }
        );
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
