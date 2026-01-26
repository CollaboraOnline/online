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
#include "qstandardpaths.h"
#include "qt.hpp"
#include "DBusService.hpp"
#include "common/RecentFiles.hpp"
#include "common/SettingsStorage.hpp"
#include <common/StringVector.hpp>

#include <Poco/MemoryStream.h>
#include <Poco/JSON/Parser.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Array.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/Path.h>
#include <Poco/URI.h>
#include <sstream>
#include <SettingsStorage.hpp>

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
#include <QScreen>
#include <QSet>
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
#include <QFileInfo>

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
RecentFiles Application::recentFiles;

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

    std::vector<std::string> mimeTypes;
    std::vector<char const *> mimeTypePtrs;
    std::vector<std::size_t> sizes;
    std::vector<char const *> streams;
    auto const data = clipboard->mimeData(QClipboard::Clipboard);
    for (auto const & format: data->formats()) {
        mimeTypes.push_back(format.toStdString());
        auto const stream = data->data(format);
        sizes.push_back(stream.size());
        streams.push_back(stream.data());
    }
    for (auto const & type: mimeTypes) {
        mimeTypePtrs.push_back(type.c_str());
    }
    DocumentData::get(appDocId).loKitDocument->setClipboard(
        mimeTypes.size(), mimeTypePtrs.data(), sizes.data(), streams.data());
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

// Helper structure for save-as format options
struct SaveAsFormat
{
    QString action;      // e.g., "saveas-odt"
    QString extension;   // e.g., "odt"
    QString displayName; // e.g., "ODF text document (.odt)"
};

static std::vector<SaveAsFormat> getSaveAsFormats(int docType)
{
    std::vector<SaveAsFormat> formats;

    if (docType == LOK_DOCTYPE_TEXT)
    {
        formats = {
            {QStringLiteral("saveas-odt"), QStringLiteral("odt"), QObject::tr("ODF text document (.odt)")},
            {QStringLiteral("saveas-rtf"), QStringLiteral("rtf"), QObject::tr("Rich Text (.rtf)")},
            {QStringLiteral("saveas-docx"), QStringLiteral("docx"), QObject::tr("Word Document (.docx)")},
            {QStringLiteral("saveas-doc"), QStringLiteral("doc"), QObject::tr("Word 2003 Document (.doc)")}
        };
    }
    else if (docType == LOK_DOCTYPE_SPREADSHEET)
    {
        formats = {
            {QStringLiteral("saveas-ods"), QStringLiteral("ods"), QObject::tr("ODF spreadsheet (.ods)")},
            {QStringLiteral("saveas-xlsx"), QStringLiteral("xlsx"), QObject::tr("Excel Spreadsheet (.xlsx)")},
            {QStringLiteral("saveas-xls"), QStringLiteral("xls"), QObject::tr("Excel 2003 Spreadsheet (.xls)")}
        };
    }
    else if (docType == LOK_DOCTYPE_PRESENTATION)
    {
        formats = {
            {QStringLiteral("saveas-odp"), QStringLiteral("odp"), QObject::tr("ODF presentation (.odp)")},
            {QStringLiteral("saveas-pptx"), QStringLiteral("pptx"), QObject::tr("PowerPoint Presentation (.pptx)")},
            {QStringLiteral("saveas-ppt"), QStringLiteral("ppt"), QObject::tr("PowerPoint 2003 Presentation (.ppt)")}
        };
    }
    else if (docType == LOK_DOCTYPE_DRAWING)
    {
        formats = {
            {QStringLiteral("saveas-odg"), QStringLiteral("odg"), QObject::tr("ODF drawing (.odg)")}
        };
    }

    return formats;
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
    QDialog* customPrintDialog = new QDialog(parent);
    customPrintDialog->setWindowTitle(QObject::tr("Print Document"));
    customPrintDialog->setModal(true);
    customPrintDialog->resize(400, 200);
    customPrintDialog->setAttribute(Qt::WA_DeleteOnClose);

    QVBoxLayout* layout = new QVBoxLayout(customPrintDialog);

    // Printer selection
    QLabel* printerLabel = new QLabel(QObject::tr("Select Printer:"), customPrintDialog);
    layout->addWidget(printerLabel);

    QComboBox* printerCombo = new QComboBox(customPrintDialog);
    // Get available printers
    QStringList printers = QPrinterInfo::availablePrinterNames();
    printerCombo->addItems(printers);
    if (printers.isEmpty())
    {
        printerCombo->addItem(QObject::tr("Default Printer"));
    }
    layout->addWidget(printerCombo);

    // Print to file option
    QCheckBox* printToFileCheck = new QCheckBox(QObject::tr("Print to File"), customPrintDialog);
    layout->addWidget(printToFileCheck);

    QLineEdit* filePathEdit = new QLineEdit(customPrintDialog);
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
                             QFileDialog* fileDialog = new QFileDialog(
                                 filePathEdit, QObject::tr("Save Print Output As"),
                                 QDir::home().filePath("document.pdf"),
                                 QObject::tr("PDF Files (*.pdf);;All Files (*)"));

                             fileDialog->setAcceptMode(QFileDialog::AcceptSave);
                             fileDialog->setAttribute(Qt::WA_DeleteOnClose);

                             QObject::connect(fileDialog, &QFileDialog::fileSelected,
                                             [filePathEdit](const QString& fileName) {
                                 filePathEdit->setText(fileName);
                             });

                             fileDialog->open();
                         }
                     });

    // Buttons
    QHBoxLayout* buttonLayout = new QHBoxLayout();
    QPushButton* printButton = new QPushButton(QObject::tr("Print"), customPrintDialog);
    QPushButton* cancelButton = new QPushButton(QObject::tr("Cancel"), customPrintDialog);
    buttonLayout->addWidget(printButton);
    buttonLayout->addWidget(cancelButton);
    layout->addLayout(buttonLayout);

    // Connect print button
    QObject::connect(printButton, &QPushButton::clicked,
                     [customPrintDialog, printerCombo, printToFileCheck, filePathEdit, tempFile, parent]() {
        customPrintDialog->accept();

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

        // Clean up the temporary file
        FileUtil::unlinkFile(tempFile);
    });

    // Connect cancel button
    QObject::connect(cancelButton, &QPushButton::clicked,
                     [customPrintDialog, tempFile]() {
        customPrintDialog->reject();
        LOG_INF("printDocument: Print cancelled by user");
        FileUtil::unlinkFile(tempFile);
    });

    customPrintDialog->open();
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

void Bridge::createAndStartMessagePumpThread()
{
    // Create pipe for close notifications
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

void Bridge::promptSaveLocation(std::function<void(const std::string&, const std::string&)> callback)
{
    // Prompt user to pick a save location and format
    lok::Document* loKitDoc = DocumentData::get(_document._appDocId).loKitDocument;
    if (!loKitDoc)
    {
        LOG_ERR("promptSaveLocation: no loKitDocument");
        return;
    }

    const int docType = loKitDoc->getDocumentType();
    const auto formats = getSaveAsFormats(docType);

    if (formats.empty())
    {
        LOG_ERR("promptSaveLocation: no formats available for document type");
        return;
    }

    // Get document info for suggested filename
    const QUrl docUrl(QString::fromStdString(_document._fileURL.toString()));
    const QString docPath = docUrl.isLocalFile() ? docUrl.toLocalFile() : docUrl.toString();
    const QFileInfo docInfo(docPath);
    const QString baseName = docInfo.completeBaseName().isEmpty()
                               ? QStringLiteral("document")
                               : docInfo.completeBaseName();

    // Build file filter string with all available formats
    QString fileFilter;
    for (size_t i = 0; i < formats.size(); ++i)
    {
        if (i > 0)
            fileFilter += QStringLiteral(";;");
        fileFilter += formats[i].displayName + QStringLiteral(" (*.") + formats[i].extension + QStringLiteral(")");
    }

    QFileDialog* dialog = new QFileDialog(
        _webView,
        QObject::tr("Save Document"),
        QDir::home().filePath(baseName),
        fileFilter);

    dialog->setAcceptMode(QFileDialog::AcceptSave);
    dialog->setAttribute(Qt::WA_DeleteOnClose);

    // Set default suffix to enforce extension in GUI
    if (!formats.empty())
        dialog->setDefaultSuffix(formats[0].extension);

    // Update default suffix when user changes the selected filter
    QObject::connect(dialog, QOverload<const QString&>::of(&QFileDialog::filterSelected),
                     [dialog, formats](const QString& selectedFilter)
                     {
                         for (const auto& fmt : formats)
                         {
                             if (selectedFilter.startsWith(fmt.displayName))
                             {
                                 dialog->setDefaultSuffix(fmt.extension);
                                 break;
                             }
                         }
                     });

    QObject::connect(dialog, &QFileDialog::fileSelected,
                     [callback, dialog, formats](const QString& destPath)
                     {
                         // Get the selected filter to determine the format
                         QString selectedFilter = dialog->selectedNameFilter();
                         QString format;

                         // Extract format from the selected filter (e.g., "ODF text document (*.odt)" -> "odt")
                         for (const auto& fmt : formats)
                         {
                             if (selectedFilter.startsWith(fmt.displayName))
                             {
                                 format = fmt.extension;
                                 break;
                             }
                         }

                         if (format.isEmpty() && !formats.empty())
                             format = formats[0].extension;

                         // Ensure file ends with the selected format's extension - save-as fails otherwise!
                         QString finalPath = destPath;
                         if (!finalPath.endsWith("." + format, Qt::CaseInsensitive))
                         {
                             finalPath += "." + format;
                         }

                         callback(finalPath.toStdString(), format.toStdString());
                     });

    dialog->open();
}

void Bridge::saveDocumentAs()
{
    promptSaveLocation([fakeClientFd = _document._fakeClientFd](const std::string& destPath, const std::string& format) {
            const QFileInfo destInfo(QString::fromStdString(destPath));

            Poco::URI destUri("file", destInfo.absoluteFilePath().toStdString());

            // Send saveas command to COOLWSD with the selected format
            std::string saveasCmd = "saveas url=" + destUri.toString() +
                                     " format=" + format +
                                     " options=";
            fakeSocketWriteQueue(fakeClientFd, saveasCmd.c_str(), saveasCmd.size());
    });
}

static void closeStarterScreen()
{
    WebView* starterScreen = WebView::findStarterScreen();
    if (starterScreen)
    {
        LOG_TRC("Closing starter screen after document action");
        QTimer::singleShot(0, [starterScreen]() {
            if (starterScreen->getMainWindow())
            {
                starterScreen->getMainWindow()->close();
            }
        });
    }
}

QVariant Bridge::cool(const QString& messageStr)
{
    constexpr std::string_view CLIPBOARDSET = "CLIPBOARDSET ";
    constexpr std::string_view DOWNLOADAS = "downloadas ";
    constexpr std::string_view HYPERLINK = "HYPERLINK ";
    constexpr std::string_view COMMANDSTATECHANGED = "COMMANDSTATECHANGED ";
    constexpr std::string_view COMMANDRESULT = "COMMANDRESULT ";
    constexpr std::string_view NEWDOC = "newdoc ";
    constexpr std::string_view OPENDOC = "opendoc file=";
    constexpr std::string_view FULLSCREENPRESENTATION = "FULLSCREENPRESENTATION ";
    constexpr std::string_view UPLOADSETTINGS = "UPLOADSETTINGS ";
    constexpr std::string_view FETCHSETTINGSFILE = "FETCHSETTINGSFILE ";
    constexpr std::string_view FETCHSETTINGSCONFIG = "FETCHSETTINGSCONFIG";
    constexpr std::string_view SYNCSETTINGS = "SYNCSETTINGS";
    constexpr std::string_view PROCESSINTEGRATORADMINFILE = "PROCESSINTEGRATORADMINFILE ";
    constexpr std::string_view LOADDOCUMENT = "loaddocument ";

    const std::string message = messageStr.toStdString();
    LOG_TRC_NOFILE("From JS: cool: " << message);

    if (message == "HULLO")
    {
        // Skip for starter screen (no document connection needed)
        if (_document._fakeClientFd == -1) {
            LOG_TRC_NOFILE("Starter screen - skipping COOLWSD connection");
            return {};
        }

        // JS side fully initialised – open our fake WebSocket to COOLWSD
        assert(coolwsd_server_socket_fd != -1);
        int rc = fakeSocketConnect(_document._fakeClientFd, coolwsd_server_socket_fd);
        assert(rc != -1);

        createAndStartMessagePumpThread();

        // 1st request: the initial GET /?file_path=...  (mimic WebSocket upgrade)
        std::string message(_document._fileURL.toString() +
                            (" " + std::to_string(_document._appDocId)));
        fakeSocketWriteQueue(_document._fakeClientFd, message.c_str(), message.size());
    }
    else if (message.starts_with(LOADDOCUMENT))
    {
        // loaddocument url=file:///path/to/file.odt
        // Parse the URL from the message
        std::string args = message.substr(LOADDOCUMENT.size());
        std::string newFileUrl;

        size_t urlPos = args.find("url=");
        if (urlPos != std::string::npos) {
            size_t urlStart = urlPos + 4;
            size_t urlEnd = args.find(' ', urlStart);
            if (urlEnd == std::string::npos)
                urlEnd = args.size();
            newFileUrl = args.substr(urlStart, urlEnd - urlStart);
        }

        if (newFileUrl.empty()) {
            LOG_ERR("loaddocument: no url= specified");
            return {};
        }

        LOG_TRC_NOFILE("loaddocument: switching to URL: " << newFileUrl);

        // Close the existing fakesocket
        if (_document._fakeClientFd != -1) {
            fakeSocketClose(_document._fakeClientFd);
            _document._fakeClientFd = -1;
        }
        // Close the existing forwarding thread
        if (_app2js.joinable()) {
            fakeSocketClose(_closeNotificationPipeForForwardingThread[0]);
            _app2js.join();
        }

        // Create a new fakesocket
        _document._fakeClientFd = fakeSocketSocket();
        // Generate a new appDocId
        _document._appDocId = coda::generateNewAppDocId();
        // Update the file URL
        _document._fileURL = Poco::URI(newFileUrl);

        LOG_TRC_NOFILE("loaddocument: created new appDocId=" << _document._appDocId);

        // Connect to COOLWSD
        int rc = fakeSocketConnect(_document._fakeClientFd, coolwsd_server_socket_fd);
        if (rc == -1) {
            LOG_ERR("loaddocument: failed to connect fakesocket");
            return {};
        }

        createAndStartMessagePumpThread();

        // Send the initial message with the new file URL and appDocId
        std::string initialMessage(_document._fileURL.toString() +
                                   (" " + std::to_string(_document._appDocId)));
        fakeSocketWriteQueue(_document._fakeClientFd, initialMessage.c_str(), initialMessage.size());

        // Update window title with new filename
        Poco::Path uriPath(_document._fileURL.getPath());
        QString fileName = QString::fromStdString(uriPath.getFileName());
        QString windowTitle = fileName + " - " APP_NAME;
        if (_window)
            _window->setWindowTitle(windowTitle);

        // Add the new document location to recent files
        Application::getRecentFiles().add(_document._fileURL.toString());

        LOG_TRC_NOFILE("loaddocument: sent initial message with new appDocId");
        return {};
    }
    else if (message == "WELCOME")
    {
        const std::string welcomePath = getDataDir() + "/browser/dist/welcome/welcome-slideshow.odp";
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
    else if (message == "LICENSE")
    {
        const std::string licensePath = LO_PATH "/LICENSE.html";
        struct stat st;
        if (FileUtil::getStatOfFile(licensePath, st) == 0)
        {
            const QUrl url = QUrl::fromLocalFile(QString::fromStdString(licensePath));
            QDesktopServices::openUrl(url);
            LOG_TRC_NOFILE("Opening LICENSE.html: " << licensePath);
        }
        else
        {
            LOG_TRC_NOFILE("LICENSE.html not found at: " << licensePath);
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

        bool previousModified = _modified;
        _modified = (object->get("state").toString() == "true");

        LOG_TRC_NOFILE("Document modified status changed: " << (_modified ? "modified" : "unmodified"));
    }
    else if (message.starts_with(COMMANDRESULT))
    {
        return {};
        const auto object = parseJsonFromMessage(message, COMMANDRESULT.size());
        if (!object)
            return {};

        const std::string commandName = object->get("commandName").toString();
        const bool success = object->get("success").convert<bool>();
        bool wasModified = false;
        if (object->has("wasModified"))
        {
            wasModified = object->get("wasModified").convert<bool>();
        }

        bool isAutosave = false;
        if (object->has("isAutosave"))
        {
            isAutosave = object->get("isAutosave").convert<bool>();
        }

        // only handle successful .uno:Save commands
        // let manually triggered saves through even if the document is not modified.
        if (commandName != ".uno:Save" || !success || (!wasModified && isAutosave))
            return {};
    }
    else if (message.starts_with(UPLOADSETTINGS))
    {
        const std::string payload = message.substr(UPLOADSETTINGS.size());
        Desktop::uploadSettings(payload);
        return {};
    }
    else if (message.starts_with(FETCHSETTINGSFILE))
    {
        const std::string relPath = message.substr(FETCHSETTINGSFILE.size());
        auto result = Desktop::fetchSettingsFile(relPath);
        if (result.content.empty())
            return {};

        QVariantMap resultMap;
        resultMap["fileName"] = QString::fromStdString(result.fileName);
        resultMap["mimeType"] = QString::fromStdString(result.mimeType);
        resultMap["content"] = QString::fromStdString(result.content);

        return resultMap;
    }
    else if (message == FETCHSETTINGSCONFIG)
    {
        return QString::fromStdString(Desktop::fetchSettingsConfig());
    }
    else if (message.starts_with(SYNCSETTINGS))
    {
        Desktop::syncSettings([this](const std::vector<char>& data) {
            send2JS(data);
        });
        return {};
    }
    else if (message.starts_with(PROCESSINTEGRATORADMINFILE))
    {
        std::string payload = message.substr(PROCESSINTEGRATORADMINFILE.size());
        Desktop::processIntegratorAdminFile(payload);
        return {};
    }
    else if (message == "BYE")
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side → closing fake socket");
        fakeSocketClose(_closeNotificationPipeForForwardingThread[0]);

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
    else if (message == "GETRECENTDOCS")
    {
        QString result = QString::fromStdString(Application::getRecentFiles().serialise());
        LOG_TRC_NOFILE("GETRECENTDOCS: returning recent documents");
        return result;
    }
    else if (message.starts_with(CLIPBOARDSET))
    {
        std::string content = message.substr(CLIPBOARDSET.size());
        setClipboardFromContent(_document._appDocId, content);
    }
    else if (message.starts_with(FULLSCREENPRESENTATION))
    {
        if (_webView)
        {
            std::string content = message.substr(FULLSCREENPRESENTATION.size());
            if (content == "true")
                _webView->createPresentationFS();
            else
                _webView->destroyPresentationFS();
        }
    }
    else if (message == "uno .uno:Open")
    {
        QFileDialog* dialog =
            new QFileDialog(_webView, QObject::tr("Open File"), QString(),
                            QObject::tr("All Files (*);;"
                                        "Text Documents (*.odt *.ott *.doc *.docx *.rtf *.txt);;"
                                        "Spreadsheets (*.ods *.ots *.xls *.xlsx *.csv);;"
                                        "Presentations (*.odp *.otp *.ppt *.pptx)"));

        dialog->setFileMode(QFileDialog::ExistingFiles);
        dialog->setAttribute(Qt::WA_DeleteOnClose);

        QObject::connect(dialog, &QFileDialog::filesSelected,
                         [](const QStringList& filePaths)
                         {
                            coda::openFiles(filePaths);
                             // Close starter screen if it exists
                             closeStarterScreen();
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
    else if (message == "uno .uno:NewDocDraw")
    {
        WebView* webViewInstance = WebView::createNewDocument(Application::getProfile(), "draw");
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new drawing");
        }
    }
    else if (message == "uno .uno:SaveAs")
    {
        assert(_document._fakeClientFd != -1);

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
    else if (message == "EXCHANGEMONITORS")
    {
        if (_webView)
            _webView->exchangeMonitors();
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
        const QUrl docUrl(QString::fromStdString(_document._fileURL.toString()));
        const QString docPath = docUrl.isLocalFile() ? docUrl.toLocalFile() : docUrl.toString();
        const QFileInfo docInfo(docPath);
        const QString baseName = docInfo.completeBaseName().isEmpty()
                                 ? QStringLiteral("document")
                                 : docInfo.completeBaseName();
        const QString suggestedName = baseName + "." + QString::fromStdString(format);

        // Ask the user for the destination
        QFileDialog* dialog = new QFileDialog(
            _webView,
            QObject::tr("Export As"),
            QDir::home().filePath(suggestedName),
            QObject::tr("All Files (*)"));

        dialog->setAcceptMode(QFileDialog::AcceptSave);
        dialog->setAttribute(Qt::WA_DeleteOnClose);

        unsigned appDocId = _document._appDocId;
        QObject::connect(dialog, &QFileDialog::fileSelected,
                        [appDocId, format](const QString& destPath) {
            // Export directly to the chosen path
            lok::Document* loKitDoc = DocumentData::get(appDocId).loKitDocument;
            if (!loKitDoc)
            {
                LOG_ERR("downloadas: no loKitDocument");
                return;
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
                return;
            }

            LOG_INF("downloadas: exported to " << destPath.toStdString());
        });

        dialog->open();
    }
    else if (message.starts_with(HYPERLINK))
    {
        QString qurl = QString::fromStdString(message.substr(HYPERLINK.size()));
        QDesktopServices::openUrl(QUrl::fromUserInput(qurl));
    }
    else if (message.starts_with(OPENDOC))
    {
        // e.g. "opendoc file=%2Fhome%2F...something.odt"
        std::string fileArg = message.substr(OPENDOC.size());
        QString decodedUri = QUrl::fromPercentEncoding(QByteArray(fileArg.data(), fileArg.size()));

        QUrl url(decodedUri);
        QString localPath = url.isLocalFile() ? url.toLocalFile() : decodedUri;

        QFileInfo fileInfo(localPath);
        if (!fileInfo.exists() || !fileInfo.isFile())
        {
            LOG_ERR("opendoc: file does not exist: " << localPath.toStdString());
            return {};
        }

        QString absolutePath = fileInfo.absoluteFilePath();
        coda::openFiles(QStringList() << absolutePath);

        LOG_INF("opendoc: opened file: " << absolutePath.toStdString());
        return {};
    }
    else if (message.starts_with(NEWDOC))
    {
        // e.g."newdoc type=writer template=%2Fhome%2F...something.ott"
        auto const tokens = StringVector::tokenize(message);

        std::string typeToken, templateToken;
        if (!COOLProtocol::getTokenString(tokens, "type", typeToken))
        {
            LOG_ERR("No type parameter in message '" << message << "'");
            return {};
        }

        // template is optional
        COOLProtocol::getTokenString(tokens, "template", templateToken);

        std::string templatePath;
        if (!templateToken.empty())
        {
            templatePath =
                QUrl::fromPercentEncoding(QByteArray::fromStdString(templateToken)).toStdString();
        }

        // Always create new window
        WebView* webViewInstance = WebView::createNewDocument(
            Application::getProfile(), typeToken, templatePath);
        if (!webViewInstance)
        {
            LOG_ERR("Failed to create new document of type: " << typeToken);
            return {};
        }

        // If this was triggered from a starter screen, close it
        closeStarterScreen();
    }
    else
    {
        // Forward arbitrary payload from JS → Online
        fakeSocketWriteQueue(_document._fakeClientFd, message.c_str(), message.size());
    }
    return {};
}

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

    // Initialize recent files
    Poco::Path configDir = Desktop::getConfigPath();
    recentFiles.load(configDir.append("RecentDocuments.conf").toString(), 15);
}

Poco::Path Desktop::getConfigPath()
{
    QString pathStr = QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation);
    QDir().mkpath(pathStr);
    Poco::Path configPath(pathStr.toStdString());
    Poco::File configDir(configPath);
    if (!configDir.exists() || !configDir.isDirectory())
    {
        LOG_ERR("getConfigPath: following configuration directory does not exist, trouble ahead:"
                << pathStr.toStdString());
    }
    return configPath;
}

std::string Desktop::getDataDir()
{
    return ::getDataDir();
}

QWebEngineProfile* Application::getProfile() { return globalProfile; }

RecentFiles& Application::getRecentFiles() { return recentFiles; }

namespace {
    void updateBrowserEnvironment(void)
    {
        const char *varName = "QTWEBENGINE_CHROMIUM_FLAGS";
        std::string val = (getenv(varName) ? getenv(varName) : "");
        // avoiding a crasher bug around check-box state emission for now cool#14039
        val = "--disable-renderer-accessibility --force-renderer-accessibility=false " + val;
        setenv(varName, val.c_str(), 1);
    }
}

int main(int argc, char** argv)
{
    QApplication app(argc, argv);

    user_name = getUserName();

    updateBrowserEnvironment();

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
    QApplication::setWindowIcon(QIcon::fromTheme("com.collaboraoffice.Office.startcenter"));

    QCommandLineParser argParser;
    argParser.setApplicationDescription("Collabora Office - Desktop Office Suite");
    argParser.addHelpOption();
    argParser.addVersionOption();

    QCommandLineOption debugOption(
        QStringList() << "d" << "debug",
        "Enable debug output (shortcut for --log-level=trace)."
    );
    QCommandLineOption logLevelOption(
        QStringList() << "log-level",
        "Set log level (none, fatal, critical, error, warning, notice, information, debug, trace).",
        "level",
        "warning"
    );
    QCommandLineOption logDisabledAreasOption(
        QStringList() << "log-disabled-areas",
        "Comma-separated list of log areas to disable (Generic, Pixel, Socket, WebSocket, Http, WebServer, Storage, WOPI, Admin, Javascript).",
        "areas",
        "Socket,WebSocket,Admin,Pixel"
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
    QCommandLineOption drawingOption(
        QStringList() << "drawing" << "draw",
        "Create a new vector drawing."
    );

    argParser.addOption(debugOption);
    argParser.addOption(logLevelOption);
    argParser.addOption(logDisabledAreasOption);
    argParser.addOption(textDocumentOption);
    argParser.addOption(spreadsheetOption);
    argParser.addOption(presentationOption);
    argParser.addOption(drawingOption);
    argParser.addPositionalArgument("DOCUMENT", "Document file(s) to open", "[DOCUMENT...]");
    argParser.process(app);
    QStringList files = argParser.positionalArguments();

    std::string logLevel = argParser.value(logLevelOption).toStdString();
    if (argParser.isSet(debugOption))
        logLevel = "trace";

    Log::initialize(QApplication::applicationName().toStdString(), logLevel);
    Log::setDisabledAreas(argParser.value(logDisabledAreasOption).toStdString());

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
        else if (argParser.isSet(drawingOption))
            templateType = "draw";
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
    else if (!templateType.isEmpty())
    {
        coda::openNewDocument(templateType);
    }
    else
    {
        WebView* starterView = new WebView(Application::getProfile());
        starterView->load(Poco::URI(), false, true);
    }

    auto const ret = app.exec();
    stopServer();
    return ret;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
