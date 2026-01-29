/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <sysexits.h>
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
#include "COOLWSD.hpp"
#include "Protocol.hpp"
#include "Util.hpp"

#include "gtk.hpp"

const char *user_name = "Dummy";

const int SHOW_JS_MAXLEN = 300;

int coolwsd_server_socket_fd = -1;

static std::string fileURL;
static COOLWSD *coolwsd = nullptr;
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
    LOG_TRC_NOFILE("Send to JS: " << COOLProtocol::getAbbreviatedMessage(buffer.data(), buffer.size()));

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
            if (ubufp[i] < ' ' || ubufp[i] >= 0x80 || ubufp[i] == '\'' || ubufp[i] == '\\')
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

        js = "window.TheFakeWebSocket.onmessage({'data': '";
        js = js + std::string(data.data(), data.size());
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
#if WEBKIT_CHECK_VERSION(2,40,0) // unclear when this API changed ...
                   webkit_web_view_evaluate_javascript(
                       webView, jscopy, strlen(jscopy),
                       nullptr, nullptr, nullptr,
                       send2JS_ready_callback, jscopy);
#else
                   webkit_web_view_evaluate_javascript(
                       webView, jscopy, nullptr, send2JS_ready_callback, jscopy);
#endif
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

static void handle_cool_message(WebKitUserContentManager *manager,
                                WebKitJavascriptResult   *js_result,
                                gpointer                  user_data)
{
    gchar *string_value = js_result_as_gstring(js_result);

    if (string_value)
    {
        LOG_TRC_NOFILE("From JS: cool: " << string_value);

        if (strcmp(string_value, "HULLO") == 0)
        {
            // Now we know that the JS has started completely

            // Contact the permanently (during app lifetime) listening COOLWSD server
            // "public" socket
            assert(coolwsd_server_socket_fd != -1);
            int rc = fakeSocketConnect(fakeClientFd, coolwsd_server_socket_fd);
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
                            // The code below handling the "BYE" fake Websocket message has closed
                            // the other end of the closeNotificationPipeForForwardingThread. Let's
                            // close the other end too just for cleanliness, even if a FakeSocket as
                            // such is not a system resource so nothing is saved by closing it.
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

            fakeSocketWriteQueue(fakeClientFd, fileURL.c_str(), fileURL.size());
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
            fakeSocketWriteQueue(fakeClientFd, string_value, strlen(string_value));
        }
        g_free(string_value);
    }
    else
        LOG_TRC_NOFILE("From JS: cool: some object");
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

static gboolean enable_inspector(gpointer user_data)
{
    if (false) // Set this to true to try to enable developer console.
    {
        // Attempt to show the inspector
        WebKitWebInspector *inspector = webkit_web_view_get_inspector (WEBKIT_WEB_VIEW(webView));
        const char *url = webkit_web_inspector_get_inspected_uri(inspector);
        LOG_TRC("Inspecting: can attach? " << webkit_web_inspector_get_can_attach(inspector) <<
                " to URL: '" << (url?url:"<null>") << "'");
        webkit_web_inspector_show (WEBKIT_WEB_INSPECTOR(inspector));
    }
    return FALSE; // do it just once.
}

static void disable_a11y()
{
    // reduce test matrix for now
    setenv("WEBKIT_A11Y_BUS_ADDRESS", "", 1);
    setenv("GTK_A11Y","none", 1);
    setenv("NO_AT_BRIDGE", "1", 1);
}

int main(int argc, char* argv[])
{
    if (argc != 2)
    {
        fprintf(stderr, "Usage: %s document\n", argv[0]);
        _exit(1); // avoid log cleanup
    }

    Log::initialize("Mobile", "trace");
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    std::thread([]
    {
        assert(coolwsd == nullptr);
        char *argv[2];
        argv[0] = strdup("mobile");
        argv[1] = nullptr;
        Util::setThreadName("app");
        while (true)
        {
            coolwsd = new COOLWSD();
            coolwsd->run(1, argv);
            delete coolwsd;
            LOG_TRC("One run of COOLWSD completed");
        }
    }).detach();

    fakeClientFd = fakeSocketSocket();

    disable_a11y();

    gtk_init(&argc, &argv);

    GtkWidget *mainWindow = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_default_size(GTK_WINDOW(mainWindow), 720, 1600);
    g_signal_connect(mainWindow, "destroy", G_CALLBACK(gtk_main_quit), nullptr);

    // Not good: https://bugs.webkit.org/show_bug.cgi?id=261874
    if (!strcmp(G_OBJECT_TYPE_NAME(gdk_display_get_default()), "GdkX11Display"))
        setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1", 1);

    webView = WEBKIT_WEB_VIEW(webkit_web_view_new());
    g_object_ref_sink(G_OBJECT(webView));

    WebKitUserContentManager *userContentManager = webkit_web_view_get_user_content_manager(webView);

    g_signal_connect(userContentManager, "script-message-received::debug", G_CALLBACK(handle_debug_message), nullptr);
    g_signal_connect(userContentManager, "script-message-received::cool",  G_CALLBACK(handle_cool_message), nullptr);
    g_signal_connect(userContentManager, "script-message-received::error", G_CALLBACK(handle_error_message), nullptr);

    webkit_user_content_manager_register_script_message_handler(userContentManager, "debug");
    webkit_user_content_manager_register_script_message_handler(userContentManager, "cool");
    webkit_user_content_manager_register_script_message_handler(userContentManager, "error");

    gtk_container_add(GTK_CONTAINER(mainWindow), GTK_WIDGET(webView));
    gtk_widget_set_visible(GTK_WIDGET(webView), TRUE);

    WebKitSettings *settings = webkit_web_view_get_settings(webView);

    // trigger mobile UI with 'Mobile' in plausible user agent.
    webkit_settings_set_user_agent(
        settings, "Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40)"
        "AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1");

    webkit_settings_set_javascript_can_access_clipboard(settings, TRUE);

    webkit_settings_set_enable_write_console_messages_to_stdout(settings, TRUE);
    webkit_settings_set_enable_developer_extras(settings, TRUE);
    g_object_set (G_OBJECT(settings), "enable-developer-extras", TRUE, NULL);

    gtk_widget_grab_focus(GTK_WIDGET(webView));
    gtk_widget_set_visible(GTK_WIDGET(mainWindow), TRUE);

    fileURL = "file://" + FileUtil::realpath(argv[1]);

    std::string urlAndQuery =
        "file://" TOPSRCDIR "/browser/dist/cool.html"
        "?file_path=" + fileURL +
        "&closebutton=1"
        "&permission=edit"
        "&lang=en-US"
        "&userinterfacemode=notebookbar";

    LOG_TRC("Open URL: " << urlAndQuery);

    webkit_web_view_load_uri(webView, urlAndQuery.c_str());

    g_timeout_add(5000 /* ms */, enable_inspector, webView);

    gtk_widget_grab_focus(GTK_WIDGET(webView));
    gtk_widget_show_all(mainWindow);
    gtk_main();

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
