// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <config.h>

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <map>
#include <regex>
#include <thread>
#include <vector>

#include <Windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shobjidl.h>
#include <shobjidl_core.h>

#include <wincrypt.h>

#include "WebView2.h"

#include <wrl.h>
#include <wil/com.h>

#include <Poco/MemoryStream.h>

#include "litecask.h"

#include <common/Clipboard.hpp>
#include <common/Protocol.hpp>
#include <common/Log.hpp>
#include <common/MobileApp.hpp>
#include <common/StringVector.hpp>
#include <net/FakeSocket.hpp>
#include <wsd/COOLWSD.hpp>

#include "Resource.h"
#include "windows.hpp"

// Note that all pathnames in this code that are plain narrow strings (std::string) are in UTF-8 and
// can thus *not* be used for actual file system operations. They must always be converted to UTF-16
// first with Util::string_to_wide_string(). URIs one the other hand are valid as such as narrow
// strings.

enum class ClipboardOp
{
    CUT,
    COPY,
    PASTE,
    PASTEUNFORMATTED,
    READ
};

struct FilenameAndUri
{
    // Just the basename (and extension), without folder
    std::string filename;

    // Complete file: URI
    std::string uri;
};

struct OpenDialogResult
{
    bool createdNew;
    std::vector<FilenameAndUri> filenamesAndUris;
};

// Use enum class to automatically get non-overlapping values. On the other hand, then we need to
// cast the values to the underlying type when using them.
enum class CODA_OPEN_CONTROL : DWORD
{
    SEP1,
    NEW_TEXT,
    NEW_SPREADSHEET,
    NEW_PRESENTATION,
    SEP2
};

enum class PERMISSION { EDIT, NEW_DOCUMENT, READONLY, VIEW, WELCOME };

// Various document window speficic data
struct WindowData
{
    HWND hWnd;
    HWND hConsoleWnd = 0;
    HWND hParentWnd = 0;
    int numMonitors = 0;
    RECT originalRect;
    LONG originalStyle;
    POINT previousSize; // After a WM_SIZE
    bool isFullScreen = false;
    bool isConsole = false;
    int fakeClientFd;
    int closeNotificationPipeForForwardingThread[2];
    FilenameAndUri filenameAndUri;
    PERMISSION permission;
    int appDocId;
    DWORD lastOwnClipboardModification;
    DWORD lastAnyonesClipboardModification;
    wil::com_ptr<ICoreWebView2Controller> webViewController;
    wil::com_ptr<ICoreWebView2> webView;
};

struct PersistedDocumentWindowSize
{
    POINT size;
    WPARAM resizeType;
};

static std::map<HWND, WindowData> windowData;

static HINSTANCE appInstance;
static int appShowMode;

const char* user_name = nullptr;
int coolwsd_server_socket_fd = -1;

static std::string app_exe_path;
std::string app_installation_path;

std::string app_installation_uri;

std::string localAppData;

static std::string uiLanguage = "en-US";
static std::wstring appName;

static COOLWSD* coolwsd = nullptr;

static std::thread coolwsdThread;

// The main window class name.
static const wchar_t windowClass[] = L"CODA";

// The file open dialog dummy owner window class name.
static const wchar_t dummyWindowClass[] = L"CODADummyFileDialogOwnerWindow";
// The handle of that dummy window.
static HWND hiddenOwnerWindow;

static const int CODA_WM_EXECUTESCRIPT = WM_APP + 1;
static const int CODA_WM_LOADNEXTDOCUMENT = WM_APP + 2;

constexpr int CODA_GROUP_OPEN = 1000;

constexpr int CODA_OPEN_DIALOG_CREATE_NEW_INSTEAD = 123456;

// Ugly to use globals like this
static std::wstring new_document_created;
static HMONITOR monitor_of_dialog;

// Map from IFileDialogCustomize pointer to the corresponding IFileDialog, so that we can close it prematurely
static std::map<IFileDialogCustomize*, IFileDialog*> customisationToDialog;

static litecask::Datastore persistentWindowSizeStore;
static bool persistentWindowSizeStoreOK;

static FilenameAndUri fileSaveDialog(const std::string& name, const std::string& folder, const std::string& extension);

static std::wstring new_document(CODA_OPEN_CONTROL id);
static void openCOOLWindow(const FilenameAndUri& filenameAndUri, PERMISSION permission);

// Vector of documents to open passed on the command line, or multiple documents to open selected in
// a file open dialog. We open the next one only as soon as the previous one has finished loading.
static std::vector<FilenameAndUri> filenamesAndUrisToOpen;
static int currentFileToOpenIndex;

// Temporary l10n function for the few UI strings here in this file
static const wchar_t* _(const wchar_t* english)
{
    static std::map<std::wstring, std::map<std::string, const wchar_t*>> translations
        {
            {
                L"Create new",
                {
                    { "ar", L"أنشيء جديدًا" },
                    { "cs", L"Vytvořit nový" },
                    { "da", L"Opret ny" },
                    { "de", L"Neu erstellen" },
                    { "el", L"Δημιουργία νέου" },
                    { "es", L"Crear nuevo" },
                    { "fr", L"Créer un nouveau" },
                    { "he", L"יצירת חדש" },
                    { "hu", L"Új létrehozása" },
                    { "is", L"Búa til nýtt" },
                    { "it", L"Crea nuovo" },
                    { "ja", L"新規作成" },
                    { "ko", L"새로 만들기" },
                    { "nb", L"Opprett nytt" },
                    { "nl", L"Nieuw" },
                    { "nn", L"Opprett nytt" },
                    { "pl", L"Utwórz nowy" },
                    { "pt", L"Criar novo" },
                    { "ru", L"Создать новый" },
                    { "sk", L"Vytvoriť nový" },
                    { "sl", L"Ustvari novo" },
                    { "sv", L"Skapa nytt" },
                    { "tr", L"Yeni oluştur" },
                    { "uk", L"Створити новий" },
                    { "zh-CN", L"新建" },
                    { "zh-TW", L"新建" },
                }
            },
            {
                L"Text document",
                {
                    { "ar", L"مستند نصي" },
                    { "cs", L"Textový dokument" },
                    { "da", L"Textdokument" },
                    { "de", L"Textdokument" },
                    { "el", L"Έγγραφο κειμένου" },
                    { "es", L"Documento de texto" },
                    { "fr", L"Texte" },
                    { "he", L"מסמך טקסט" },
                    { "hu", L"Szöveges dokumentum" },
                    { "is", L"Textaskjal" },
                    { "it", L"Documento di testo" },
                    { "ja", L"文書ドキュメント" },
                    { "ko", L"텍스트 문서" },
                    { "nb", L"Tekstdokument" },
                    { "nl", L"Tekstdocument" },
                    { "nn", L"Tekstdokument" },
                    { "pl", L"Dokument tekstowy" },
                    { "pt", L"Documento de texto" },
                    { "ru", L"Текстовый документ" },
                    { "sk", L"Textový dokument" },
                    { "sl", L"Dokument z besedilom" },
                    { "sv", L"Textdokument" },
                    { "tr", L"Metin Belgesi" },
                    { "uk", L"Текстовий документ" },
                    { "zh-CN", L"文本文档" },
                    { "zh-TW", L"文字文件" },
                }
            },
            {
                L"Spreadsheet",
                {
                    { "ar", L"جدول مُمتد" },
                    { "cs", L"Sešit" },
                    { "da", L"Regneark" },
                    { "de", L"Tabellendokument" },
                    { "el", L"Υπολογιστικό φύλλο" },
                    { "es", L"Hoja de cálculo" },
                    { "fr", L"Classeur" },
                    { "he", L"גיליון אלקטרוני" },
                    { "hu", L"Munkafüzet" },
                    { "is", L"Töflureiknir" },
                    { "it", L"Foglio elettronico" },
                    { "ja", L"表計算ドキュメント" },
                    { "ko", L"스프레드시트" },
                    { "nb", L"Regneark" },
                    { "nl", L"Werkblad" },
                    { "nn", L"Rekneark" },
                    { "pl", L"Arkusz kalkulacyjny" },
                    { "pt", L"Folha de cálculo" },
                    { "ru", L"Электронная таблица" },
                    { "sk", L"Tabuľkový dokument" },
                    { "sl", L"Preglednica" },
                    { "sv", L"Kalkylark" },
                    { "tr", L"Hesap Tablosu" },
                    { "uk", L"Електронна таблиця" },
                    { "zh-CN", L"电子表格" },
                    { "zh-TW", L"試算表" },
                }
            },
            {
                L"Presentation",
                {
                    { "ar", L"عرض تقديمي" },
                    { "cs", L"Prezentace" },
                    { "da", L"Præsentation" },
                    { "de", L"Präsentation" },
                    { "el", L"Παρουσίαση" },
                    { "es", L"Presentación" },
                    { "fr", L"Présentation" },
                    { "he", L"מצגתי" },
                    { "hu", L"Bemutató" },
                    { "is", L"Kynning" },
                    { "it", L"Presentazione" },
                    { "ja", L"プレゼンテーション" },
                    { "ko", L"프레젠테이션" },
                    { "nb", L"Presentasjon" },
                    { "nl", L"Presentatie" },
                    { "nn", L"Presentasjon" },
                    { "pl", L"Prezentacja" },
                    { "pt", L"Apresentação" },
                    { "ru", L"Презентация" },
                    { "sk", L"Prezentácia" },
                    { "sl", L"Predstavitev" },
                    { "sv", L"Presentation" },
                    { "tr", L"Sunu" },
                    { "uk", L"Презентація" },
                    { "zh-CN", L"演示文稿" },
                    { "zh-TW", L"簡報" },
                }
            },
            {
                // Most translations missing here
                L"Select document to edit in %s",
                {
                    { "cs", L"Vyberte dokument k úpravám v %s" },
                    { "de", L"Dokument zur Bearbeitung in %s auswählen" },
                    { "es", L"Seleccione el documento para editar en %s" },
                    { "hu", L"Válassza ki a %s-ban szerkesztendő dokumentumot" },
                    { "ja", L"%sで編集する文書を選択" },
                    { "pl", L"Wybierz dokument do edycji w %s" },
                    { "pt", L"Selecione o documento a editar no %s" },
                    { "pt-BR", L"Selecione o documento para editar no %s" },
                    { "ru", L"Выберите документ для редактирования в %s" },
                    { "sv", L"Välj dolkument att redigera i %s" },
                    { "tr", L"%s ile düzenlemek için belgeyi seçiniz" },
                    { "zh-CN", L"选择要在 %s 中编辑的文档" },
                    { "zh-TW", L"選擇要在 %s 中編輯的文檔" },
                },
            },
            {
                // Some translations missing here
                L"Normal files",
                {
                    { "cs", L"Normální soubory" },
                    { "da", L"Almindelige filer" },
                    { "de", L"Normale Dateien" },
                    { "el", L"Κανονικά αρχεία" },
                    { "es", L"Archivos normales" },
                    { "fr", L"Fichiers normaux" },
                    { "hu", L"Normál fájlok" },
                    { "it", L"File normali" },
                    { "nb", L"Normale filer" },
                    { "nl", L"Normale bestanden" },
                    { "nn", L"Normale filer" },
                    { "pl", L"Pliki normalne" },
                    { "pt", L"Ficheiros normais" },
                    { "ru", L"Обычные файлы" },
                    { "sl", L"Navadne datoteke" },
                    { "sv", L"Vanliga filer" },
                    { "tr", L"Normal dosyalar" },
                    { "uk", L"Звичайні файли" },
                    { "zh", L"普通文件" },
                },
            },
            {
                L"All files",
                {
                    { "ar", L"كلّ الملفّات" },
                    { "cs", L"Všechny soubory" },
                    { "da", L"Alle filer" },
                    { "de", L"Alle Dateien" },
                    { "el", L"Όλα τα αρχεία" },
                    { "es", L"Todos los archivos" },
                    { "fr", L"Tous les fichiers" },
                    { "he", L"כל הקבצים" },
                    { "hu", L"Minden fájl" },
                    { "is", L"Allar skrár" },
                    { "it", L"Tutti i file" },
                    { "ja", L"すべてのファイル" },
                    { "ko", L"모든 파일" },
                    { "nb", L"Alle filer" },
                    { "nl", L"Alle bestanden" },
                    { "nn", L"Alle filer" },
                    { "pl", L"Wszystkie pliki" },
                    { "pt", L"Todos os ficheiros" },
                    { "ru", L"Все файлы" },
                    { "sk", L"Všetky súbory" },
                    { "sl", L"Vse datoteke" },
                    { "sv", L"Alla filer" },
                    { "tr", L"Tüm dosyalar" },
                    { "uk", L"Усі файли" },
                    { "zh-CN", L"所有文件" },
                    { "zh-TW", L"所有檔案" },
                },
            },
        };

    std::wstring e = english;
    if (translations.count(e) == 1)
    {
        if (translations[e].count(uiLanguage) == 1)
        {
            return translations[e][uiLanguage];
        }
        else
        {
            auto dash = uiLanguage.find('-');
            if (dash != std::string::npos)
            {
                auto justLanguage = uiLanguage.substr(0, dash);
                if (translations[e].count(justLanguage) == 1)
                    return translations[e][justLanguage];
            }
        }
    }

    return english;
}

void load_next_document()
{
    // Open the next document from the command line, if any. Post a message to one randomly selected
    // document window.
    if (currentFileToOpenIndex < filenamesAndUrisToOpen.size() - 1)
        PostMessageW(windowData.begin()->second.hWnd, CODA_WM_LOADNEXTDOCUMENT, 0, 0);
}

// ================ Sample code (MIT licensed). With app-specific modifications in the dialog event handler.
// https://github.com/microsoft/Windows-classic-samples/blob/2b94df5730177ec27e726b60017c01c97ef1a8fb/Samples/Win7Samples/winui/shell/appplatform/commonfiledialog/CommonFileDialogApp.cpp

/* File Dialog Event Handler *****************************************************************************************************/

class CDialogEventHandler : public IFileDialogEvents, public IFileDialogControlEvents
{
public:
    // IUnknown methods
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv)
    {
        static const QITAB qit[] = {
            QITABENT(CDialogEventHandler, IFileDialogEvents),
            QITABENT(CDialogEventHandler, IFileDialogControlEvents),
            { 0 },
        };
        return QISearch(this, qit, riid, ppv);
    }

    IFACEMETHODIMP_(ULONG) AddRef() { return InterlockedIncrement(&_cRef); }

    IFACEMETHODIMP_(ULONG) Release()
    {
        long cRef = InterlockedDecrement(&_cRef);
        if (!cRef)
            delete this;
        return cRef;
    }

    // IFileDialogEvents methods
    IFACEMETHODIMP OnFileOk(IFileDialog* pFD)
    {
        IOleWindow* pOleWindow;
        if (SUCCEEDED(pFD->QueryInterface(IID_PPV_ARGS(&pOleWindow))))
        {
            HWND hDialogWindow;
            pOleWindow->GetWindow(&hDialogWindow);
            monitor_of_dialog = MonitorFromWindow(hDialogWindow, MONITOR_DEFAULTTONEAREST);
        }
        else
            monitor_of_dialog = NULL;
        return S_OK;
    };

    // The rest are dummies
    IFACEMETHODIMP OnFolderChange(IFileDialog*) { return S_OK; };
    IFACEMETHODIMP OnFolderChanging(IFileDialog*, IShellItem*) { return S_OK; };
    IFACEMETHODIMP OnHelp(IFileDialog*) { return S_OK; };
    IFACEMETHODIMP OnSelectionChange(IFileDialog*) { return S_OK; };
    IFACEMETHODIMP OnShareViolation(IFileDialog*, IShellItem*, FDE_SHAREVIOLATION_RESPONSE*)
    {
        return S_OK;
    };
    IFACEMETHODIMP OnTypeChange(IFileDialog* pfd) { return S_OK; };
    IFACEMETHODIMP OnOverwrite(IFileDialog*, IShellItem*, FDE_OVERWRITE_RESPONSE*) { return S_OK; };

    // IFileDialogControlEvents methods
    IFACEMETHODIMP OnButtonClicked(IFileDialogCustomize* dialogCustomisation, DWORD id)
    {
        customisationToDialog[dialogCustomisation]->Close(CODA_OPEN_DIALOG_CREATE_NEW_INSTEAD);

        new_document_created = new_document((CODA_OPEN_CONTROL) id);

        return S_OK;
    };

    // Rest are dummies
    IFACEMETHODIMP OnItemSelected(IFileDialogCustomize*, DWORD, DWORD) { return S_OK; };
    IFACEMETHODIMP OnCheckButtonToggled(IFileDialogCustomize*, DWORD, BOOL) { return S_OK; };
    IFACEMETHODIMP OnControlActivating(IFileDialogCustomize*, DWORD) { return S_OK; };

    CDialogEventHandler()
        : _cRef(1){};

private:
    virtual ~CDialogEventHandler(){};

    long _cRef;
};

// Instance creation helper
static HRESULT CDialogEventHandler_CreateInstance(REFIID riid, void** ppv)
{
    *ppv = NULL;
    CDialogEventHandler* pDialogEventHandler = new (std::nothrow) CDialogEventHandler();
    HRESULT hr = pDialogEventHandler ? S_OK : E_OUTOFMEMORY;
    if (SUCCEEDED(hr))
    {
        hr = pDialogEventHandler->QueryInterface(riid, ppv);
        pDialogEventHandler->Release();
    }
    return hr;
}

// ================ End of sample code

static void processMessage(WindowData& data, wil::unique_cotaskmem_string& message);

[[noreturn]] static void fatal(const std::string& message)
{
    MessageBoxW(hiddenOwnerWindow, Util::string_to_wide_string(message).c_str(), L"ERROR", MB_OK);
    std::abort();
}

static std::wstring new_document(CODA_OPEN_CONTROL id)
{
    // Copy a template to the user's document folder. Where else? Should we let the user decide
    // where it goes?

    std::wstring templateBasename, templateExtension;
    switch (id)
    {
        case CODA_OPEN_CONTROL::NEW_TEXT:
            templateBasename = L"Text Document";
            templateExtension = L"odt";
            break;
        case CODA_OPEN_CONTROL::NEW_SPREADSHEET:
            templateBasename = L"Spreadsheet";
            templateExtension = L"ods";
            break;
        case CODA_OPEN_CONTROL::NEW_PRESENTATION:
            templateBasename = L"Presentation";
            templateExtension = L"odp";
            break;
        default:
            fatal("Unexpected case in new_document()");
    }

    const auto templateSourcePath = Util::string_to_wide_string(app_installation_path) +
                                    L"..\\templates\\" + templateBasename + L"." +
                                    templateExtension;

    PWSTR documents;
    SHGetKnownFolderPath(FOLDERID_Documents, 0, NULL, &documents);

    int counter = 0;
    std::wstring templateCopyPath;

    do
    {
        std::wstring number = L"";
        if (counter > 0)
            number = L" (" + std::to_wstring(counter) + L")";

        templateCopyPath = std::wstring(documents) + L"\\" + templateBasename + number + L"." +
                           templateExtension;
        counter++;
    } while (std::filesystem::exists(std::filesystem::path(templateCopyPath)));

    std::filesystem::copy_file(templateSourcePath, templateCopyPath);

    CoTaskMemFree(documents);

    return templateCopyPath;
}

static int generate_new_app_doc_id()
{
    // Start with a random document id to catch code that might assume it to be some fixed value,
    // like 0 or 1. Also make it obvious that this numeric "app doc id", used by the mobile apps and
    // CODA, is not related to the string document ids (usually with several leading zeroes) used in
    // the C++ bits of normal COOL.
    static int id = 42 + (std::time(nullptr) % 100);

    DocumentData::allocate(id);
    return id++;
}

static void send2JS(const HWND hWnd, const char* buffer, int length)
{
    const bool binaryMessage = COOLProtocol::isBinaryMessage(buffer, static_cast<size_t>(length));
    std::string pretext{ binaryMessage
                             ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
                             : "window.TheFakeWebSocket.onmessage({'data': window.b64d('" };
    const std::string posttext{ "')});" };

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

    PostMessageW(hWnd, CODA_WM_EXECUTESCRIPT, (WPARAM)wparam, 0);
}

// FIXME: This function is *exported* on purpose and called by SfxStoringHelper::FinishGUIStoreModel() in
// sfx2/source/doc/guisaveas.cxx in core. Yes, this is an awful hack.

__declspec(dllexport) void output_file_dialog_from_core(const std::wstring& suggestedURI, std::string& result)
{
    auto URI = Poco::URI(Util::wide_string_to_string(suggestedURI));
    auto path = URI.getPath();
    if (path.size() > 4 && path[0] == '/' && path[2] == ':' && path[3] == '/')
        path = path.substr(1);
    auto lastSlash = path.find_last_of('/');
    auto filename = path.substr(lastSlash + 1);
    auto folder = path.substr(0, lastSlash);
    auto lastPeriod = filename.find_last_of('.');
    auto extension = filename.substr(lastPeriod + 1);
    auto filenameAndUri = fileSaveDialog(filename, folder, extension);
    result = filenameAndUri.uri;
}

static void stopServer()
{
    SigUtil::requestShutdown();

    // Wait until coolwsdThread is torn down, so that we don't start cleaning up too early.
    coolwsdThread.join();
}

static void do_hullo_handling_things(WindowData& data)
{
    // FIXME: Code snippet shared with mobile.cpp, factor out into separate file.

    // Now we know that the JS has started completely

    // Contact the permanently (during app lifetime) listening COOLWSD server "public" socket
    assert(coolwsd_server_socket_fd != -1);
    int rc = fakeSocketConnect(data.fakeClientFd, coolwsd_server_socket_fd);
    (void)rc;
    assert(rc != -1);

    // Create a socket pair to notify the below thread when the document has been closed
    fakeSocketPipe2(data.closeNotificationPipeForForwardingThread);

    // Start another thread to read responses and forward them to the JavaScript
    std::thread(
        [data]
        {
            Util::setThreadName("app2js " + std::to_string(data.appDocId));
            while (true)
            {
                struct pollfd pollfd[2];
                pollfd[0].fd = data.fakeClientFd;
                pollfd[0].events = POLLIN;
                pollfd[1].fd = data.closeNotificationPipeForForwardingThread[1];
                pollfd[1].events = POLLIN;
                if (fakeSocketPoll(pollfd, 2, -1) > 0)
                {
                    if (pollfd[1].revents == POLLIN)
                    {
                        // The code below handling the "BYE" fake Websocket message has closed the other
                        // end of the closeNotificationPipeForForwardingThread. Let's close the other
                        // end too just for cleanliness, even if a FakeSocket as such is not a system
                        // resource so nothing is saved by closing it.
                        fakeSocketClose(data.closeNotificationPipeForForwardingThread[1]);

                        // Close our end of the fake socket connection to the ClientSession thread, so
                        // that it terminates.
                        fakeSocketClose(data.fakeClientFd);

                        return;
                    }
                    if (pollfd[0].revents == POLLIN)
                    {
                        int n = fakeSocketAvailableDataLength(data.fakeClientFd);
                        // I don't want to check for n being -1 here, even if that will lead to a crash,
                        // as n being -1 is a sign of something being wrong elsewhere anyway, and I
                        // prefer to fix the root cause. Let's see how well this works out.
                        if (n == 0)
                            return;
                        std::vector<char> buf(n);
                        n = fakeSocketRead(data.fakeClientFd, buf.data(), n);
                        send2JS(data.hWnd, buf.data(), n);
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

    // First we must send the URL. This corresponds to the GET request with Upgrade to WebSocket.
    // This *must* be the first message written to the "client" thread. We don't need to do this
    // write in a separate thread, and we can't, because if we do that, we will occasionaly run into
    // a bug when the "coolclient" message sent by the JS is received and gets forwarded to the
    // "client" thread before we have written the URL to it.

    std::string message(data.filenameAndUri.uri + " " + std::to_string(data.appDocId));
    fakeSocketWriteQueue(data.fakeClientFd, message.c_str(), message.size());
}

static void do_welcome_handling_things(WindowData& data)
{
    const auto welcomeSlideshow = Poco::Path(app_installation_path + "..\\cool\\welcome\\welcome-slideshow.odp");

    if (!Poco::File(welcomeSlideshow).exists())
        return;

    openCOOLWindow({ welcomeSlideshow.getFileName(), Poco::URI(welcomeSlideshow).toString() }, PERMISSION::WELCOME);
}

static void enter_full_screen(WindowData& data, HMONITOR monitor, bool saveRestoreInfo)
{
    if (data.isFullScreen)
        return;

    LONG style = GetWindowLong(data.hWnd, GWL_STYLE);

    if (saveRestoreInfo)
    {
        GetWindowRect(data.hWnd, &data.originalRect);
        data.originalStyle = style;
    }

    // Remove window borders and title bar
    style &= ~(WS_OVERLAPPEDWINDOW);
    SetWindowLong(data.hWnd, GWL_STYLE, style);

    MONITORINFO monitorInfo = { sizeof(monitorInfo) };
    GetMonitorInfo(monitor, &monitorInfo);

    // Resize window to fill the entire monitor
    SetWindowPos(data.hWnd, NULL,
                 monitorInfo.rcMonitor.left, monitorInfo.rcMonitor.top,
                 monitorInfo.rcMonitor.right - monitorInfo.rcMonitor.left,
                 monitorInfo.rcMonitor.bottom - monitorInfo.rcMonitor.top,
                 SWP_NOZORDER | SWP_FRAMECHANGED);
    data.isFullScreen = true;
}

static void leave_full_screen(WindowData& data)
{
    if (!data.isFullScreen)
        return;

    SetWindowLong(data.hWnd, GWL_STYLE, data.originalStyle);

    // Restore in two steps, position first, then size.
    // So if we restore from external monitor at a different resolution than
    // the laptop monitor, that a WM_DPICHANGED triggered from changing monitor
    // (which gets processed during SetWindowPos) doesn't mangle the size.
    SetWindowPos(data.hWnd, NULL,
                 data.originalRect.left, data.originalRect.top,
                 data.originalRect.right - data.originalRect.left,
                 data.originalRect.bottom - data.originalRect.top,
                 SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOSIZE);
    SetWindowPos(data.hWnd, NULL,
                 data.originalRect.left, data.originalRect.top,
                 data.originalRect.right - data.originalRect.left,
                 data.originalRect.bottom - data.originalRect.top,
                 SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOMOVE);

    data.isFullScreen = false;
}

static void do_bye_handling_things(const WindowData& data)
{
    LOG_TRC_NOFILE(
        "Document window terminating on JavaScript side. Closing our end of the socket.");

    // Close one end of the socket pair, that will wake up the forwarding thread above
    fakeSocketClose(data.closeNotificationPipeForForwardingThread[0]);

    // For the welcome slideshow we need to close the window ourselves
    if (data.permission == PERMISSION::WELCOME)
        PostMessageW(data.hWnd, WM_CLOSE, 0, 0);
}

static void do_print(int appDocId)
{
    const std::string tempFile = FileUtil::createRandomTmpDir() + "\\p.pdf";
    const std::string tempFileUri = Poco::URI(Poco::Path(tempFile)).toString();

    DocumentData::get(appDocId).loKitDocument->saveAs(tempFileUri.c_str(), "pdf", nullptr);

    STARTUPINFOW startupInfo{ sizeof(STARTUPINFOW) };
    PROCESS_INFORMATION processInformation;

    if (!CreateProcessW(
            Util::string_to_wide_string(app_installation_path + "..\\PrintPDFAndDelete.exe").c_str(),
            Util::string_to_wide_string("PrintPDFAndDelete " + tempFileUri).data(), NULL, NULL,
            TRUE, 0, NULL, NULL, &startupInfo, &processInformation))
        LOG_ERR("CreateProcess failed: " << GetLastError());
}

static void do_other_message_handling_things(const WindowData& data, const char* message)
{
    LOG_TRC_NOFILE("Handling other message:'" << message << "'");

    fakeSocketWriteQueue(data.fakeClientFd, message, strlen(message));
}

static void do_cut_or_copy(ClipboardOp op, WindowData& data)
{
    // Tell core to copy the selection into its internal clipboard
    DocumentData::get(data.appDocId).loKitDocument->postUnoCommand(".uno:Copy");

    size_t count = 0;
    char** mimeTypes = nullptr;
    size_t* sizes = nullptr;
    char** streams = nullptr;

    // Get core's internal clipboard
    DocumentData::get(data.appDocId).loKitDocument->getClipboard(nullptr, &count, &mimeTypes, &sizes,
                                                            &streams);
    if (!OpenClipboard(NULL))
        return;

    if (!EmptyClipboard())
    {
        CloseClipboard();
        return;
    }

    for (int i = 0; i < count; i++)
    {
        // We check whether there is a corresponding standard or well-known Windows clipboard
        // format.
        int format = 0;
        int format2 = 0;
        int wformat = 0;

        if (strcmp(mimeTypes[i], "text/plain;charset=utf-8") == 0)
            wformat = CF_UNICODETEXT;
        else if (strcmp(mimeTypes[i], "text/rtf") == 0)
            format = RegisterClipboardFormatW(L"Rich Text Format");
        else if (strcmp(mimeTypes[i], "text/html") == 0)
            format = RegisterClipboardFormatW(L"HTML (HyperText Markup Language)");
        else if (strcmp(mimeTypes[i], "image/png") == 0)
        {
            format = RegisterClipboardFormatW(L"image/png");
            format2 = RegisterClipboardFormatW(L"PNG");
        }
        else if (strcmp(mimeTypes[i], "application/x-openoffice-embed-source-xml;windows_formatname=\"Star Embed Source (XML)\"") == 0)
            format = RegisterClipboardFormatW(L"Star Embed Source (XML)");
        else if (std::string(mimeTypes[i]).starts_with("application/x-openoffice-objectdescriptor-xml;"))
            format = RegisterClipboardFormatW(L"Star Object Descriptor (XML)");

        if (wformat)
        {
            std::wstring wtext =
                sizes[i] ? Util::string_to_wide_string(std::string(streams[i])) : L"";
            const int byteSize = wtext.size() * 2;
            HANDLE hglData = GlobalAlloc(GMEM_MOVEABLE, byteSize);
            if (hglData)
            {
                wchar_t* wcopy = (wchar_t*)GlobalLock(hglData);
                memcpy(wcopy, wtext.c_str(), byteSize);
                GlobalUnlock(hglData);
                SetClipboardData(wformat, hglData);
            }
        }
        else if (format)
        {
            HANDLE hglData = GlobalAlloc(GMEM_MOVEABLE, sizes[i]);
            if (hglData)
            {
                char* copy = (char*)GlobalLock(hglData);
                memcpy(copy, streams[i], sizes[i]);
                GlobalUnlock(hglData);
                SetClipboardData(format, hglData);
                if (format2)
                    SetClipboardData(format2, hglData);
            }
        }
    }
    CloseClipboard();

    data.lastOwnClipboardModification = GetClipboardSequenceNumber();

    if (op == ClipboardOp::CUT)
        DocumentData::get(data.appDocId).loKitDocument->postUnoCommand(".uno:Cut");
}

static std::wstring get_clipboard_format_name(UINT format)
{
    const int NNAME{ 1000 };
    wchar_t name[NNAME];
    int nwc = GetClipboardFormatNameW(format, name, NNAME);
    if (nwc)
    {
        name[nwc] = 0;
        return name;
    }
    return L"";
}

static std::string get_html_clipboard_fragment(const char* data)
{
    std::string htmlData(data);

    std::regex startRegex("(\r|\n)StartFragment:(\\d+)(\r|\n)");
    std::regex endRegex("(\r|\n)EndFragment:(\\d+)(\r|\n)");

    std::smatch match;
    size_t startPos = std::string::npos;
    size_t endPos = std::string::npos;

    if (std::regex_search(htmlData, match, startRegex))
        startPos = std::stoul(match[2]);

    if (std::regex_search(htmlData, match, endRegex))
        endPos = std::stoul(match[2]);

    if (startPos == std::string::npos || endPos == std::string::npos || startPos >= endPos || endPos > htmlData.size())
        return "";

    return htmlData.substr(startPos, endPos - startPos);
}

static void do_paste_or_read(ClipboardOp op, WindowData& data)
{
    if (data.lastAnyonesClipboardModification > data.lastOwnClipboardModification)
    {
        if (!OpenClipboard(NULL))
            return;

        std::vector<const char*> mimeTypes;
        std::vector<size_t> sizes;
        std::vector<const char*> streams;

        UINT format = 0;

        std::set<std::string> doneMimeTypes;

        while ((format = EnumClipboardFormats(format)) != 0)
        {
            if (format == CF_UNICODETEXT)
            {
                HANDLE data = GetClipboardData(format);
                if (!data)
                    continue;
                wchar_t* wtext = (wchar_t*)GlobalLock(data);
                if (!wtext)
                {
                    GlobalUnlock(data);
                    continue;
                }
                std::string text = Util::wide_string_to_string(std::wstring(wtext));
                GlobalUnlock(data);

                mimeTypes.push_back(_strdup("text/plain;charset=utf-8"));
                doneMimeTypes.insert("text/plain;charset=utf-8");
                sizes.push_back(text.size());
                streams.push_back(_strdup(text.c_str()));
            }
            else
            {
                auto name = get_clipboard_format_name(format);

                std::string mimeType;

                if (name == L"Star Embed Source (XML)")
                    mimeType = "application/x-openoffice-embed-source-xml;windows_formatname=\"Star Embed Source (XML)\"";
                else if (name == L"Star Object Descriptor (XML)")
                    mimeType = "application/x-openoffice-objectdescriptor-xml;windows_formatname=\"Star Object Descriptor (XML)\"";
                else if (name == L"PNG")
                    mimeType = "image/png";
                else if (name == L"Rich Text Format")
                    mimeType = "text/rtf";
                else if (name == L"text/rtf" || name == L"image/png" ||
                         // Not handled yet if ever by the rest of the code here and in core, I think,
                         // but why not be future-safe.
                         name == L"image/svg+xml")
                    mimeType = Util::wide_string_to_string(name);
                else if (name == L"HTML (HyperText Markup Language)" ||
                         name == L"HTML Format")
                    mimeType = "text/html";

                if (mimeType != "" && doneMimeTypes.count(mimeType) == 0)
                {
                    HANDLE data = GetClipboardData(format);
                    if (!data)
                        continue;
                    size_t size = GlobalSize(data);
                    const char* source = (const char*)GlobalLock(data);
                    if (!source)
                    {
                        GlobalUnlock(data);
                        continue;
                    }

                    std::string fragment;
                    if (name == L"HTML Format")
                    {
                        fragment = get_html_clipboard_fragment(source).c_str();
                        source = fragment.c_str();
                        size = strlen(source);
                    }

                    doneMimeTypes.insert(mimeType);

                    char* copy = (char*)std::malloc(size);
                    std::memcpy(copy, source, size);

                    GlobalUnlock(data);

                    mimeTypes.push_back(_strdup(mimeType.c_str()));
                    sizes.push_back(size);
                    streams.push_back(copy);
                }
            }
        }

        // Populate core's internal clipboard
        DocumentData::get(data.appDocId).loKitDocument->setClipboard(mimeTypes.size(), mimeTypes.data(),
                                                                     sizes.data(), streams.data());

        for (int i = 0; i < mimeTypes.size(); i++)
        {
            std::free((void*)mimeTypes[i]);
            std::free((void*)streams[i]);
        }

        CloseClipboard();
    }

    if (op == ClipboardOp::PASTE)
    {
        DocumentData::get(data.appDocId).loKitDocument->postUnoCommand(".uno:Paste");
    }
    else if (op == ClipboardOp::PASTEUNFORMATTED)
    {
        DocumentData::get(data.appDocId).loKitDocument->postUnoCommand(".uno:PasteUnformatted");
    }
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

static void do_open_hyperlink(HWND hWnd, std::wstring url)
{
    ShellExecuteW(hWnd, NULL, url.c_str(), NULL, NULL, SW_SHOW);
}

struct MonitorInfo
{
    HMONITOR hMonitor;
    DWORD dwFlags;
};

typedef std::vector<MonitorInfo> Monitors;

BOOL monitorEnum(HMONITOR monitor, HDC, LPRECT, LPARAM data)
{
    MONITORINFO monitorInfo = { sizeof(monitorInfo) };
    GetMonitorInfo(monitor, &monitorInfo);

    Monitors& monitors = *reinterpret_cast<Monitors*>(data);
    monitors.push_back(MonitorInfo{monitor, monitorInfo.dwFlags});
    return true;
}

Monitors getMonitors()
{
    Monitors monitors;
    EnumDisplayMonitors(nullptr, nullptr, monitorEnum, reinterpret_cast<LPARAM>(&monitors));
    return monitors;
}

static void exchangeMonitors(WindowData& data)
{
    Monitors monitors(getMonitors());
    if (monitors.size() < 2)
        return;

    HMONITOR hConsoleMonitor = MonitorFromWindow(data.hConsoleWnd, MONITOR_DEFAULTTONEAREST);
    HMONITOR hPresentationMonitor = MonitorFromWindow(data.hWnd, MONITOR_DEFAULTTONEAREST);

    size_t origConsoleMonitor = 0;
    size_t origPresentationMonitor = 0;
    for (size_t i = 0; i < monitors.size(); ++i)
    {
        if (monitors[i].hMonitor == hConsoleMonitor)
            origConsoleMonitor = i;
        if (monitors[i].hMonitor == hPresentationMonitor)
            origPresentationMonitor = i;
    }

    leave_full_screen(data);
    leave_full_screen(windowData[data.hConsoleWnd]);

    size_t newConsoleMonitor = (origConsoleMonitor + 1) % monitors.size();
    size_t newPresentationMonitor = origPresentationMonitor;
    if (newConsoleMonitor == newPresentationMonitor)
        newPresentationMonitor = (newPresentationMonitor + 1) % monitors.size();

    enter_full_screen(data, monitors[newPresentationMonitor].hMonitor, false);
    enter_full_screen(windowData[data.hConsoleWnd], monitors[newConsoleMonitor].hMonitor, false);
}

static OpenDialogResult fileOpenDialog()
{
    IFileOpenDialog* dialog;

    if (!SUCCEEDED(CoCreateInstance(CLSID_FileOpenDialog, NULL, CLSCTX_INPROC_SERVER,
                                    IID_IFileOpenDialog, reinterpret_cast<void**>(&dialog))))
        fatal("CoCreateInstance(CLSID_FileOpenDialog) failed");

    COMDLG_FILTERSPEC filter[] = {
        { _(L"Normal files"),
          L"*.odt;*.docx;*.doc;*.rtf;*.txt;*.ods;*.xlsx;*.xls;*.odp;*.pptx;*.ppt" },
        { _(L"All files"), L"*.*" }
    };

    if (!SUCCEEDED(dialog->SetFileTypes(sizeof(filter) / sizeof(filter[0]), &filter[0])))
        fatal("dialog->SetFileTypes() failed");

    wchar_t title[100];
    StringCbPrintfW(title, sizeof(title), _(L"Select document to edit in %s"), appName.c_str());
    if (!SUCCEEDED(dialog->SetTitle(title)))
        fatal("StringCbPrintfW() failed");

    IFileDialogEvents* dialogEvents = NULL;
    if (!SUCCEEDED(CDialogEventHandler_CreateInstance(IID_PPV_ARGS(&dialogEvents))))
        fatal("CDialogEventHandler_CreateInstance() failed");

    DWORD cookie = 0;
    if (!SUCCEEDED(dialog->Advise(dialogEvents, &cookie)))
        fatal("dialog->Advise() failed");

    IFileDialogCustomize* dialogCustomisation = NULL;
    if (!SUCCEEDED(dialog->QueryInterface(IID_PPV_ARGS(&dialogCustomisation))))
        fatal("dialog->QueryInterface() failed");

    customisationToDialog[dialogCustomisation] = dialog;

    if (!SUCCEEDED(dialogCustomisation->AddSeparator((DWORD)CODA_OPEN_CONTROL::SEP1)))
        fatal("dialogCustomisation->AddSeparator() failed");

    if (!SUCCEEDED(dialogCustomisation->StartVisualGroup(CODA_GROUP_OPEN, _(L"Create new"))))
        fatal("dialogCustomisation->StartVisualGroup() failed");

    if (!SUCCEEDED(dialogCustomisation->AddPushButton((DWORD)CODA_OPEN_CONTROL::NEW_TEXT,
                                                      _(L"Text document"))))
        fatal("dialogCustomisation->AddPushButton() failed");

    if (!SUCCEEDED(dialogCustomisation->AddPushButton((DWORD)CODA_OPEN_CONTROL::NEW_SPREADSHEET,
                                                      _(L"Spreadsheet"))))
        fatal("dialogCustomisation->AddPushButton() failed");

    if (!SUCCEEDED(dialogCustomisation->AddPushButton((DWORD)CODA_OPEN_CONTROL::NEW_PRESENTATION,
                                                      _(L"Presentation"))))
        fatal("dialogCustomisation->AddPushButton() failed");

    dialogCustomisation->EndVisualGroup();

    if (!SUCCEEDED(dialogCustomisation->AddSeparator((DWORD)CODA_OPEN_CONTROL::SEP2)))
        fatal("dialogCustomisation->AddSeparator() failed");

    dialogCustomisation->Release();

    FILEOPENDIALOGOPTIONS options;
    if (SUCCEEDED(dialog->GetOptions(&options)))
    {
        options |= FOS_ALLOWMULTISELECT;
        dialog->SetOptions(options);
    }

    HRESULT dialogResult = dialog->Show(hiddenOwnerWindow);

    if (!SUCCEEDED(dialogResult))
        return {};

    std::vector<FilenameAndUri> result;

    if (dialogResult == CODA_OPEN_DIALOG_CREATE_NEW_INSTEAD)
    {
        auto path = Poco::Path(Util::wide_string_to_string(new_document_created));
        result.push_back({ path.getFileName(), Poco::URI(path).toString() });
        return { true, result };
    }
    else
    {
        IShellItemArray* items;
        if (!SUCCEEDED(dialog->GetResults(&items)))
            fatal("dialog->GetResults() failed");

        DWORD numItems;
        if (!SUCCEEDED(items->GetCount(&numItems)))
            fatal("items->GetCount() failed");

        for (int i = 0; i < numItems; i++)
        {
            IShellItem* item;
            PWSTR fileSysPath;
            if (SUCCEEDED(items->GetItemAt(i, &item)) &&
                SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &fileSysPath)))
            {
                auto path = Poco::Path(Util::wide_string_to_string(std::wstring(fileSysPath)));
                result.push_back({ path.getFileName(), Poco::URI(path).toString() });
                CoTaskMemFree(fileSysPath);
                item->Release();
            }
        }
        items->Release();
    }
    dialog->Unadvise(cookie);
    dialog->Release();

    customisationToDialog.erase(dialogCustomisation);

    return { false, result };
}

static FilenameAndUri fileSaveDialog(const std::string& name, const std::string& folder, const std::string& extension)
{
    IFileSaveDialog* dialog;

    if (!SUCCEEDED(CoCreateInstance(CLSID_FileSaveDialog, NULL, CLSCTX_INPROC_SERVER,
                                    IID_IFileSaveDialog, reinterpret_cast<void**>(&dialog))))
        fatal("CoCreateInstance(CLSID_FileSaveDialog) failed");

    FILEOPENDIALOGOPTIONS options;

    if (!SUCCEEDED(dialog->GetOptions(&options)))
        fatal("dialog->GetOptions() failed");

    options |= FOS_STRICTFILETYPES;

    if (!SUCCEEDED(dialog->SetOptions(options)))
        fatal("dialog->SetOptions() failed");

    if (!SUCCEEDED(dialog->SetDefaultExtension(Util::string_to_wide_string(extension).c_str())))
        fatal("dialog->SetDefaultExtension() failed");

    wchar_t* extensionCopy = _wcsdup(Util::string_to_wide_string("*." + extension).c_str());

    COMDLG_FILTERSPEC filter[] = {
        { L"Only allowed", extensionCopy }
    };

    if (!SUCCEEDED(dialog->SetFileTypes(sizeof(filter) / sizeof(filter[0]), &filter[0])))
        fatal("dialog->SetFileTypes() failed");

    if (!SUCCEEDED(dialog->SetFileName(Util::string_to_wide_string(name).c_str())))
        fatal("dialog->SetFileName() failed");

    if (folder != "")
    {
        std::wstring wfolder = Util::string_to_wide_string(folder);
        std::replace(wfolder.begin(), wfolder.end(), L'/', L'\\');

        IShellItem* psiFolder;
        if (SUCCEEDED(SHCreateItemFromParsingName(wfolder.c_str(), nullptr, IID_PPV_ARGS(&psiFolder))))
        {
            if (!SUCCEEDED(dialog->SetFolder(psiFolder)))
                fatal("dialog->SetFolder() failed");
            psiFolder->Release();
        }
    }

    if (!SUCCEEDED(dialog->Show(hiddenOwnerWindow)))
        return {};

    std::free(extensionCopy);

    IShellItem* item;
    if (!SUCCEEDED(dialog->GetResult(&item)))
        fatal("dialog->GetResult() failed");

    PWSTR fileSysPath;
    if (!SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &fileSysPath)))
        fatal("item->GetDisplayName() failed");

    auto path = Poco::Path(Util::wide_string_to_string(std::wstring(fileSysPath)));
    CoTaskMemFree(fileSysPath);
    item->Release();
    dialog->Release();

    return { path.getFileName(), Poco::URI(path).toString() };
}

static void arrangePresentationWindows(WindowData& data)
{
    Monitors monitors(getMonitors());
    data.numMonitors = monitors.size();

    HMONITOR laptopMonitor = 0;
    HMONITOR externalMonitor = 0;

    for (const auto& monitor : monitors)
    {
        if (monitor.dwFlags & MONITORINFOF_PRIMARY)
        {
            if (!laptopMonitor)
                laptopMonitor = monitor.hMonitor;
        }
        else
        {
            if (!externalMonitor)
                externalMonitor = monitor.hMonitor;
        }
    }

    if (!laptopMonitor || !externalMonitor)
    {
        laptopMonitor = MonitorFromWindow(data.hWnd, MONITOR_DEFAULTTONEAREST);
        externalMonitor = 0;
        for (const auto& monitor : monitors)
        {
            if (monitor.hMonitor != laptopMonitor)
            {
                externalMonitor = monitor.hMonitor;
                break;
            }
        }
    }

    leave_full_screen(data);
    if (data.hConsoleWnd)
        leave_full_screen(windowData[data.hConsoleWnd]);

    HMONITOR presenterMonitor = externalMonitor ? externalMonitor : laptopMonitor;

    enter_full_screen(data, presenterMonitor, true);

    if (data.hConsoleWnd)
    {
        if (externalMonitor)
            enter_full_screen(windowData[data.hConsoleWnd], laptopMonitor, true);
        else
            BringWindowToTop(data.hConsoleWnd);
    }
}

static LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
        case WM_SIZING:
            {
                int minimumWidth = 1000, minimumHeight = 800;

                HMONITOR monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
                MONITORINFO monitorInfo;
                monitorInfo.cbSize = sizeof(monitorInfo);
                if (GetMonitorInfoW(monitor, &monitorInfo))
                {
                    // If the monitor has a "reasonable" aspect ratio (1:1 to 2:1) (taking into
                    // account it might be in landscape or portrait orientation), set minimum width
                    // to a quarter of monitor width and minimum height to a third of monitior
                    // height. (Because COOL requires more essential space in the vertical
                    // direction, I think.)
                    double aspectRatio =
                        (double)(monitorInfo.rcWork.right - monitorInfo.rcWork.left) / (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top);
                    if (aspectRatio >= 0.49 && aspectRatio <= 2.01)
                    {
                        // Reasonable case
                        minimumWidth = (monitorInfo.rcWork.right - monitorInfo.rcWork.left) / 4;
                        minimumHeight = (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top) / 3;
                    }
                    else if (aspectRatio < 0.49)
                    {
                        // Very narrow, set just minimum height
                        minimumHeight = (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top) / 3;
                    }
                    else if (aspectRatio > 2.01)
                    {
                        // Very wide, set just minimum width
                        minimumWidth = (monitorInfo.rcWork.right - monitorInfo.rcWork.left) / 4;
                    }
                }

                RECT* rect = (RECT*)lParam;
                if (rect->right - rect->left < minimumWidth)
                {
                    switch (wParam)
                    {
                        case WMSZ_LEFT:
                        case WMSZ_TOPLEFT:
                        case WMSZ_BOTTOMLEFT:
                            rect->left = rect->right - minimumWidth;
                            break;
                        case WMSZ_RIGHT:
                        case WMSZ_TOPRIGHT:
                        case WMSZ_BOTTOMRIGHT:
                            rect->right = rect->left + minimumWidth;
                            break;
                        case WMSZ_TOP:
                        case WMSZ_BOTTOM:
                            {
                                // Weird case, resizing height but still the width goes below the
                                // minimum? Grow width on both sizes.
                                auto mid = (rect->left + rect->right) / 2;
                                rect->left = mid - minimumWidth/2;
                                rect->right = rect->left + minimumWidth;
                            }
                            break;
                    }
                }
                if (rect->bottom - rect->top < minimumHeight)
                {
                    switch (wParam)
                    {
                        case WMSZ_TOP:
                        case WMSZ_TOPLEFT:
                        case WMSZ_TOPRIGHT:
                            rect->top = rect->bottom - minimumHeight;
                            break;
                        case WMSZ_BOTTOM:
                        case WMSZ_BOTTOMLEFT:
                        case WMSZ_BOTTOMRIGHT:
                            rect->bottom = rect->top + minimumHeight;
                            break;
                        case WMSZ_LEFT:
                        case WMSZ_RIGHT:
                            {
                                // Weird case, resizing width but still the height goes below the
                                // minimum? Grow height on both sizes.
                                auto mid = (rect->top + rect->bottom) / 2;
                                rect->top = mid - minimumHeight/2;
                                rect->bottom = rect->top + minimumHeight;
                            }
                            break;
                    }
                }
            }
            return TRUE;

        case WM_SIZE:
            if (windowData[hWnd].webViewController != nullptr)
            {
                RECT bounds;
                GetClientRect(hWnd, &bounds);
                windowData[hWnd].webViewController->put_Bounds(bounds);

                if (!windowData[hWnd].isFullScreen &&
                    persistentWindowSizeStoreOK &&
                    (wParam == SIZE_MAXIMIZED || wParam == SIZE_RESTORED))
                {
                    std::vector<uint8_t> value(sizeof(PersistedDocumentWindowSize));
                    PersistedDocumentWindowSize* p = reinterpret_cast<PersistedDocumentWindowSize*>(value.data());
                    if (wParam == SIZE_RESTORED)
                    {
                        p->size.x = LOWORD(lParam);
                        p->size.y = HIWORD(lParam);
                        windowData[hWnd].previousSize = p->size;
                    }
                    else
                    {
                        p->size = windowData[hWnd].previousSize;
                    }
                    p->resizeType = wParam;
                    persistentWindowSizeStore.put(windowData[hWnd].filenameAndUri.uri.c_str(), value);
                }
            };
            break;

        case WM_SETFOCUS:
            if (windowData.count(hWnd) && windowData[hWnd].webViewController)
                windowData[hWnd].webViewController->MoveFocus(
                    COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
            break;

        case WM_DPICHANGED:
        {
            const RECT* newRect = (RECT*)lParam;
            SetWindowPos(hWnd, NULL, newRect->left, newRect->top, newRect->right - newRect->left,
                         newRect->bottom - newRect->top, SWP_NOZORDER | SWP_NOACTIVATE);
        }
        break;

        case WM_DISPLAYCHANGE:
        {
            auto& data = windowData[hWnd];
            if (data.hConsoleWnd)
            {
                int numMonitors = getMonitors().size();
                if (data.numMonitors != numMonitors)
                    arrangePresentationWindows(data);
            }
        }
        break;

        case WM_CLOSE:
            {
                if (!windowData[hWnd].isConsole)
                {
                    // FIXME: Should we make sure he document is saved? Or ask the user whether to save it?
                    do_bye_handling_things(windowData[hWnd]);

                    DocumentData::deallocate(windowData[hWnd].appDocId);
                }
                else
                {
                    auto& parent = windowData[windowData[hWnd].hParentWnd];
                    leave_full_screen(parent);
                    parent.hConsoleWnd = 0;
                }
                DestroyWindow(hWnd);
            }
            break;

        case WM_DESTROY:
            if (DocumentData::count() == 0)
            {
                stopServer();
                if (persistentWindowSizeStoreOK)
                {
                    persistentWindowSizeStoreOK = false;
                    persistentWindowSizeStore.close();
                }
            }
            break;

        case WM_CLIPBOARDUPDATE:
            windowData[hWnd].lastAnyonesClipboardModification = GetClipboardSequenceNumber();
            break;

        case CODA_WM_EXECUTESCRIPT:
            windowData[hWnd].webView->ExecuteScript(
                Util::string_to_wide_string(std::string((char*)wParam)).c_str(),
                Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
                    [](HRESULT errorCode, LPCWSTR resultObjectAsJson) -> HRESULT
                    {
                        // LOG_TRC(Util::wide_string_to_string(resultObjectAsJson));
                        return S_OK;
                    })
                    .Get());
            std::free((char*)wParam);
            break;

        case CODA_WM_LOADNEXTDOCUMENT:
            if (currentFileToOpenIndex < filenamesAndUrisToOpen.size() - 1)
            {
                currentFileToOpenIndex++;
                openCOOLWindow(filenamesAndUrisToOpen[currentFileToOpenIndex], PERMISSION::EDIT);
            }
            break;

        default:
            return DefWindowProc(hWnd, message, wParam, lParam);
            break;
    }

    return 0;
}

// From https://stackoverflow.com/questions/51334674/how-to-detect-windows-10-light-dark-mode-in-win32-application

static bool isLightTheme()
{
    int value;
    DWORD cbData = 4;
    auto res = RegGetValueW(
        HKEY_CURRENT_USER,
        L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        L"AppsUseLightTheme",
        RRF_RT_REG_DWORD,
        NULL,
        &value,
        &cbData);

    if (res != ERROR_SUCCESS)
        return true;

    return value == 1;
}

static void openCOOLWindow(const FilenameAndUri& filenameAndUri, PERMISSION permission)
{
    bool havePersistedSize = false;

    int width, height;
    int welcomeX = CW_USEDEFAULT, welcomeY = CW_USEDEFAULT;
    bool maximize = false;

    if (permission != PERMISSION::WELCOME && persistentWindowSizeStoreOK)
    {
        std::vector<uint8_t> value;
        if (persistentWindowSizeStore.get(filenameAndUri.uri.c_str(), value) == litecask::Status::Ok)
        {
            if (value.size() == sizeof(POINT))
            {
                // We used to store just the size
                const POINT* p = reinterpret_cast<POINT*>(value.data());
                width = p->x;
                height = p->y;
                havePersistedSize = true;
            }
            else if (value.size() == sizeof(PersistedDocumentWindowSize))
            {
                // Currently we also store the last wParam in the WM_SIZE message
                const PersistedDocumentWindowSize* p = reinterpret_cast<PersistedDocumentWindowSize*>(value.data());
                width = p->size.x;
                height = p->size.y;
                if (p->resizeType == SIZE_MAXIMIZED)
                    maximize = true;
                havePersistedSize = true;
            }
        }
    }

    if (!havePersistedSize)
    {
        // Set size of document window to be 90% of monitor width and height. For the welcome
        // slideshow always set width:height to 16:9 because we know it is that aspect ratio.

        // The welcome slideshow is displayed without decorations.

        // FIXME: Should we actually, at least for text documents, ideally peek into the document and
        // check what its page size is, and in the common case of a portrait orientation text document,
        // make the document window also (if the monitor is large enough) higher than wider? On small
        // monitors (1280x768 or less?) we should probably default to making the document window
        // full-screen?

        // FIXME: My initial assumption that the COOL window would open up on the monitor where the
        // file section dialog was is incorrect.

        MONITORINFO monitorInfo;

        monitorInfo.cbSize = sizeof(monitorInfo);
        if (monitor_of_dialog != NULL && GetMonitorInfoW(monitor_of_dialog, &monitorInfo))
        {
            if (permission == PERMISSION::WELCOME)
            {
                double aspectRatio =
                    (double)(monitorInfo.rcWork.right - monitorInfo.rcWork.left) / (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top);
                if (aspectRatio < 16.0/9.0)
                {
                    width = 0.9 * (monitorInfo.rcWork.right - monitorInfo.rcWork.left);
                    welcomeX = monitorInfo.rcWork.left + 0.05 * (monitorInfo.rcWork.right - monitorInfo.rcWork.left);
                    height = width / (16.0/9.0);
                    welcomeY = monitorInfo.rcWork.top + ((monitorInfo.rcWork.bottom - monitorInfo.rcWork.top) - height) / 2;
                }
                else
                {
                    height = 0.9 * (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top);
                    welcomeY = monitorInfo.rcWork.top + 0.05 * (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top);
                    width = (16.0/9.0) * height;
                    welcomeX = monitorInfo.rcWork.left + ((monitorInfo.rcWork.right - monitorInfo.rcWork.left) - width) / 2;
                }
            }
            else
            {
                width = 0.9 * (monitorInfo.rcWork.right - monitorInfo.rcWork.left);
                height = 0.9 * (monitorInfo.rcWork.bottom - monitorInfo.rcWork.top);
            }
        }
        else
        {
            if (permission == PERMISSION::WELCOME)
            {
                width = 1280;
                height = 720;
            }
            else
            {
                width = 1200;
                height = 900;
            }
        }
    }

    HWND hWnd;
    if (permission == PERMISSION::WELCOME)
        hWnd = CreateWindowW(
            windowClass, Util::string_to_wide_string(APP_NAME).c_str(),
            WS_POPUP, welcomeX, welcomeY, width, height, NULL, NULL, appInstance,
            NULL);
    else
        hWnd = CreateWindowW(
            windowClass, Util::string_to_wide_string(filenameAndUri.filename + " - " APP_NAME).c_str(),
            WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, width, height, NULL, NULL, appInstance,
            NULL);

    auto& data = windowData[hWnd];
    data.hWnd = hWnd;
    data.previousSize.x = width;
    data.previousSize.y = height;
    data.isFullScreen = false;
    data.fakeClientFd = fakeSocketSocket();
    data.appDocId = generate_new_app_doc_id();
    data.lastOwnClipboardModification = 0;
    data.lastAnyonesClipboardModification = 1;
    data.filenameAndUri = filenameAndUri;
    data.permission = permission;

    if (maximize)
        ShowWindow(hWnd, SW_MAXIMIZE);
    else
        ShowWindow(hWnd, appShowMode);
    UpdateWindow(hWnd);

    AddClipboardFormatListener(hWnd);

    CreateCoreWebView2EnvironmentWithOptions(
        nullptr, (Util::string_to_wide_string(localAppData) + L"\\UDF").c_str(), nullptr,
        Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [&data, permission](HRESULT result, ICoreWebView2Environment* env) -> HRESULT
            {
                // Create a CoreWebView2Controller and get the associated CoreWebView2 whose parent is the main window hWnd
                env->CreateCoreWebView2Controller(
                    data.hWnd,
                    Microsoft::WRL::Callback<
                        ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [&data, env, permission](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT
                        {
                            if (!controller)
                                return E_FAIL;

                            ICoreWebView2* webView;
                            controller->get_CoreWebView2(&webView);
                            data.webView = wil::com_ptr<ICoreWebView2>(webView);
                            data.webViewController = controller;

                            // Add a few settings for the webview
                            // The demo step is redundant since the values are the default settings
                            wil::com_ptr<ICoreWebView2Settings> settings;
                            webView->get_Settings(&settings);
                            settings->put_IsScriptEnabled(TRUE);
                            settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                            settings->put_IsWebMessageEnabled(TRUE);

                            // Resize WebView to fit the bounds of the parent window
                            RECT bounds;
                            GetClientRect(data.hWnd, &bounds);
                            data.webViewController->put_Bounds(bounds);

                            EventRegistrationToken token;

                            // Communication between host and web content
                            // Set an event handler for the host to return received message back to the web content
                            webView->add_WebMessageReceived(
                                Microsoft::WRL::Callback<
                                    ICoreWebView2WebMessageReceivedEventHandler>(
                                    [&data](
                                        ICoreWebView2* webView,
                                        ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT
                                    {
                                        wil::unique_cotaskmem_string message;
                                        args->TryGetWebMessageAsString(&message);
                                        processMessage(data, message);
                                        return S_OK;
                                    })
                                    .Get(),
                                &token);

                            webView->add_ContainsFullScreenElementChanged(
                                Microsoft::WRL::Callback<ICoreWebView2ContainsFullScreenElementChangedEventHandler>(
                                    [&data](ICoreWebView2* sender, IUnknown* args) -> HRESULT
                                    {
                                        BOOL containsFullscreenElement;
                                        sender->get_ContainsFullScreenElement(&containsFullscreenElement);
                                        if (containsFullscreenElement)
                                        {
                                            HMONITOR monitor = MonitorFromWindow(data.hWnd, MONITOR_DEFAULTTONEAREST);
                                            enter_full_screen(data, monitor, true);
                                        }
                                        else
                                            leave_full_screen(data);
                                        return S_OK;
                                    })
                                    .Get(),
                                nullptr);

                            // New windows appear to need to reuse the original env of the parent, a good explanation
                            // of use at: https://github.com/MicrosoftEdge/WebView2Feedback/discussions/4501#discussioncomment-9215801
                            webView->add_NewWindowRequested(
                                Microsoft::WRL::Callback<ICoreWebView2NewWindowRequestedEventHandler>(
                                    [env, &data](ICoreWebView2* sender, ICoreWebView2NewWindowRequestedEventArgs* args)
                                    {
                                        wil::com_ptr<ICoreWebView2Deferral> deferral;
                                        args->GetDeferral(&deferral);

                                        data.hConsoleWnd = CreateWindowW(windowClass,
                                                Util::string_to_wide_string(APP_NAME).c_str(),
                                                WS_OVERLAPPEDWINDOW,
                                                CW_USEDEFAULT, CW_USEDEFAULT,
                                                800, 640, NULL, NULL, appInstance, NULL);

                                        auto& consoleData = windowData[data.hConsoleWnd];
                                        consoleData.hWnd = data.hConsoleWnd;
                                        consoleData.hParentWnd = data.hWnd;
                                        consoleData.isConsole = true;
                                        consoleData.previousSize.x = 800;
                                        consoleData.previousSize.y = 640;

                                        ShowWindow(data.hConsoleWnd, appShowMode);

                                        env->CreateCoreWebView2Controller(
                                            data.hConsoleWnd,
                                            Microsoft::WRL::Callback<
                                                ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                                                [&consoleData, &data, args, deferral](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT
                                                {
                                                    if (!controller)
                                                        return E_FAIL;

                                                    ICoreWebView2* webView;
                                                    controller->get_CoreWebView2(&webView);
                                                    consoleData.webView = wil::com_ptr<ICoreWebView2>(webView);

                                                    webView->add_WindowCloseRequested(
                                                        Microsoft::WRL::Callback<ICoreWebView2WindowCloseRequestedEventHandler>(
                                                            [&consoleData](ICoreWebView2* sender, IUnknown* args)
                                                            {
                                                                PostMessageW(consoleData.hWnd, WM_CLOSE, 0, 0);
                                                                return S_OK;
                                                            })
                                                            .Get(),
                                                        nullptr);

                                                    controller->put_IsVisible(TRUE);

                                                    consoleData.webViewController = controller;

                                                    // Resize WebView to fit the bounds of the parent window
                                                    RECT bounds;
                                                    GetClientRect(consoleData.hWnd, &bounds);
                                                    controller->put_Bounds(bounds);

                                                    args->put_NewWindow(consoleData.webView.get());
                                                    args->put_Handled(TRUE);
                                                    deferral->Complete();

                                                    arrangePresentationWindows(data);

                                                    return S_OK;
                                                })
                                                .Get());
                                            return S_OK;

                                        return S_OK;
                                    })
                                    .Get(),
                                nullptr);

                            const std::string coolURL =
                                app_installation_uri +
                                std::string("../cool/cool.html?file_path=") + data.filenameAndUri.uri +
                                std::string("&permission=edit") +
                                std::string("&lang=") + uiLanguage +
                                std::string("&appdocid=") + std::to_string(data.appDocId) +
                                std::string("&userinterfacemode=notebookbar"
                                            "&dir=ltr") +
                                (isLightTheme() ? "" : "&darkTheme=true") +
                                (permission == PERMISSION::NEW_DOCUMENT ? "&isnewdocument=true" : "") +
                                (permission == PERMISSION::WELCOME ? "&welcome=true" : "");

                            webView->Navigate(Util::string_to_wide_string(coolURL).c_str());
                            controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);

                            return S_OK;
                        })
                        .Get());
                return S_OK;
            })
            .Get());
}

static void processMessage(WindowData& data, wil::unique_cotaskmem_string& message)
{
    std::wstring s(message.get());
    LOG_TRC(Util::wide_string_to_string(s));
    if (s.starts_with(L"MSG "))
    {
        s = s.substr(4);
        if (s == L"HULLO")
        {
            do_hullo_handling_things(data);
        }
        else if (s == L"WELCOME")
        {
            do_welcome_handling_things(data);
        }
        else if (s == L"BYE")
        {
            do_bye_handling_things(data);
        }
        else if (s == L"PRINT")
        {
            do_print(data.appDocId);
        }
        else if (s == L"CUT")
        {
            do_cut_or_copy(ClipboardOp::CUT, data);
        }
        else if (s == L"COPY" || s == L"CLIPBOARDWRITE")
        {
            do_cut_or_copy(ClipboardOp::COPY, data);
        }
        else if (s == L"PASTE")
        {
            do_paste_or_read(ClipboardOp::PASTE, data);
        }
        else if (s == L"PASTEUNFORMATTED")
        {
            do_paste_or_read(ClipboardOp::PASTEUNFORMATTED, data);
        }
        else if (s == L"CLIPBOARDREAD")
        {
            do_paste_or_read(ClipboardOp::READ, data);
        }
        else if (s.starts_with(L"CLIPBOARDSET "))
        {
            do_clipboard_set(data.appDocId, Util::wide_string_to_string(s.substr(13)).c_str());
        }
        else if (s.starts_with(L"HYPERLINK "))
        {
            do_open_hyperlink(data.hWnd, s.substr(10));
        }
        else if (s == L"LICENSE")
        {
            std::wstring licensePath = Util::string_to_wide_string(app_installation_path + "..\\LICENSE.html");
            ShellExecuteW(nullptr, L"open", licensePath.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        }
        else if (s == L"EXCHANGEMONITORS")
        {
            exchangeMonitors(data);
        }
        else if (s.starts_with(L"downloadas "))
        {
            // "downloadas name=document.rtf id=export format=rtf options="
            auto const ns = Util::wide_string_to_string(s);
            auto const tokens = StringVector::tokenize(ns);
            std::string name;
            if (!COOLProtocol::getTokenString(tokens, "name", name))
            {
                LOG_ERR("No name parameter in message '" << ns << "'");
                return;
            }
            auto dot = name.find_last_of('.');
            if (dot == std::string::npos || dot == name.length() - 1)
            {
                LOG_ERR("No file name extension in '" << ns << "'");
                return;
            }
            auto const extension = name.substr(dot + 1);
            auto const basename = data.filenameAndUri.filename.substr(
                0, data.filenameAndUri.filename.find_last_of('.'));
            auto filenameAndUri = fileSaveDialog(basename + "." + extension, "", extension);

            if (filenameAndUri.filename != "")
                DocumentData::get(data.appDocId).loKitDocument->saveAs(filenameAndUri.uri.c_str(), extension.c_str(), nullptr);
        }
        else if (s == L"uno .uno:Open")
        {
            auto openResult = fileOpenDialog();
            if (openResult.filenamesAndUris.size() > 0)
            {
                if (openResult.createdNew)
                {
                    openCOOLWindow(openResult.filenamesAndUris[0], PERMISSION::NEW_DOCUMENT);
                }
                else
                {
                    for (const auto& i: openResult.filenamesAndUris)
                        filenamesAndUrisToOpen.push_back(i);

                    load_next_document();
                }
            }
        }
        else if (s == L"uno .uno:CloseWin")
        {
            PostMessageW(data.hWnd, WM_CLOSE, 0, 0);
        }
        else if (s.starts_with(L"newdoc type="))
        {
            s = s.substr(12);
            CODA_OPEN_CONTROL id;
            if (s == L"writer")
                id = CODA_OPEN_CONTROL::NEW_TEXT;
            else if (s == L"calc")
                id = CODA_OPEN_CONTROL::NEW_SPREADSHEET;
            else if (s == L"impress")
                id = CODA_OPEN_CONTROL::NEW_PRESENTATION;
            else
                fatal("Unexpected type in newdoc message");
            auto path = Poco::Path(Util::wide_string_to_string(new_document(id)));
            openCOOLWindow({ path.getFileName(), Poco::URI(path).toString() }, PERMISSION::NEW_DOCUMENT);
        }
        else
        {
            do_other_message_handling_things(data, Util::wide_string_to_string(s).c_str());
        }
    }
    else if (s.starts_with(L"ERR "))
    {
        LOG_ERR("From JS: " + Util::wide_string_to_string(s));
    }
    else if (s.starts_with(L"DBG "))
    {
        LOG_DBG("From JS: " + Util::wide_string_to_string(s));
    }
}

extern "C" BOOLEAN WINAPI GetUserNameExW(
    ULONG NameFormat,   // EXTENDED_NAME_FORMAT underlying type
    LPWSTR lpNameBuffer,
    PULONG nSize
);

static const char* getUserName()
{
    static wchar_t buffer[256];
    static std::string userNameStorage;
    DWORD size = sizeof(buffer) / sizeof(wchar_t);

    // Try full display name
    if (GetUserNameExW(3 /* NameDisplay */, buffer, &size)) {
        if (buffer[0] != L'\0') {
            userNameStorage = Util::wide_string_to_string(std::wstring(buffer));
            return userNameStorage.c_str();
        }
    }

    // Reset size before next call
    size = sizeof(buffer) / sizeof(wchar_t);

    // Fallback: login name
    if (GetUserNameW(buffer, &size)) {
        if (buffer[0] != L'\0') {
            userNameStorage = Util::wide_string_to_string(std::wstring(buffer));
            return userNameStorage.c_str();
        }
    }

    return nullptr;
}

int APIENTRY wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR, int showWindowMode)
{
    appInstance = hInstance;
    appShowMode = showWindowMode;

    user_name = getUserName();

    wchar_t fileName[1000];
    GetModuleFileNameW(NULL, fileName, sizeof(fileName) / sizeof(fileName[0]));
    app_installation_path = app_exe_path = Util::wide_string_to_string(std::wstring(fileName));
    app_installation_path.resize(app_installation_path.find_last_of(L'\\') + 1);
    app_installation_uri = Poco::URI(Poco::Path(app_installation_path)).toString();

    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    appName = Util::string_to_wide_string(APP_NAME);

    if (!SUCCEEDED(CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE)))
        fatal("CoInitializeEx() failed");

    PWSTR appDataFolder;
    SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, NULL, &appDataFolder);
    localAppData = Util::wide_string_to_string(std::wstring(appDataFolder) + L"\\" + appName);
    CoTaskMemFree(appDataFolder);

    // A "LANG" environment variable is not a thing on Windows, but check
    // for a such anyway, for easier testing.
    auto langEnv = std::getenv("LANG");

    wchar_t bcp47[LOCALE_NAME_MAX_LENGTH];

    if (langEnv)
        uiLanguage = langEnv;
    else if (LCIDToLocaleName(MAKELCID(GetUserDefaultUILanguage(), SORT_DEFAULT),
                              bcp47, LOCALE_NAME_MAX_LENGTH, 0))
        uiLanguage = Util::wide_string_to_string(bcp47);

    // Allow overriding log level in the debugger. Note that logging *always* goes just to
    // OutputDebugString() if running under a debugger. Never to stderr or stdout.
    const char* loglevel = std::getenv("CODA_LOGLEVEL");
    // COOLWSD_LOGLEVEL comes from the project file and differs for Debug and Release builds.
    if (!loglevel)
        loglevel = COOLWSD_LOGLEVEL;
    Log::initialize("CODA", loglevel);
    Util::setThreadName("main");

    persistentWindowSizeStoreOK =
        (persistentWindowSizeStore.open
         (Util::string_to_wide_string(localAppData +
                                      "\\persistentWindowSizes")) == litecask::Status::Ok);

    // Create a dummy hidden owner window so that the file open dialog can inherit its icon for the
    // task switcher (Alt-Tab) from it.

    {
        WNDCLASSEXW wcex;

        wcex.cbSize = sizeof(WNDCLASSEXW);
        wcex.style = 0;
        wcex.lpfnWndProc = DefWindowProc;
        wcex.cbClsExtra = 0;
        wcex.cbWndExtra = 0;
        wcex.hInstance = hInstance;
        wcex.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_CODA));
        wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
        wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
        wcex.lpszMenuName = NULL;
        wcex.lpszClassName = dummyWindowClass;
        wcex.hIconSm = NULL;

        if (!RegisterClassExW(&wcex))
        {
            MessageBoxW(NULL, L"Call to RegisterClassExW failed", Util::string_to_wide_string(APP_NAME).c_str(), NULL);
            return 1;
        }

        hiddenOwnerWindow = CreateWindowW(dummyWindowClass, L"CODAHiddenOwnerWindow",
                                          WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT,
                                          100, 100, NULL, NULL,
                                          hInstance, NULL);
        ShowWindow(hiddenOwnerWindow, SW_HIDE);
    }

    PERMISSION permission = PERMISSION::EDIT;
    if (__argc == 1 || wcscmp(__wargv[1], L"--disable-background-networking") == 0)
    {
        auto openResult = fileOpenDialog();
        // If initial dialog is cancelled, just quit
        if (openResult.filenamesAndUris.size() == 0)
            std::exit(0);

        if (openResult.createdNew)
            permission = PERMISSION::NEW_DOCUMENT;

        for (auto const& i: openResult.filenamesAndUris)
            filenamesAndUrisToOpen.push_back(i);
    }
    else
    {
        for (int i = 1; i < __argc; i++)
        {
            auto path = Poco::Path(Util::wide_string_to_string(__wargv[i]));
            filenamesAndUrisToOpen.push_back({ path.getFileName(), Poco::URI(path).toString() });
        }
    }

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    coolwsdThread = std::thread(
        []
        {
            assert(coolwsd == nullptr);
            char* argv[2];
            // Yes, strdup() is apparently not standard, so MS wants you to call it as
            // _strdup(), and warns if you call strdup(). Sure, we could just silence such
            // warnings, but let's try to do as they want.
            argv[0] = _strdup("mobile");
            argv[1] = nullptr;
            Util::setThreadName("app");
            while (true)
            {
                coolwsd = new COOLWSD();
                coolwsd->run(1, argv);
                delete coolwsd;
                LOG_TRC("One run of COOLWSD completed");
            }
        });

    {
        WNDCLASSEXW wcex;

        wcex.cbSize = sizeof(WNDCLASSEXW);
        wcex.style = CS_HREDRAW | CS_VREDRAW;
        wcex.lpfnWndProc = WndProc;
        wcex.cbClsExtra = 0;
        wcex.cbWndExtra = 0;
        wcex.hInstance = hInstance;
        wcex.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_CODA));
        wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
        wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
        wcex.lpszMenuName = NULL;
        wcex.lpszClassName = windowClass;
        wcex.hIconSm = NULL;

        if (!RegisterClassExW(&wcex))
        {
            MessageBoxW(NULL, L"Call to RegisterClassExW failed", Util::string_to_wide_string(APP_NAME).c_str(), NULL);
            return 1;
        }
   }

    currentFileToOpenIndex = 0;

    // Open the first document here, then open the rest one by one once the previous has loaded.
    openCOOLWindow(filenamesAndUrisToOpen[0], permission);

    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return (int)msg.wParam;
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
