// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <config.h>

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <thread>

#include <Windows.h>
#include <shobjidl.h>
#include <wincrypt.h>
#include "WebView2.h"

#include <wrl.h>
#include <wil/com.h>

#include <Poco/MemoryStream.h>

#include <common/Clipboard.hpp>
#include <common/Log.hpp>
#include <common/MobileApp.hpp>
#include <net/FakeSocket.hpp>
#include <wsd/COOLWSD.hpp>

#include "Resource.h"
#include "windows.hpp"

const char* user_name = nullptr;
int coolwsd_server_socket_fd = -1;
std::string app_installation_path;
std::string app_installation_uri;

static COOLWSD* coolwsd = nullptr;
static int fakeClientFd;
static int closeNotificationPipeForForwardingThread[2];

static std::string document_uri;
static int appDocId;

// The main window class name.
static wchar_t windowClass[] = L"CODA";

// The string that appears in the application's title bar.
static wchar_t windowTitle[] = L"CODA";

static wil::com_ptr<ICoreWebView2Controller> webviewController;

// Pointer to WebView window
static wil::com_ptr<ICoreWebView2> webview;

static const int CODA_WM_EXECUTESCRIPT = WM_APP + 1;

static HWND mainWindow;
static DWORD mainThreadId;

static int generate_new_app_doc_id()
{
    // Start with a random document id to catch code that might assume it to be some fixed value,
    // like 0 or 1. Also make it obvious that this numeric "app doc id", used by the mobile apps and
    // CODA, is not related to the string document ids (usually with several leading zeroes) used in
    // the C++ bits of normal COOL.
    static int appDocId = 42 + (std::time(nullptr) % 100);

    DocumentData::allocate(appDocId);
    return appDocId++;
}

static bool isMessageOfType(const char* message, const std::string& type, int length)
{
    if (length < type.length() + 2)
        return false;
    for (int i = 0; i < type.length(); i++)
        if (message[i] != type[i])
            return false;
    return true;
}

static void send2JS(const char* buffer, int length)
{
    const bool binaryMessage = (isMessageOfType(buffer, "tile:", length) ||
                                isMessageOfType(buffer, "tilecombine:", length) ||
                                isMessageOfType(buffer, "delta:", length) ||
                                isMessageOfType(buffer, "renderfont:", length) ||
                                isMessageOfType(buffer, "rendersearchlist:", length) ||
                                isMessageOfType(buffer, "windowpaint:", length));
    std::string pretext{ binaryMessage
                             ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
                             : "window.TheFakeWebSocket.onmessage({'data': window.b64d('" };
    const std::string posttext{ "')});" };

#if 0
   if (!binaryMessage)
   {
       std::vector<char> sb(length*3 + 10);
       int sbi = 0;

       for (int i = 0; i < (length > 100 ? 100 : length); i++)
       {
           if (buffer[i] >= ' ' && buffer[i] < 127 && buffer[i] != '\\')
           {
               sb[sbi++] = buffer[i];
           }
           else if (buffer[i] == '\\')
           {
               sb[sbi++] = '\\';
               sb[sbi++] = '\\';
           }
           else if (buffer[i] == '\n')
           {

               sb[sbi++] = '\\';
               sb[sbi++] = 'n';
           }
           else
           {
               const char hex[] { "0123456789abcdef" };
               sb[sbi++] = '\\';
               sb[sbi++] = hex[buffer[i] >> 4];
               sb[sbi++] = hex[buffer[i] & 0x0F];
           }
       }
       sb[sbi++] = '\0';
   }
#endif

    DWORD base64len = length * 2 + 100;
    std::vector<char> base64(base64len);
    CryptBinaryToStringA((BYTE*)buffer, length, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF,
                         base64.data(), &base64len);
    base64[base64len] = '\0';

    if (binaryMessage)
        LOG_TRC("To execute in JS: " << pretext << "stuff" << posttext);
    else
    {
        auto s = std::string(buffer, length);
        LOG_TRC("To execute in JS: " << pretext << s << posttext);
    }
    Log::flush();

    char* wparam = _strdup((pretext + std::string(base64.data()) + posttext).c_str());

    PostMessageW(mainWindow, CODA_WM_EXECUTESCRIPT, (WPARAM)wparam, 0);
}

static void do_hullo_handling_things(const char* fileURL, int appDocId)
{
    // FIXME: Code snippet shared with gtk/mobile.cpp, factor out into separate file.

    // Now we know that the JS has started completely

    // Contact the permanently (during app lifetime) listening COOLWSD server "public" socket
    assert(coolwsd_server_socket_fd != -1);
    int rc = fakeSocketConnect(fakeClientFd, coolwsd_server_socket_fd);
    (void)rc;
    assert(rc != -1);

    // Create a socket pair to notify the below thread when the document has been closed
    fakeSocketPipe2(closeNotificationPipeForForwardingThread);

    // Start another thread to read responses and forward them to the JavaScript
    std::thread(
        []
        {
            Log::setThreadLocalLogLevel("trace");
            Util::setThreadName("app2js");
            LOG_ERR("Why does this not show up even as ERR?");
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
                        // The code below handling the "BYE" fake Websocket message has closed the other
                        // end of the closeNotificationPipeForForwardingThread. Let's close the other
                        // end too just for cleanliness, even if a FakeSocket as such is not a system
                        // resource so nothing is saved by closing it.
                        fakeSocketClose(closeNotificationPipeForForwardingThread[1]);

                        // Close our end of the fake socket connection to the ClientSession thread, so
                        // that it terminates.
                        fakeSocketClose(fakeClientFd);

                        return;
                    }
                    if (pollfd[0].revents == POLLIN)
                    {
                        int n = fakeSocketAvailableDataLength(fakeClientFd);
                        // I don't want to check for n being -1 here, even if that will lead to a crash,
                        // as n being -1 is a sign of something being wrong elsewhere anyway, and I
                        // prefer to fix the root cause. Let's see how well this works out.
                        if (n == 0)
                            return;
                        std::vector<char> buf(n);
                        n = fakeSocketRead(fakeClientFd, buf.data(), n);
                        send2JS(buf.data(), n);
                    }
                }
                else
                {
                    break;
                }
            }
            assert(false);
        })
        .detach();

    // First we simply send it the URL. This corresponds to the GET request with Upgrade to
    // WebSocket.
    LOG_TRC_NOFILE("Actually sending to Online:" << fileURL);

    // Must do this in a thread, too, so that we can return to the main loop
    // Must duplicate fileURL as it exists only while this function is called from C#.
    char* fileURLcopy = _strdup(fileURL);
    std::thread(
        [fileURLcopy, appDocId]
        {
            struct pollfd pollfd;
            pollfd.fd = fakeClientFd;
            pollfd.events = POLLOUT;
            fakeSocketPoll(&pollfd, 1, -1);
            std::string message(fileURLcopy + (" " + std::to_string(appDocId)));
            fakeSocketWrite(fakeClientFd, message.c_str(), message.size());
            std::free(fileURLcopy);
        })
        .detach();
}

static void do_bye_handling_things()
{
    LOG_TRC_NOFILE(
        "Document window terminating on JavaScript side. Closing our end of the socket.");

    // Close one end of the socket pair, that will wake up the forwarding thread above
    fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
}

static void do_convert_to(const char* type, int appDocId)
{
    const std::string tempFile = FileUtil::createRandomTmpDir() + "/haha." + std::string(type);
    const std::string tempFileUri = Poco::URI(Poco::Path(tempFile)).toString();

    DocumentData::get(appDocId).loKitDocument->saveAs(tempFileUri.c_str(), type, nullptr);

    // etc
}

static void do_other_message_handling_things(const char* message)
{
    LOG_TRC_NOFILE("Handling other message:'" << message << "'");

    char* message_copy = _strdup(message);
    // As above, must do this in a thread
    std::thread(
        [=]
        {
            struct pollfd pollfd;
            pollfd.fd = fakeClientFd;
            pollfd.events = POLLOUT;
            fakeSocketPoll(&pollfd, 1, -1);
            fakeSocketWrite(fakeClientFd, message_copy, strlen(message_copy));
            std::free(message_copy);
        })
        .detach();
}

static void do_clipboard_write(int appDocId)
{
    size_t count = 0;
    char** mimeTypes = nullptr;
    size_t* sizes = nullptr;
    char** streams = nullptr;

    if (!OpenClipboard(NULL))
        return;

    DocumentData::get(appDocId).loKitDocument->getClipboard(nullptr, &count, &mimeTypes, &sizes,
                                                            &streams);
    for (int i = 0; i < count; i++)
    {
        // We check whether there is a corresponding standard or well-known Windows clipboard
        // format. It is either one using plain "narrow" chars or wide chars.
        int format = 0;
        int wformat = 0;

        if (strcmp(mimeTypes[i], "text/plain;charset=utf-8") == 0)
            wformat = CF_UNICODETEXT;
        else if (strcmp(mimeTypes[i], "text/rtf") == 0)
            format = RegisterClipboardFormatW(L"Rich Text Format");

        if (wformat)
        {
            std::wstring wtext = Util::string_to_wide_string(std::string(streams[i]));
            const int byteSize = wtext.size() * 2 + 2;
            HANDLE hglData = GlobalAlloc(GMEM_MOVEABLE, byteSize);
            if (hglData)
            {
                wchar_t* wcopy = (wchar_t*)GlobalLock(hglData);
                memcpy(wcopy, wtext.c_str(), byteSize - 2);
                wcopy[wtext.size()] = L'\0';
                GlobalUnlock(hglData);
                SetClipboardData(wformat, hglData);
            }
        }
        else if (format)
        {
            HANDLE hglData = GlobalAlloc(GMEM_MOVEABLE, sizes[i] + 1);
            if (hglData)
            {
                char* copy = (char*)GlobalLock(hglData);
                memcpy(copy, streams[i], sizes[i]);
                copy[sizes[i]] = '\0';
                GlobalUnlock(hglData);
                SetClipboardData(format, hglData);
            }
        }
    }
    CloseClipboard();
}

static void do_clipboard_read(int appDocId)
{
    if (!IsClipboardFormatAvailable(CF_UNICODETEXT))
        return;

    if (!OpenClipboard(NULL))
        return;

    HANDLE hglData = GetClipboardData(CF_UNICODETEXT);
    if (!hglData)
    {
        CloseClipboard();
        return;
    }
    wchar_t* wtext = (wchar_t*)GlobalLock(hglData);
    if (!wtext)
    {
        GlobalUnlock(hglData);
        CloseClipboard();
        return;
    }

    std::string text = Util::wide_string_to_string(std::wstring(wtext));
    GlobalUnlock(hglData);
    CloseClipboard();

    const char* mimeTypes[]{ "text/plain;charset=utf-8" };
    const size_t sizes[]{ text.size() };
    const char* streams[]{ text.c_str() };
    DocumentData::get(appDocId).loKitDocument->setClipboard(1, mimeTypes, sizes, streams);
}

static void do_clipboard_set(int appDocId, const char* text)
{
    size_t nData;
    std::vector<size_t> sizes;
    std::vector<const char*> mimeTypes;
    std::vector<const char*> streams;
    ClipboardData data;

    if (memcmp(text, "<!DOCTYPE html>", 15) == 0)
    {
        nData = 1;
        sizes.resize(1);
        sizes[0] = strlen(text);
        mimeTypes.resize(1);
        mimeTypes[0] = "text/html";
        streams.resize(1);
        streams[0] = text;
    }
    else
    {
        Poco::MemoryInputStream stream(text, strlen(text));
        data.read(stream);

        nData = data.size();
        sizes.resize(nData);
        mimeTypes.resize(nData);
        streams.resize(nData);

        for (size_t i = 0; i < nData; ++i)
        {
            sizes[i] = data._content[i].length();
            streams[i] = data._content[i].c_str();
            mimeTypes[i] = data._mimeTypes[i].c_str();
        }
    }

    DocumentData::get(appDocId).loKitDocument->setClipboard(nData, mimeTypes.data(), sizes.data(),
                                                            streams.data());
}

static void fileOpenDialog()
{
    IFileOpenDialog* dialog;

    if (!SUCCEEDED(CoCreateInstance(CLSID_FileOpenDialog, NULL, CLSCTX_ALL, IID_IFileOpenDialog,
                                    reinterpret_cast<void**>(&dialog))))
        std::abort();

    COMDLG_FILTERSPEC filter[] = { { L"Text documents", L"*.odt;*.docx;*.doc;*.rtf;*.txt" },
                                   { L"Spreadsheets", L"*.ods;*.xlsx;*.xls" },
                                   { L"Presentations", L"*.odp;*.pptx;*.ppt" },
                                   { L"All files", L"*.*" } };

    if (!SUCCEEDED(dialog->SetFileTypes(sizeof(filter) / sizeof(filter[0]), &filter[0])))
        std::abort();

    if (!SUCCEEDED(dialog->SetTitle(L"Select document to edit")))
        std::abort();

    if (!SUCCEEDED(dialog->Show(NULL)))
        std::abort();

    IShellItem* item;
    if (!SUCCEEDED(dialog->GetResult(&item)))
        std::abort();

    PWSTR path;
    if (!SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)))
        std::abort();

    document_uri =
        Poco::URI(Poco::Path(Util::wide_string_to_string(std::wstring(path)))).toString();

    CoTaskMemFree(path);
    item->Release();
    dialog->Release();
}

static LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
        case WM_SIZE:
            if (webviewController != nullptr)
            {
                RECT bounds;
                GetClientRect(hWnd, &bounds);
                webviewController->put_Bounds(bounds);
            };
            break;
        case WM_DESTROY:
            PostQuitMessage(0);
            break;
        case CODA_WM_EXECUTESCRIPT:
            webview->ExecuteScript(
                Util::string_to_wide_string(std::string((char*)wParam)).c_str(),
                Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
                    [](HRESULT errorCode, LPCWSTR resultObjectAsJson) -> HRESULT
                    {
                        // LOG_TRC(Util::wide_string_to_string(resultObjectAsJson));
                        return S_OK;
                    })
                    .Get());
            // std::free((char*) wParam);
            break;

        default:
            return DefWindowProc(hWnd, message, wParam, lParam);
            break;
    }

    return 0;
}

static void processMessage(const wil::unique_cotaskmem_string& message)
{
    std::wstring s(message.get());
    fprintf(stderr, "%S\n", s.c_str());
    if (s.starts_with(L"MSG "))
    {
        s = s.substr(4);
        if (s == L"HULLO")
        {
            // FIXME hard-coded document
            do_hullo_handling_things(document_uri.c_str(), appDocId);
        }
        else if (s == L"BYE")
        {
            do_bye_handling_things();
        }
        else if (s == L"PRINT")
        {
            do_convert_to("pdf", appDocId);
        }
        else if (s == L"CLIPBOARDWRITE")
        {
            do_clipboard_write(appDocId);
        }
        else if (s == L"CLIPBOARDREAD")
        {
            do_clipboard_read(appDocId);
        }
        else if (s.starts_with(L"CLIPBOARDSET "))
        {
            do_clipboard_set(appDocId, Util::wide_string_to_string(s.substr(13)).c_str());
        }
        else if (s.starts_with(L"downloadas "))
        {
            fprintf(stderr, "Not yet implemented: Save As");
        }
        else
        {
            do_other_message_handling_things(Util::wide_string_to_string(s).c_str());
        }
    }
}

int APIENTRY wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR, int showWindowMode)
{
    mainThreadId = GetCurrentThreadId();

    Log::initialize("CODA", "trace");
    Util::setThreadName("main");

    LOG_TRC("This is TRC");

    if (!SUCCEEDED(CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE)))
        std::abort();

    if (__argc == 1)
        fileOpenDialog();
    else
        document_uri = Poco::URI(Poco::Path(Util::wide_string_to_string(__wargv[1]))).toString();

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    std::thread(
        []
        {
            assert(coolwsd == nullptr);
            char* argv[2];
            // Yes, strdup() is apparently not standard, so MS wants you to call it as
            // _strdup(), and warns if you call strdup(). Sure, we could just silence such
            // warnings, but let's try to do as they want.
            argv[0] = _strdup("mobile");
            argv[1] = nullptr;
            Log::setThreadLocalLogLevel("trace");
            Util::setThreadName("app");
            LOG_TRC("TRC from main");
            while (true)
            {
                coolwsd = new COOLWSD();
                coolwsd->run(1, argv);
                delete coolwsd;
                LOG_TRC("One run of COOLWSD completed");
            }
        })
        .detach();

    fakeClientFd = fakeSocketSocket();
    appDocId = generate_new_app_doc_id();

    wchar_t fileName[1000];
    GetModuleFileNameW(NULL, fileName, sizeof(fileName) / sizeof(fileName[0]));
    app_installation_path = Util::wide_string_to_string(std::wstring(fileName));
    app_installation_path.resize(app_installation_path.find_last_of(L'\\') + 1);
    app_installation_uri = Poco::URI(Poco::Path(app_installation_path)).toString();

    WNDCLASSEXW wcex;

    wcex.cbSize = sizeof(WNDCLASSEXW);
    wcex.style = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc = WndProc;
    wcex.cbClsExtra = 0;
    wcex.cbWndExtra = 0;
    wcex.hInstance = hInstance;
    wcex.hIcon = LoadIcon(hInstance, IDI_APPLICATION);
    wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
    wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wcex.lpszMenuName = NULL;
    wcex.lpszClassName = windowClass;
    wcex.hIconSm = LoadIcon(wcex.hInstance, IDI_APPLICATION);

    if (!RegisterClassExW(&wcex))
    {
        MessageBoxW(NULL, L"Call to RegisterClassEWx failed", L"CODA", NULL);

        return 1;
    }

    // The parameters to CreateWindow explained:
    // szWindowClass: the name of the application
    // szTitle: the text that appears in the title bar
    // WS_OVERLAPPEDWINDOW: the type of window to create
    // CW_USEDEFAULT, CW_USEDEFAULT: initial position (x, y)
    // 500, 100: initial size (width, length)
    // NULL: the parent of this window
    // NULL: this application does not have a menu bar
    // hInstance: the first parameter from WinMain
    // NULL: not used in this application
    HWND hWnd = CreateWindowW(windowClass, windowTitle, WS_OVERLAPPEDWINDOW, CW_USEDEFAULT,
                              CW_USEDEFAULT, 1200, 900, NULL, NULL, hInstance, NULL);

    mainWindow = hWnd;
    ShowWindow(hWnd, showWindowMode);
    UpdateWindow(hWnd);

    CreateCoreWebView2EnvironmentWithOptions(
        nullptr, nullptr, nullptr,
        Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWnd](HRESULT result, ICoreWebView2Environment* env) -> HRESULT
            {
                // Create a CoreWebView2Controller and get the associated CoreWebView2 whose parent is the main window hWnd
                env->CreateCoreWebView2Controller(
                    hWnd,
                    Microsoft::WRL::Callback<
                        ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [hWnd](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT
                        {
                            if (controller)
                            {
                                webviewController = controller;
                                webviewController->get_CoreWebView2(&webview);
                            }

                            // Add a few settings for the webview
                            // The demo step is redundant since the values are the default settings
                            wil::com_ptr<ICoreWebView2Settings> settings;
                            webview->get_Settings(&settings);
                            settings->put_IsScriptEnabled(TRUE);
                            settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                            settings->put_IsWebMessageEnabled(TRUE);

                            // Resize WebView to fit the bounds of the parent window
                            RECT bounds;
                            GetClientRect(hWnd, &bounds);
                            webviewController->put_Bounds(bounds);

                            EventRegistrationToken token;

                            // Communication between host and web content
                            // Set an event handler for the host to return received message back to the web content
                            webview->add_WebMessageReceived(
                                Microsoft::WRL::Callback<
                                    ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2* webview,
                                       ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT
                                    {
                                        wil::unique_cotaskmem_string message;
                                        args->TryGetWebMessageAsString(&message);
                                        processMessage(message);
                                        return S_OK;
                                    })
                                    .Get(),
                                &token);

                            const std::string coolURL = app_installation_uri +
                                                        std::string("cool/cool.html?file_path=") +
                                                        // FIXME hard-coded document
                                                        document_uri +
                                                        std::string("&permission=edit"
                                                                    "&lang=en-US"
                                                                    "&appdocid=") +
                                                        std::to_string(appDocId) +
                                                        std::string("&userinterfacemode=notebookbar"
                                                                    "&dir=ltr");

                            webview->Navigate(Util::string_to_wide_string(coolURL).c_str());

                            return S_OK;
                        })
                        .Get());
                return S_OK;
            })
            .Get());

    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return (int)msg.wParam;
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
