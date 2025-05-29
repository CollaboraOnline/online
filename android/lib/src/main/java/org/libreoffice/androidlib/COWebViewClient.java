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
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class COWebViewClient extends WebViewClient {
    int serial;

    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!Objects.equals(request.getUrl().getScheme(), "cool")) {
            return super.shouldInterceptRequest(view, request);
        }

        String path = request.getUrl().getPath();
        if (path == "/cool/media") {
            return handleMediaRequest(request);
        } else if (path.startsWith("/cool/mobilesocket/")) {
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

    public void sendMessage(byte[] message, PipedOutputStream output) throws IOException {
        this.serial = this.serial + 1;

        byte[] serialString = Integer.toString(this.serial).getBytes();
        // Not sure how we "stick to the format" if our messages aren't binary...
        ByteBuffer packet = ByteBuffer.allocate(
            1 /* type */
            + (2 * 2) /* preambles */
            + serialString.length
            + 2 /* EOM newlines */
            + message.length
        );
        Boolean binary = false;

        for (byte b : message) {
            if (b == '\n') {
                binary = true;
                break;
            }
        }

        packet.put((byte)(binary ? 'B' : 'T'));

        // Preamble
        packet.put((byte)'0');
        packet.put((byte)'x');

        packet.put(serialString);
        packet.put((byte)'\n'); // End of first line

        // Preamble
        packet.put((byte)'0');
        packet.put((byte)'x');

        packet.put(message);
        packet.put((byte)'\n'); // End of message

        output.write(packet.array());
    }

    public void flushMessageBuffer(PipedOutputStream output) throws IOException {
        ArrayList<byte[]> messages = new ArrayList();
        LOActivity.SendingMessages.drainTo(messages);

        for (byte[] message : messages){
            sendMessage(message, output);
        }
        output.close();
    }

    private WebResourceResponse handleMobileSocketRequest(WebResourceRequest request) {
        Map<String, String> responseHeaders = new HashMap<>();
        responseHeaders.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is 'null' for 'file:' origins

        // this'll be something like [ 'cool', 'mobilesocket', 'cool', 'wopipath', 'ws', 'ws', command, 'open', id ]
        List<String> path = request.getUrl().getPathSegments();
        
        // XXX: because I am scrappy-fiddling this [see <https://www.todepond.com/wikiblogarden/scrappy-fiddles/>...] I am just going to Send All The Data We Have Every Time. Immediately. No waiting around

        switch(path.get(6)) {
            case "open": {
                this.serial = 0;
                return new WebResourceResponse(
                    null,
                    null,
                    200,
                    "OK",
                    responseHeaders,
                    new ByteArrayInputStream("mobile".getBytes())
                );
            }
            default: { // Anything except open can just be treated as "write"
                PipedInputStream data; 
                try {
                    PipedOutputStream output = new PipedOutputStream();
                    data = new PipedInputStream(output);

                    flushMessageBuffer(output);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }

                return new WebResourceResponse(
                    null,
                    null,
                    200,
                    "OK",
                    responseHeaders,
                    data
                );
            }
        }
    }

    private native String getEmbeddedMediaPath(String tag);
}
