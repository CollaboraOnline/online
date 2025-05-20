/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
package org.libreoffice.androidlib;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Logger;

public class COWebViewClient extends WebViewClient {
    private String LOGTAG = COWebViewClient.class.getSimpleName();

    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!Objects.equals(request.getUrl().getScheme(), "cool") && !Objects.equals(request.getUrl().getHost(), "cool")) {
            return super.shouldInterceptRequest(view, request);
        }

        String path = request.getUrl().getPath();
        if (path == null) {
            path = "";
        }

        Log.i(LOGTAG, "Received request to " + path + " via cool request interception");

        switch (path) {
            case "/cool/media": return handleMediaRequest(view, request);
            case "/cool/messages": return handleMessagesRequest(view, request);
            default: return new WebResourceResponse(
                    null,
                    null,
                    404,
                    "Not Found",
                    new HashMap<String, String>() {
                        {
                            put("Access-Control-Allow-Origin", "null");
                            put("Content-Length", "0");
                        }
                    },
                    new ByteArrayInputStream(new byte[0])
            );
        }
    }

    private WebResourceResponse handleMediaRequest(WebView view, WebResourceRequest request) {
        Uri uriDecoded = Uri.parse(Uri.decode(request.getUrl().toString())); // We have to do this weird-looking decoding step as presentation mode gives us a broken (i.e. parameters are encoded, including the & delimiter, etc.) URI
        String tag = uriDecoded.getQueryParameter("Tag");

        if (tag == null) {
            return super.shouldInterceptRequest(view, request);
        }

        String mediaPath = getEmbeddedMediaPath(tag);

        Map<String, String> responseHeaders = new HashMap<>();
        responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins

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

    private WebResourceResponse handleMessagesRequest(WebView view, WebResourceRequest request) {
        Map<String, String> responseHeaders = new HashMap<>();
        responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins

        PipedOutputStream outputStream = new PipedOutputStream();
        PipedInputStream data;
        try {
            data = new PipedInputStream(outputStream);
        } catch (IOException e) {
            responseHeaders.put("Content-Length", "0");

            ByteArrayInputStream errorBody = new ByteArrayInputStream(new byte[0]);

            return new WebResourceResponse(
                    null,
                    null,
                    500,
                    "Internal Server Error",
                    responseHeaders,
                    errorBody
            );
        }

        try {
            // We have to send some initial message or the socket chokes
            byte[] message = "hello world!".getBytes();

            ByteBuffer header = ByteBuffer.allocate(5);
            header.putInt(message.length);
            header.put((byte)0); // 0 is for 'Not a binary message'

            outputStream.write(header.array());
            outputStream.write(message);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        LOActivity.MessageOutputStreamLock.lock();
        LOActivity.MessageOutputStream = outputStream;
        LOActivity.MessageOutputStreamLock.unlock();


        Log.i(LOGTAG, "Sending streamed WebResourceResponse");
        return new WebResourceResponse(
                null,
                null,
                200,
                "OK",
                responseHeaders,
                data
        );
    }

    private native String getEmbeddedMediaPath(String tag);
}
