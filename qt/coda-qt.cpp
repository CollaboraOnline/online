/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include "bridge.hpp"
#include "COOLWSD.hpp"
#include "FakeSocket.hpp"
#include "Log.hpp"
#include "MobileApp.hpp"
#include "Clipboard.hpp"
#include "Protocol.hpp"
#include "Util.hpp"
#include "FileUtil.hpp"
#include "qt.hpp"
#include "DBusService.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/JSON/Parser.h>
#include <Poco/JSON/Object.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/Path.h>
#include <Poco/URI.h>

#include <QApplication>
#include <QByteArray>
#include <QCheckBox>
#include <QClipboard>
#include <QComboBox>
#include <QCommandLineOption>
#include <QCommandLineParser>
#include <QDBusInterface>
#include <QDBusReply>
#include <QDesktopServices>
#include <QDialog>
#include <QDir>
#include <QFileDialog>
#include <QFileInfo>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QLocale>
#include <QMainWindow>
#include <QMessageBox>
#include <QMetaObject>
#include <QMimeData>
#include <QObject>
#include <QPrinterInfo>
#include <QProcess>
#include <QPushButton>
#include <QStandardPaths>
#include <QString>
#include <QThread>
#include <QTimer>
#include <QTranslator>
#include <QUrl>
#include <QVBoxLayout>
#include <QVariantMap>
#include <QWebChannel>
#include <QWebEngineProfile>
#include <QWebEngineView>

#include <algorithm>
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <poll.h>
#include <pwd.h>
#include <sstream>
#include <string>
#include <thread>
#include <unistd.h>
#include "WebView.hpp"

const char* user_name = nullptr;

const int SHOW_JS_MAXLEN = 300;

int coolwsd_server_socket_fd = -1;
static COOLWSD* coolwsd = nullptr;
static std::thread coolwsdThread;
QWebEngineProfile* Application::globalProfile = nullptr;

static const char* getUserName()
{
    static QByteArray storage;
    storage.clear();

    QDBusInterface iface(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Accounts",
        QDBusConnection::sessionBus()
    );

    QDBusReply<QVariantMap> reply = iface.call("GetUserInformation");

    if (reply.isValid()) {
        QVariantMap map = reply.value();

        QString realName = map.value("realName").toString();
        QString userName = map.value("userName").toString();

        QString chosen;
        if (!realName.isEmpty())
            chosen = realName;
        else if (!userName.isEmpty())
            chosen = userName;

        if (!chosen.isEmpty()) {
            storage = chosen.toUtf8();
            return storage.constData();
        }
    }

    // fallback to /etc/passwd

    struct passwd *pw = getpwuid(getuid());
    if (pw) {
        if (pw->pw_gecos && pw->pw_gecos[0] != '\0') {
            QString gecos = QString::fromLocal8Bit(pw->pw_gecos);
            QString full = gecos.section(',', 0, 0);

            if (!full.isEmpty()) {
                storage = full.toUtf8();
                return storage.constData();
            }
        }

        // fallback to Linux username
        storage = QByteArray(pw->pw_name);
        return storage.constData();
    }

    return nullptr;
}

static void getClipboard(unsigned appDocId)
{
    std::unique_ptr<QMimeData> mimeData(new QMimeData());

    lok::Document* loKitDoc = DocumentData::get(appDocId).loKitDocument;
    if (!loKitDoc)
    {
        LOG_DBG("Couldn't get the loKitDocument in getClipboardInternal");
        return;
    }

    const char** mimeTypes = nullptr;
    size_t outCount = 0;
    char** outMimeTypes = nullptr;
    size_t* outSizes = nullptr;
    char** outStreams = nullptr;

    if (!loKitDoc->getClipboard(mimeTypes, &outCount, &outMimeTypes, &outSizes, &outStreams))
    {
        LOG_DBG("Failed to fetch mime-types in getClipboardInternal");
        return;
    }

    if (outCount == 0)
        return;

    for (size_t i = 0; i < outCount; ++i)
    {
        QString mimeType = QString::fromUtf8(outMimeTypes[i]);
        QByteArray byteData(outStreams[i], static_cast<int>(outSizes[i]));

        if (mimeType == "text/plain")
        {
            QString text = QString::fromUtf8(byteData);
            mimeData->setText(text);
        }
        else if (mimeType.startsWith("image/"))
        {
            QImage image;
            image.loadFromData(byteData);
            if (!image.isNull())
                mimeData->setImageData(image);
        }

        // Always include raw data as well
        mimeData->setData(mimeType, byteData);
    }

    // Set the mime data to the system clipboard
    QClipboard* clipboard = QGuiApplication::clipboard();
    clipboard->setMimeData(mimeData.release());
}

static void setClipboard(unsigned appDocId)
{
    QClipboard* clipboard = QApplication::clipboard();
    if (!clipboard)
        return;

    const QString qText = clipboard->text(QClipboard::Clipboard);
    if (qText.isEmpty())
        return;

    QByteArray utf8Text = qText.toUtf8();

    const char* mimeTypes[] = { "text/plain;charset=utf-8" };
    const size_t sizes[] = { static_cast<size_t>(utf8Text.size()) };
    const char* streams[] = { utf8Text.constData() };

    DocumentData::get(appDocId).loKitDocument->setClipboard(1, mimeTypes, sizes, streams);
}

static void setClipboardFromContent(unsigned appDocId, const std::string& content)
{
    std::vector<const char*> streams;
    std::vector<const char*> mimeTypes;
    std::vector<size_t> sizes;
    ClipboardData data;

    if (content.rfind("<!DOCTYPE html>", 0) == 0) // prefix test
    {
        streams.push_back(content.data());
        mimeTypes.push_back("text/html");
        sizes.push_back(content.length());
    }
    else
    {
        Poco::MemoryInputStream mis(content.data(), content.size());

        data.read(mis); // parses into _content / _mimeTypes

        const size_t n = data.size();
        streams.reserve(n);
        mimeTypes.reserve(n);
        sizes.reserve(n);

        for (size_t i = 0; i < n; ++i)
        {
            streams.push_back(data._content[i].c_str());
            mimeTypes.push_back(data._mimeTypes[i].c_str());
            sizes.push_back(data._content[i].length());
        }
    }

    if (!streams.empty())
    {
        DocumentData::get(appDocId).loKitDocument->setClipboard(streams.size(), mimeTypes.data(),
                                                                sizes.data(), streams.data());
    }
}

static void printDocument(unsigned appDocId, QWidget* parent = nullptr)
{
    // Create a temporary PDF file for printing
    const std::string tempFile = FileUtil::createRandomTmpDir() + "/print.pdf";
    const std::string tempFileUri = Poco::URI(Poco::Path(tempFile)).toString();

    lok::Document* loKitDoc = DocumentData::get(appDocId).loKitDocument;
    if (!loKitDoc)
    {
        LOG_ERR("printDocument: no loKitDocument");
        return;
    }

    loKitDoc->saveAs(tempFileUri.c_str(), "pdf", nullptr);

    // Verify the PDF was created
    struct stat st;
    if (FileUtil::getStatOfFile(tempFile, st) != 0)
    {
        LOG_ERR("printDocument: failed to create PDF file: " << tempFile);
        return;
    }

    // Create a simple custom print dialog, qt's print dialog is overkill for now.
    QDialog customPrintDialog(parent);
    customPrintDialog.setWindowTitle(QObject::tr("Print Document"));
    customPrintDialog.setModal(true);
    customPrintDialog.resize(400, 200);

    QVBoxLayout* layout = new QVBoxLayout(&customPrintDialog);

    // Printer selection
    QLabel* printerLabel = new QLabel(QObject::tr("Select Printer:"), &customPrintDialog);
    layout->addWidget(printerLabel);

    QComboBox* printerCombo = new QComboBox(&customPrintDialog);
    // Get available printers
    QStringList printers = QPrinterInfo::availablePrinterNames();
    printerCombo->addItems(printers);
    if (printers.isEmpty())
    {
        printerCombo->addItem(QObject::tr("Default Printer"));
    }
    layout->addWidget(printerCombo);

    // Print to file option
    QCheckBox* printToFileCheck = new QCheckBox(QObject::tr("Print to File"), &customPrintDialog);
    layout->addWidget(printToFileCheck);

    QLineEdit* filePathEdit = new QLineEdit(&customPrintDialog);
    filePathEdit->setPlaceholderText(QObject::tr("Enter file path..."));
    filePathEdit->setEnabled(false);
    layout->addWidget(filePathEdit);

    // Connect print to file checkbox
    QObject::connect(printToFileCheck, &QCheckBox::toggled,
                     [filePathEdit](bool checked)
                     {
                         filePathEdit->setEnabled(checked);
                         if (checked)
                         {
                             QString fileName = QFileDialog::getSaveFileName(
                                 filePathEdit, QObject::tr("Save Print Output As"),
                                 QDir::home().filePath("document.pdf"),
                                 QObject::tr("PDF Files (*.pdf);;All Files (*)"));
                             if (!fileName.isEmpty())
                             {
                                 filePathEdit->setText(fileName);
                             }
                         }
                     });

    // Buttons
    QHBoxLayout* buttonLayout = new QHBoxLayout();
    QPushButton* printButton = new QPushButton(QObject::tr("Print"), &customPrintDialog);
    QPushButton* cancelButton = new QPushButton(QObject::tr("Cancel"), &customPrintDialog);
    buttonLayout->addWidget(printButton);
    buttonLayout->addWidget(cancelButton);
    layout->addLayout(buttonLayout);

    // Connect buttons
    QObject::connect(printButton, &QPushButton::clicked, &customPrintDialog, &QDialog::accept);
    QObject::connect(cancelButton, &QPushButton::clicked, &customPrintDialog, &QDialog::reject);

    if (customPrintDialog.exec() == QDialog::Accepted)
    {
        // Check if user selected "Print to File"
        if (printToFileCheck->isChecked() && !filePathEdit->text().isEmpty())
        {
            QString outputFile = filePathEdit->text();
            LOG_INF("printDocument: User selected print to file: " << outputFile.toStdString());

            if (FileUtil::copyAtomic(tempFile, outputFile.toStdString(), false))
            {
                LOG_INF(
                    "printDocument: PDF successfully saved to file: " << outputFile.toStdString());
            }
            else
            {
                LOG_ERR("printDocument: Failed to copy PDF to file: " << outputFile.toStdString());
                QMessageBox::warning(parent, QObject::tr("Print to File Error"),
                                     QObject::tr("Failed to save document to file. Please check "
                                                 "the file path and permissions."));
            }
        }
        else
        {
            // User selected a physical printer - print using system commands
            QString printerName = printerCombo->currentText();
            if (printerName == QObject::tr("Default Printer"))
            {
                printerName = "";
            }

            // Print the PDF using system command with the selected printer
            std::string printCmd;
            if (!printerName.isEmpty())
            {
                printCmd = "lp -d \"" + printerName.toStdString() + "\" \"" + tempFile + "\"";
            }
            else
            {
                printCmd = "lp \"" + tempFile + "\"";
            }

            int result = std::system(printCmd.c_str());

            if (result != 0)
            {
                // Fallback to lpr with printer name
                if (!printerName.isEmpty())
                {
                    printCmd = "lpr -P \"" + printerName.toStdString() + "\" \"" + tempFile + "\"";
                }
                else
                {
                    printCmd = "lpr \"" + tempFile + "\"";
                }
                result = std::system(printCmd.c_str());

                if (result != 0)
                {
                    LOG_ERR(
                        "printDocument: failed to print PDF. Tried both 'lp' and 'lpr' commands");
                    QMessageBox::warning(
                        parent, QObject::tr("Print Error"),
                        QObject::tr(
                            "Failed to print document. Please check your printer settings."));
                }
                else
                {
                    LOG_INF("printDocument: PDF sent to printer '" << printerName.toStdString()
                                                                   << "' using 'lpr'");
                }
            }
            else
            {
                LOG_INF("printDocument: PDF sent to printer '" << printerName.toStdString()
                                                               << "' using 'lp'");
            }
        }
    }
    else
    {
        LOG_INF("printDocument: Print cancelled by user");
    }

    // Clean up the temporary file
    FileUtil::unlinkFile(tempFile);
}

Bridge::~Bridge() {
    if (_document._fakeClientFd != -1) {
        fakeSocketClose(_document._fakeClientFd);
    }
    if (_app2js.joinable()) {
        fakeSocketClose(_closeNotificationPipeForForwardingThread[0]);
        _app2js.join();
    }
}

void Bridge::evalJS(const std::string& script)
{
    // Ensure execution on GUI thread – queued if needed
    QMetaObject::invokeMethod(
        // TODO: fix needless `this` captures...
        _webView, [this, script]
        { _webView->page()->runJavaScript(QString::fromStdString(script)); },
        Qt::QueuedConnection);
}

void Bridge::send2JS(const std::vector<char>& buffer)
{
    if (buffer.empty())
        return;

    const std::string_view bufferView(buffer.data(), buffer.size());

    LOG_TRC_NOFILE(
        "Send to JS: " << COOLProtocol::getAbbreviatedMessage(bufferView.data(), bufferView.size()));

    // Determine if message is of a binary type
    bool binaryMessage = std::any_of(
        std::begin(COOLProtocol::binaryMessageTypes),
        std::end(COOLProtocol::binaryMessageTypes),
        [&](const char* type) {
            return bufferView.starts_with(type);
        }
    );

    QByteArray base64 = QByteArray(bufferView.data(), bufferView.size()).toBase64();

    std::string pretext = binaryMessage
                              ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
                              : "window.TheFakeWebSocket.onmessage({'data': window.b64d('";
    const std::string posttext = "')});";

    std::string js = pretext + base64.toStdString() + posttext;

    std::string subjs = js.substr(0, std::min<std::string::size_type>(SHOW_JS_MAXLEN, js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";
    LOG_TRC_NOFILE("Evaluating JavaScript: " << subjs);

    evalJS(js);
}

void Bridge::debug(const QString& msg) { LOG_TRC_NOFILE("From JS: debug: " << msg.toStdString()); }

void Bridge::error(const QString& msg) { LOG_TRC_NOFILE("From JS: error: " << msg.toStdString()); }

namespace
{
    // Helper to extract JSON object from message (finds '{' and parses from there)
    Poco::JSON::Object::Ptr parseJsonFromMessage(const std::string& message, size_t prefixLen)
    {
        std::string jsonPart = message.substr(prefixLen);
        size_t jsonStart = jsonPart.find('{');
        if (jsonStart == std::string::npos)
            return nullptr;

        jsonPart = jsonPart.substr(jsonStart);
        try
        {
            Poco::JSON::Parser parser;
            Poco::Dynamic::Var result = parser.parse(jsonPart);
            return result.extract<Poco::JSON::Object::Ptr>();
        }
        catch (const std::exception& e)
        {
            LOG_ERR("Failed to parse JSON: " << e.what());
            return nullptr;
        }
    }

} // namespace

std::string Bridge::promptSaveLocation()
{
    // Prompt user to pick a save location
    const QUrl docUrl(QString::fromStdString(
        !_document._saveLocationURI.empty()
            ? _document._saveLocationURI.toString()
            : _document._fileURL.toString()));
    const QString docPath = docUrl.isLocalFile() ? docUrl.toLocalFile() : docUrl.toString();
    const QFileInfo docInfo(docPath);
    QString baseName = docInfo.completeBaseName().isEmpty()
                         ? QStringLiteral("document")
                         : docInfo.completeBaseName();

    // Determine file extension from document type
    QString extension;
    lok::Document* loKitDoc = DocumentData::get(_document._appDocId).loKitDocument;
    if (loKitDoc)
    {
        const int docType = loKitDoc->getDocumentType();
        switch (docType)
        {
            case LOK_DOCTYPE_TEXT:
                extension = "odt";
                break;
            case LOK_DOCTYPE_SPREADSHEET:
                extension = "ods";
                break;
            case LOK_DOCTYPE_PRESENTATION:
                extension = "odp";
                break;
            case LOK_DOCTYPE_DRAWING:
                extension = "odg";
                break;
            default:
                break;
        }
    }

    QString suggestedName = baseName + (extension.isEmpty() ? "" : "." + extension);

    QString fileFilter;
    if (extension == "odt")
        fileFilter = QObject::tr("Text Documents (*.odt);;All Files (*)");
    else if (extension == "ods")
        fileFilter = QObject::tr("Spreadsheets (*.ods);;All Files (*)");
    else if (extension == "odp")
        fileFilter = QObject::tr("Presentations (*.odp);;All Files (*)");
    else
        fileFilter = QObject::tr("All Files (*)");

    const QString destPath = QFileDialog::getSaveFileName(
        _webView,
        QObject::tr("Save Document"),
        QDir::home().filePath(suggestedName),
        fileFilter);

    if (destPath.isEmpty())
    {
        LOG_INF("Save cancelled by user");
        return {};
    }

    return destPath.toStdString();
}

bool Bridge::saveDocument(const std::string& savePath)
{
    const std::string tempPath = Poco::Path(_document._fileURL.getPath()).toString();

    if (FileUtil::copyAtomic(tempPath, savePath, false))
    {
        LOG_INF("Successfully saved file to location: " << savePath);
        return true;
    }
    else
    {
        LOG_ERR("Failed to copy temp file to location: " << savePath);
        return false;
    }
}

bool Bridge::saveDocumentAs()
{
    std::string savePath = promptSaveLocation();
    if (savePath.empty())
        return false;

    // Update saveLocationURI for future saves
    _document._saveLocationURI = Poco::URI(Poco::Path(savePath));

    // Update document name in the WebView UI
    QString fileName = QString::fromStdString(Poco::Path(savePath).getFileName());
    if (!fileName.isEmpty())
    {
        QString applicationTitle = fileName + " - " APP_NAME;
        QApplication::setApplicationName(applicationTitle);

        // Update file name in window title
        if (_webView && _webView->window())
            _webView->window()->setWindowTitle(applicationTitle);
    }

    return saveDocument(savePath);
}

QVariant Bridge::cool(const QString& messageStr)
{
    constexpr std::string_view CLIPBOARDSET = "CLIPBOARDSET ";
    constexpr std::string_view DOWNLOADAS = "downloadas ";
    constexpr std::string_view HYPERLINK = "HYPERLINK ";
    constexpr std::string_view COMMANDSTATECHANGED = "COMMANDSTATECHANGED ";
    constexpr std::string_view COMMANDRESULT = "COMMANDRESULT ";
    constexpr std::string_view NEWDOCTYPE = "newdoc type=";

    const std::string message = messageStr.toStdString();
    LOG_TRC_NOFILE("From JS: cool: " << message);

    if (message == "HULLO")
    {
        // JS side fully initialised – open our fake WebSocket to COOLWSD
        assert(coolwsd_server_socket_fd != -1);
        int rc = fakeSocketConnect(_document._fakeClientFd, coolwsd_server_socket_fd);
        assert(rc != -1);

        fakeSocketPipe2(_closeNotificationPipeForForwardingThread);

        // Thread pumping Online → JS
        assert(!_app2js.joinable());
        _app2js = std::thread(
            [this]
            {
                Util::setThreadName("app2js");
                bool unexpectedClose = false;
                while (true)
                {
                    struct pollfd pfd[2];
                    pfd[0].fd = _document._fakeClientFd;
                    pfd[0].events = POLLIN;
                    pfd[1].fd = _closeNotificationPipeForForwardingThread[1];
                    pfd[1].events = POLLIN;
                    if (fakeSocketPoll(pfd, 2, -1) > 0)
                    {
                        if (pfd[1].revents & POLLIN)
                        {
                            break; // document closed
                        }
                        if (pfd[0].revents & POLLIN)
                        {
                            int n = fakeSocketAvailableDataLength(_document._fakeClientFd);
                            if (n == 0)
                            {
                                LOG_TRC("Socket closed #" << _document._fakeClientFd);
                                unexpectedClose = true;
                                break;
                            }
                            std::vector<char> buf(n);
                            fakeSocketRead(_document._fakeClientFd, buf.data(), n);
                            send2JS(buf);
                        }
                        if (pfd[0].revents & POLLERR)
                        {
                            LOG_TRC("Socket error #" << _document._fakeClientFd);
                            unexpectedClose = true;
                            break;
                        }
                    }
                }
                LOG_TRC("Closing message pump thread");
                fakeSocketClose(_closeNotificationPipeForForwardingThread[1]);
                fakeSocketClose(_document._fakeClientFd);
                if (unexpectedClose) {
                    LOG_WRN("Unexpected closing of message pump thread; closing window now");
                    QMetaObject::invokeMethod(_window, "close", Qt::QueuedConnection);
                }
            });

        // 1st request: the initial GET /?file_path=...  (mimic WebSocket upgrade)
        std::string message(_document._fileURL.toString() +
                            (" " + std::to_string(_document._appDocId)));
        fakeSocketWriteQueue(_document._fakeClientFd, message.c_str(), message.size());
    }
    else if (message == "WELCOME")
    {
        const std::string welcomePath = getTopSrcDir(TOPSRCDIR) + "/browser/dist/welcome/welcome-slideshow.odp";
        struct stat st;
        if (FileUtil::getStatOfFile(welcomePath, st) == 0)
        {
            Poco::URI fileURL{Poco::Path(welcomePath)};
            QTimer::singleShot(0, [fileURL]() {
                WebView* webViewInstance = new WebView(Application::getProfile(), /*isWelcome*/ true);
                webViewInstance->load(fileURL);
            });
            LOG_TRC_NOFILE("Opening welcome slideshow: " << welcomePath);
        }
        else
        {
            LOG_TRC_NOFILE("Welcome slideshow not found at: " << welcomePath);
        }
    }
    else if (message.starts_with(COMMANDSTATECHANGED))
    {
        const auto object = parseJsonFromMessage(message, COMMANDSTATECHANGED.size());
        if (!object)
            return {};

        const std::string commandName = object->get("commandName").toString();
        if (commandName != ".uno:ModifiedStatus")
            return {};

        const bool isModified = (object->get("state").toString() == "true");
        LOG_TRC_NOFILE("Document modified status changed: " << (isModified ? "modified" : "unmodified"));
        // Could store this in DocumentData for future use and prompt on exit if they want to save.
        // or maybe better of to do all that as well in JavaScript where the info should be available anyways.
    }
    else if (message.starts_with(COMMANDRESULT))
    {
        const auto object = parseJsonFromMessage(message, COMMANDRESULT.size());
        if (!object)
            return {};

        const std::string commandName = object->get("commandName").toString();
        const bool success = object->get("success").convert<bool>();
        const bool wasModified = object->get("wasModified").convert<bool>();

        // Only handle successful .uno:Save commands that modified the document
        if (commandName != ".uno:Save" || !success || !wasModified)
            return {};

        // Early return if the file is opened in-place (e.g. welcome slideshow)
        if (_document._fileURL == _document._saveLocationURI)
            return {};

        if (_document._saveLocationURI.empty())
        {
            saveDocumentAs();
        }
        else
        {
            const std::string savePath = Poco::Path(_document._saveLocationURI.getPath()).toString();
            saveDocument(savePath);
        }
    }
    else if (message == "BYE")
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side → closing fake socket");
        fakeSocketClose(_closeNotificationPipeForForwardingThread[0]);

        // Clean up temporary directory if there was one
        if (_document._fileURL != _document._saveLocationURI)
        {
            const std::string tempDirectoryPath = Poco::Path(_document._fileURL.getPath()).parent().toString();
            FileUtil::removeFile(tempDirectoryPath, true);
            LOG_INF("Cleaned up temporary directory: " << tempDirectoryPath);
        }

        QTimer::singleShot(0, [this]() {
            if (_webView)
            {
                QWidget* topLevel = _webView->window();
                if (topLevel)
                {
                    LOG_INF("Closing document window");
                    topLevel->hide();
                    topLevel->close();
                    topLevel->deleteLater();
                }
            }
        });
    }
    else if (message == "CLIPBOARDWRITE")
    {
        getClipboard(_document._appDocId);
    }
    else if (message == "CLIPBOARDREAD")
    {
        // WARN: this is only cargo-culted and not tested yet.
        setClipboard(_document._appDocId);
        return "(internal)";
    }
    else if (message.starts_with(CLIPBOARDSET))
    {
        std::string content = message.substr(CLIPBOARDSET.size());
        setClipboardFromContent(_document._appDocId, content);
    }
    else if (message == "uno .uno:Open")
    {
        QFileDialog* dialog = new QFileDialog(
            _webView, QObject::tr("Open File"), QString(),
            QObject::tr("All Files (*);;"
                        "Text Documents (*.odt *.ott *.doc *.docx *.rtf *.txt);;"
                        "Spreadsheets (*.ods *.ots *.xls *.xlsx *.csv);;"
                        "Presentations (*.odp *.otp *.ppt *.pptx)"
                        )
        );

        dialog->setFileMode(QFileDialog::ExistingFile);
        dialog->setAttribute(Qt::WA_DeleteOnClose);

        QObject::connect(dialog, &QFileDialog::fileSelected, [](const QString& filePath) {
            WebView* webViewInstance = new WebView(Application::getProfile());
            webViewInstance->load(Poco::URI(filePath.toStdString()));
        });

        dialog->open();
    }
    else if (message == "uno .uno:NewDoc" || message == "uno .uno:NewDocText")
    {
        WebView* webViewInstance = WebView::createNewDocument(Application::getProfile(), "writer");
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new text document");
        }
    }
    else if (message == "uno .uno:NewDocSpreadsheet")
    {
        WebView* webViewInstance = WebView::createNewDocument(Application::getProfile(), "calc");
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new spreadsheet");
        }
    }
    else if (message == "uno .uno:NewDocPresentation")
    {
        WebView* webViewInstance = WebView::createNewDocument(Application::getProfile(), "impress");
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new presentation");
        }
    }
    else if (message == "uno .uno:SaveAs")
    {
        saveDocumentAs();
    }
    else if (message == "uno .uno:CloseWin")
    {
        // Close the main window associated with this web view
        if (_webView && _webView->window())
        {
            _webView->window()->close();
        }
    }
    else if (message == "PRINT")
    {
        printDocument(_document._appDocId, _webView);
    }
    else if (message.starts_with(DOWNLOADAS))
    {
        // Parse "format=" argument and handle "direct-" prefix
        const std::string args = message.substr(DOWNLOADAS.size());

        std::string format;
        {
            size_t start = 0;
            while (start < args.size())
            {
                size_t end = args.find(' ', start);
                if (end == std::string::npos) end = args.size();
                const std::string_view tok(args.c_str() + start, end - start);
                if (tok.rfind("format=", 0) == 0)
                    format = std::string(tok.substr(strlen("format=")));
                start = end + 1;
            }
        }
        if (format.empty())
        {
            LOG_ERR("downloadas: no format= specified");
            return {};
        }
        if (format.rfind("direct-", 0) == 0)
            format.erase(0, strlen("direct-"));

        // Build a suggested filename from the current document
        const QUrl docUrl(QString::fromStdString(_document._saveLocationURI.toString()));
        const QString docPath = docUrl.isLocalFile() ? docUrl.toLocalFile() : docUrl.toString();
        const QFileInfo docInfo(docPath);
        const QString baseName = docInfo.completeBaseName().isEmpty()
                                 ? QStringLiteral("document")
                                 : docInfo.completeBaseName();
        const QString suggestedName = baseName + "." + QString::fromStdString(format);

        // Ask the user for the destination
        const QString destPath = QFileDialog::getSaveFileName(
            _webView,
            QObject::tr("Export As"),
            QDir::home().filePath(suggestedName),
            QObject::tr("All Files (*)"));

        if (destPath.isEmpty())
            return {}; // user cancelled

        // Export directly to the chosen path
        lok::Document* loKitDoc = DocumentData::get(_document._appDocId).loKitDocument;
        if (!loKitDoc)
        {
            LOG_ERR("downloadas: no loKitDocument");
            return {};
        }

        const QUrl destUrl = QUrl::fromLocalFile(destPath);
        const QByteArray urlUtf8 =
                destUrl.toString(QUrl::FullyEncoded | QUrl::PreferLocalFile).toUtf8();
        const QByteArray fmtUtf8 = QString::fromStdString(format).toUtf8();

        loKitDoc->saveAs(urlUtf8.constData(), fmtUtf8.constData(), nullptr);

        // Verify save
        const QFileInfo outInfo(destPath);
        if (!outInfo.exists() || outInfo.size() <= 0)
        {
            LOG_ERR("downloadas: failed to save to '" << destPath.toStdString() << "'");
            return {};
        }

        LOG_INF("downloadas: exported to " << destPath.toStdString());
        return {};
    }
    else if (message.starts_with(HYPERLINK))
    {
        QString qurl = QString::fromStdString(message.substr(HYPERLINK.size()));
        QDesktopServices::openUrl(QUrl::fromUserInput(qurl));
    }
    else if (message.starts_with(NEWDOCTYPE))
    {
        // e.g."newdoc type=writer template=%2Fhome%2F...something.ott"
        // template is optional and not always there
        std::string args = message.substr(NEWDOCTYPE.size());

        // templateType is one of "writer", "calc" or "impress"
        auto [templateType, templateArgs] = Util::split(args, ' ');

        std::string templatePath;
        constexpr std::string_view TEMPLATE_PREFIX = "template=";
        if(templateArgs.starts_with(TEMPLATE_PREFIX))
        {
            std::string_view templateVal = templateArgs.substr(TEMPLATE_PREFIX.size());
            templatePath = QUrl::fromPercentEncoding(QByteArray(templateVal.data(), templateVal.size())).toStdString();
        }

        WebView* webViewInstance = WebView::createNewDocument(
            Application::getProfile(), std::string(templateType), templatePath);
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new document of type: " << templateType);
        }
    }
    else
    {
        // Forward arbitrary payload from JS → Online
        fakeSocketWriteQueue(_document._fakeClientFd, message.c_str(), message.size());
    }
    return {};
}

Bridge* bridge = nullptr;

// Disable accessibility
void disableA11y() { qputenv("QT_LINUX_ACCESSIBILITY_ALWAYS_ON", "0"); }

static void stopServer() {
    LOG_TRC("Requesting shutdown");
    SigUtil::requestShutdown();

    // wait until coolwsdThread is torn down, so that we don't start cleaning up too early
    coolwsdThread.join();

    QWebEngineProfile* profile = Application::getProfile();
    if (profile) {
        profile->deleteLater();
    }
}

void Application::initialize()
{
    if (!globalProfile)
    {
        globalProfile = new QWebEngineProfile(QStringLiteral("PersistentProfile"));

        QString appData = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
        QString cacheData = QStandardPaths::writableLocation(QStandardPaths::CacheLocation);

        globalProfile->setPersistentStoragePath(appData);
        globalProfile->setCachePath(cacheData);
        globalProfile->setHttpCacheType(QWebEngineProfile::DiskHttpCache);
    }
}

QWebEngineProfile* Application::getProfile() { return globalProfile; }

int main(int argc, char** argv)
{
    QApplication app(argc, argv);

    user_name = getUserName();

    QTranslator translator;
    QString locale = QLocale::system().name();
    QString appDir = QCoreApplication::applicationDirPath();
    QString dataDir = QDir(appDir + "/../share/coda-qt").absolutePath();

    if (translator.load("coda_" + locale, appDir + "/translations"))
        app.installTranslator(&translator);
    else if (translator.load("coda_" + locale, dataDir + "/translations"))
        app.installTranslator(&translator);

    // default application name
    QApplication::setApplicationName(APP_NAME);
    QApplication::setWindowIcon(QIcon::fromTheme("com.collabora.Office.startcenter"));

    QCommandLineParser argParser;
    argParser.setApplicationDescription("Collabora Office - Desktop Office Suite");
    argParser.addHelpOption();
    argParser.addVersionOption();

    QCommandLineOption debugOption(
        QStringList() << "d" << "debug",
        "Enable debug output."
    );
    QCommandLineOption textDocumentOption(
        QStringList() << "textdocument" << "writer",
        "Create a new text document."
    );
    QCommandLineOption spreadsheetOption(
        QStringList() << "spreadsheet" << "calc",
        "Create a new spreadsheet."
    );
    QCommandLineOption presentationOption(
        QStringList() << "presentation" << "impress",
        "Create a new presentation."
    );

    argParser.addOption(debugOption);
    argParser.addOption(textDocumentOption);
    argParser.addOption(spreadsheetOption);
    argParser.addOption(presentationOption);
    argParser.addPositionalArgument("DOCUMENT", "Document file(s) to open", "[DOCUMENT...]");
    argParser.process(app);
    QStringList files = argParser.positionalArguments();

    std::string logLevel = "warning";
    if (argParser.isSet(debugOption))
        logLevel = "trace";

    Log::initialize(QApplication::applicationName().toStdString(), logLevel);
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    QStringList absoluteFiles;
    QString templateType;

    if (files.size() > 0)
    {
        // Convert relative paths to absolute paths
        for (const QString& file : files)
        {
            QFileInfo fileInfo(file);
            absoluteFiles << fileInfo.absoluteFilePath();
        }
    }
    else
    {
        if (argParser.isSet(presentationOption))
            templateType = "impress";
        else if (argParser.isSet(spreadsheetOption))
            templateType = "calc";
        else if (argParser.isSet(textDocumentOption))
            templateType = "writer";
    }

    // single-instance using DBus: try to forward to existing instance
    if (DBusService::tryForwardToExistingInstance(absoluteFiles, templateType))
    {
        // Successfully forwarded to existing instance, exit
        return 0;
    }

    // COOLWSD in a background thread
    coolwsdThread = std::thread(
        []
        {
            Util::setThreadName("app");
            char* argv_local[2] = { strdup("coda"), nullptr };
            coolwsd = new COOLWSD();
            coolwsd->run(1, argv_local);
            delete coolwsd;
            LOG_TRC("One run of COOLWSD completed");
        });

    Application::initialize();

    // register DBus service and object
    DBusService* dbusService = new DBusService(&app);
    DBusService::registerService(dbusService);

    if (!absoluteFiles.isEmpty())
    {
        coda::openFiles(absoluteFiles);
    }
    else
    {
        if (templateType.isEmpty())
            templateType = "writer";

        coda::openNewDocument(templateType);
    }

    auto const ret = app.exec();
    stopServer();
    return ret;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
