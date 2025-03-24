/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
package org.libreoffice.androidlib;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class COWebViewClient extends WebViewClient {
    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!Objects.equals(request.getUrl().getScheme(), "cool")) {
            return super.shouldInterceptRequest(view, request);
        }

        Uri uriDecoded = Uri.parse(Uri.decode(request.getUrl().toString())); // We have to do this weird-looking decoding step as presentation mode gives us a broken (i.e. parameters are encoded, including the & delimiter, etc.) URI
        String tag = uriDecoded.getQueryParameter("Tag");

        if (tag == null) {
            return super.shouldInterceptRequest(view, request);
        }

        String mediaPath = getEmbeddedMediaPath(tag);

        Map<String, String> responseHeaders = new HashMap<>();

        if (mediaPath.isEmpty()) {
            responseHeaders.put("Content-Length", "0");

            ByteArrayInputStream data = new ByteArrayInputStream(new byte[0]);

            return new WebResourceResponse(
                    null,
                    null,
                    404,
                    "Not Found",
                    responseHeaders,
                    data
            );
        }

        File media = new File(mediaPath);

        if (!media.exists()) {
            responseHeaders.put("Content-Length", "0");

            ByteArrayInputStream data = new ByteArrayInputStream(new byte[0]);

            return new WebResourceResponse(
                    null,
                    null,
                    404,
                    "Not Found",
                    responseHeaders,
                    data
            );
        }

        String reasonPhrase = "OK";

       	responseHeaders.put("Content-Length", Long.toString(media.length()));
 
        FileInputStream data;
        try {
            data = new FileInputStream(media);
        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }

        return new WebResourceResponse(
            null,
            null,
            200,
            reasonPhrase,
            responseHeaders,
            data
        );
    }

    private native String getEmbeddedMediaPath(String tag);
}
