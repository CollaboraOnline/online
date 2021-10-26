/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cstdlib>
#include <cstring>
#include <iostream>
#include <thread>
#include <string.h>

#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#if !WEBKIT_CHECK_VERSION(2,22,0)
#  include<JavaScriptCore/JavaScript.h>
#endif

#include "FakeSocket.hpp"
#include "Log.hpp"
#include "LOOLWSD.hpp"
#include "Protocol.hpp"
#include "Util.hpp"

const int SHOW_JS_MAXLEN = 70;

int loolwsd_server_socket_fd = -1;

static std::string fileURL;
static LOOLWSD *loolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2];
static WebKitWebView *webView;

static void send2JS_ready_callback(GObject      *source_object,
                                   GAsyncResult *res,
                                   gpointer      user_data)
{
    free(user_data);
}

static void send2JS(const std::vector<char>& buffer)
{
    LOG_TRC_NOFILE("Send to JS: " << LOOLProtocol::getAbbreviatedMessage(buffer.data(), buffer.size()));

    std::string js;

    // Check if the message is binary. We say that any message that isn't just a single line is
    // "binary" even if that strictly speaking isn't the case; for instance the commandvalues:
    // message has a long bunch of non-binary JSON on multiple lines. But _onMessage() in Socket.js
    // handles it fine even if such a message, too, comes in as an ArrayBuffer. (Look for the
    // "textMsg = String.fromCharCode.apply(null, imgBytes);".)

    const char *newline = (const char *)memchr(buffer.data(), '\n', buffer.size());
    if (newline != nullptr)
    {
        // The data needs to be an ArrayBuffer
        js = "window.TheFakeWebSocket.onmessage({'data': Base64ToArrayBuffer('";
        gchar *base64 = g_base64_encode((const guchar*)buffer.data(), buffer.size());
        js = js + std::string(base64);
        g_free(base64);
        js = js + "')});";
    }
    else
    {
        const unsigned char *ubufp = (const unsigned char *)buffer.data();
        std::vector<char> data;
        for (int i = 0; i < buffer.size(); i++)
        {
            if (ubufp[i] < ' ' || ubufp[i] == '\'' || ubufp[i] == '\\')
            {
                data.push_back('\\');
                data.push_back('x');
                data.push_back("0123456789abcdef"[(ubufp[i] >> 4) & 0x0F]);
                data.push_back("0123456789abcdef"[ubufp[i] & 0x0F]);
            }
            else
            {
                data.push_back(ubufp[i]);
            }
        }
        data.push_back(0);

        js = "window.TheFakeWebSocket.onmessage({'data': '";
        js = js + std::string(buffer.data(), buffer.size());
        js = js + "'});";
    }

    std::string subjs = js.substr(0, std::min(std::string::size_type(SHOW_JS_MAXLEN), js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";

    LOG_TRC_NOFILE( "Evaluating JavaScript: " << subjs);

    char *jscopy = strdup(js.c_str());
    g_idle_add([](gpointer data)
               {
                   char *jscopy = (char*) data;
                   webkit_web_view_run_javascript(webView, jscopy, nullptr, send2JS_ready_callback, jscopy);
                   return FALSE;
               }, jscopy);
}

static char *js_result_as_gstring(WebKitJavascriptResult *js_result)
{
#if WEBKIT_CHECK_VERSION(2,22,0) // unclear when this API changed ...
    JSCValue *value = webkit_javascript_result_get_js_value(js_result);
    if (jsc_value_is_string(value))
        return jsc_value_to_string(value);
    else
        return nullptr;
#else // older Webkits
    JSValueRef value = webkit_javascript_result_get_value(js_result);
    JSContextRef ctx = webkit_javascript_result_get_global_context(js_result);
    if (JSValueIsString(ctx, value))
    {
        const JSStringRef js_str = JSValueToStringCopy(ctx, value, nullptr);
        size_t gstring_max = JSStringGetMaximumUTF8CStringSize(js_str);
        char *gstring = (char *)g_malloc(gstring_max);
        if (gstring)
            JSStringGetUTF8CString(js_str, gstring, gstring_max);
        else
            LOG_TRC_NOFILE("No string");
        JSStringRelease(js_str);
        return gstring;
    }
    else
        LOG_TRC_NOFILE("Unexpected object type " << JSValueGetType(ctx, value));
    return nullptr;
#endif
}

static void handle_message(const char * type, WebKitJavascriptResult *js_result)
{
    gchar *string_value = js_result_as_gstring(js_result);

    if (string_value)
        LOG_TRC_NOFILE("From JS: " << type << ": " << string_value);
    else
        LOG_TRC_NOFILE("From JS: " << type << ": some object");

    g_free(string_value);
}

static void handle_lool_message(WebKitUserContentManager *manager,
                                WebKitJavascriptResult   *js_result,
                                gpointer                  user_data)
{
    gchar *string_value = js_result_as_gstring(js_result);

    if (string_value)
    {
        LOG_TRC_NOFILE("From JS: lool: " << string_value);

        if (strcmp(string_value, "HULLO") == 0)
        {
            // Now we know that the JS has started completely

            // Contact the permanently (during app lifetime) listening LOOLWSD server
            // "public" socket
            assert(loolwsd_server_socket_fd != -1);
            int rc = fakeSocketConnect(fakeClientFd, loolwsd_server_socket_fd);
            assert(rc != -1);

            // Create a socket pair to notify the below thread when the document has been closed
            fakeSocketPipe2(closeNotificationPipeForForwardingThread);

            // Start another thread to read responses and forward them to the JavaScript
            std::thread([]
                        {
                            Util::setThreadName("app2js");
                            while (true)
                            {
                               struct pollfd pollfd[2];
                               pollfd[0].fd = fakeClientFd;
                               pollfd[0].events = POLLIN;
                               pollfd[1].fd = closeNotificationPipeForForwardingThread[1];
                               pollfd[1].events = POLLIN;
                               if (fakeSocketPoll(pollfd, 2, -1) > 0)
                               {
                                   if (pollfd[1].revents == POLLIN)
                                   {
                                       // The code below handling the "BYE" fake Websocket
                                       // message has closed the other end of the
                                       // closeNotificationPipeForForwardingThread. Let's close
                                       // the other end too just for cleanliness, even if a
                                       // FakeSocket as such is not a system resource so nothing
                                       // is saved by closing it.
                                       fakeSocketClose(closeNotificationPipeForForwardingThread[1]);

                                       // Close our end of the fake socket connection to the
                                       // ClientSession thread, so that it terminates
                                       fakeSocketClose(fakeClientFd);

                                       return;
                                   }
                                   if (pollfd[0].revents == POLLIN)
                                   {
                                       int n = fakeSocketAvailableDataLength(fakeClientFd);
                                       if (n == 0)
                                           return;
                                       std::vector<char> buf(n);
                                       n = fakeSocketRead(fakeClientFd, buf.data(), n);
                                       send2JS(buf);
                                   }
                               }
                               else
                                   break;
                           }
                           assert(false);
                        }).detach();

            // First we simply send it the URL. This corresponds to the GET request with Upgrade to
            // WebSocket.
            LOG_TRC_NOFILE("Actually sending to Online:" << fileURL);

            // Must do this in a thread, too, so that we can return to the GTK+ main loop
            std::thread([]
                        {
                            struct pollfd pollfd;
                            pollfd.fd = fakeClientFd;
                            pollfd.events = POLLOUT;
                            fakeSocketPoll(&pollfd, 1, -1);
                            fakeSocketWrite(fakeClientFd, fileURL.c_str(), fileURL.size());
                        }).detach();
        }
        else if (strcmp(string_value, "BYE") == 0)
        {
            LOG_TRC_NOFILE("Document window terminating on JavaScript side. Closing our end of the socket.");

            // Close one end of the socket pair, that will wake up the forwarding thread above
            fakeSocketClose(closeNotificationPipeForForwardingThread[0]);

            // ???
        }
        else
        {
            // As above
            char *string_copy = strdup(string_value);
            std::thread([=]
                        {
                            struct pollfd pollfd;
                            pollfd.fd = fakeClientFd;
                            pollfd.events = POLLOUT;
                            fakeSocketPoll(&pollfd, 1, -1);
                            fakeSocketWrite(fakeClientFd, string_copy, strlen(string_copy));
                            free(string_copy);
                        }).detach();
        }
        g_free(string_value);
    }
    else
        LOG_TRC_NOFILE("From JS: lool: some object");
}

static void handle_debug_message(WebKitUserContentManager *manager,
                                 WebKitJavascriptResult   *js_result,
                                 gpointer                  user_data)
{
    handle_message("debug", js_result);
}

static void handle_error_message(WebKitUserContentManager *manager,
                                 WebKitJavascriptResult   *js_result,
                                 gpointer                  user_data)
{
    handle_message("error", js_result);
}

int main(int argc, char* argv[])
{
    if (argc != 2)
    {
        fprintf(stderr, "Usage: %s document\n", argv[0]);
        _exit(1); // avoid log cleanup
    }

    Log::initialize("Mobile", "trace", false, false, {});
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    std::thread([]
                {
                    assert(loolwsd == nullptr);
                    char *argv[2];
                    argv[0] = strdup("mobile");
                    argv[1] = nullptr;
                    Util::setThreadName("app");
                    while (true)
                    {
                        loolwsd = new LOOLWSD();
                        loolwsd->run(1, argv);
                        delete loolwsd;
                        LOG_TRC("One run of LOOLWSD completed");
                    }
                }).detach();

    fakeClientFd = fakeSocketSocket();

    gtk_init(&argc, &argv);

    GtkWidget *mainWindow = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_default_size(GTK_WINDOW(mainWindow), 1000, 800);
    g_signal_connect(mainWindow, "destroy", G_CALLBACK(gtk_main_quit), nullptr);

    WebKitUserContentManager *userContentManager = WEBKIT_USER_CONTENT_MANAGER(webkit_user_content_manager_new());

    g_signal_connect(userContentManager, "script-message-received::debug", G_CALLBACK(handle_debug_message), nullptr);
    g_signal_connect(userContentManager, "script-message-received::lool",  G_CALLBACK(handle_lool_message), nullptr);
    g_signal_connect(userContentManager, "script-message-received::error", G_CALLBACK(handle_error_message), nullptr);

    webkit_user_content_manager_register_script_message_handler(userContentManager, "debug");
    webkit_user_content_manager_register_script_message_handler(userContentManager, "lool");
    webkit_user_content_manager_register_script_message_handler(userContentManager, "error");

    webView = WEBKIT_WEB_VIEW(webkit_web_view_new_with_user_content_manager(userContentManager));

    gtk_container_add(GTK_CONTAINER(mainWindow), GTK_WIDGET(webView));

    fileURL = "file://" + FileUtil::realpath(argv[1]);

    std::string urlAndQuery =
        "file://" TOPSRCDIR "/loleaflet/dist/cool.html"
        "?file_path=" + fileURL +
        "&closebutton=1"
        "&permission=edit"
        "&debug=true";

    webkit_web_view_load_uri(webView, urlAndQuery.c_str());

    gtk_widget_grab_focus(GTK_WIDGET(webView));
    gtk_widget_show_all(mainWindow);
    gtk_main();

    return 0;
}
