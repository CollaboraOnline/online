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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class COWebViewClient extends WebViewClient {
    private MobileSocket mobileSocket;

    public COWebViewClient() {
        super();
        mobileSocket = new MobileSocket();
    }

    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!Objects.equals(request.getUrl().getScheme(), "cool")) {
            return super.shouldInterceptRequest(view, request);
        }

        String path = request.getUrl().getPath();
        if (Objects.equals(path, "/cool/media")) {
            return handleMediaRequest(request);
        } else if (path != null && path.startsWith("/cool/mobilesocket/")) {
            return handleMobileSocketRequest(request);
        } else {
            Map<String, String> responseHeaders = new HashMap<>();
            responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins
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
    }

    private WebResourceResponse handleMediaRequest(WebResourceRequest request) {
        Map<String, String> responseHeaders = new HashMap<>();
        responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins

        Uri uriDecoded = Uri.parse(Uri.decode(request.getUrl().toString())); // We have to do this weird-looking decoding step as presentation mode gives us a broken (i.e. parameters are encoded, including the & delimiter, etc.) URI
        String tag = uriDecoded.getQueryParameter("Tag");

        if (tag == null) {
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

        String mediaPath = getEmbeddedMediaPath(tag);

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

    private WebResourceResponse handleMobileSocketRequest(WebResourceRequest request) {
        // this'll be something like [ 'cool', 'mobilesocket', 'cool', 'wopipath', 'ws', 'ws', command, 'open', id ]
        List<String> path = request.getUrl().getPathSegments();

        if (path.size() < 7) {
            Map<String, String> responseHeaders = new HashMap<>();
            responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins
           	responseHeaders.put("Content-Length", "0");

            ByteArrayInputStream data = new ByteArrayInputStream(new byte[0]);

            return new WebResourceResponse(
                null,
                null,
                400,
                "Bad Request",
                responseHeaders,
                data
            );
        }

        if (path.get(6).equals("open")) {
            return mobileSocket.open();
        }

        // Anything except open can just be treated as "write". In the Android app we can't send data in "write"s anyway...
        return mobileSocket.write();
    }

    public MobileSocket getMobileSocket() {
        return mobileSocket;
    }

    private native String getEmbeddedMediaPath(String tag);
}
