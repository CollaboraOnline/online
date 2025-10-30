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
#include "qt.hpp"

#include <Poco/MemoryStream.h>

#include <QApplication>
#include <QByteArray>
#include <QClipboard>
#include <QCommandLineOption>
#include <QCommandLineParser>
#include <QDesktopServices>
#include <QDir>
#include <QTemporaryFile>
#include <QProcess>
#include <QFileDialog>
#include <QFileInfo>
#include <QMainWindow>
#include <QMetaObject>
#include <QMimeData>
#include <QObject>
#include <QThread>
#include <QTimer>
#include <QUrl>
#include <QWebChannel>
#include <QWebEngineProfile>
#include <QWebEngineView>
#include <QWindow>
#include <QMessageBox>
#include <QDialog>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QComboBox>
#include <QCheckBox>
#include <QLineEdit>
#include <QPushButton>
#include <QPrinterInfo>
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <poll.h>
#include <string>
#include <string_view>
#include <thread>
#include <vector>
#include "WebView.hpp"

const char* user_name = "Dummy";

const int SHOW_JS_MAXLEN = 300;

int coolwsd_server_socket_fd = -1;
static COOLWSD* coolwsd = nullptr;
static int closeNotificationPipeForForwardingThread[2]{ -1, -1 };

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
    LOG_TRC_NOFILE(
        "Send to JS: " << COOLProtocol::getAbbreviatedMessage(buffer.data(), buffer.size()));

    std::string js;
    const char* newline = static_cast<const char*>(memchr(buffer.data(), '\n', buffer.size()));
    if (newline)
    {
        // treat as binary – deliver Base64 ArrayBuffer
        QByteArray base64 = QByteArray(buffer.data(), static_cast<int>(buffer.size())).toBase64();
        js = "window.TheFakeWebSocket.onmessage({data: Base64ToArrayBuffer('" +
             base64.toStdString() + "')});";
    }
    else
    {
        // escape non-printables similar to original implementation
        std::string data;
        data.reserve(buffer.size() * 2);
        static const char hex[] = "0123456789abcdef";
        for (unsigned char ch : buffer)
        {
            if (ch < ' ' || ch >= 0x80 || ch == '\'' || ch == '\\')
            {
                data.push_back('\\');
                data.push_back('x');
                data.push_back(hex[(ch >> 4) & 0xF]);
                data.push_back(hex[ch & 0xF]);
            }
            else
                data.push_back(static_cast<char>(ch));
        }
        js = "window.TheFakeWebSocket.onmessage({data: '" + data + "'});";
    }

    std::string subjs = js.substr(0, std::min<std::string::size_type>(SHOW_JS_MAXLEN, js.length()));
    if (js.length() > SHOW_JS_MAXLEN)
        subjs += "...";
    LOG_TRC_NOFILE("Evaluating JavaScript: " << subjs);

    evalJS(js);
}

void Bridge::debug(const QString& msg) { LOG_TRC_NOFILE("From JS: debug: " << msg.toStdString()); }

void Bridge::error(const QString& msg) { LOG_TRC_NOFILE("From JS: error: " << msg.toStdString()); }

QVariant Bridge::cool(const QString& messageStr)
{
    constexpr std::string_view CLIPBOARDSET = "CLIPBOARDSET ";
    constexpr std::string_view DOWNLOADAS = "downloadas ";
    constexpr std::string_view HYPERLINK = "HYPERLINK ";

    const std::string message = messageStr.toStdString();
    LOG_TRC_NOFILE("From JS: cool: " << message);

    if (message == "HULLO")
    {
        // JS side fully initialised – open our fake WebSocket to COOLWSD
        assert(coolwsd_server_socket_fd != -1);
        int rc = fakeSocketConnect(_document._fakeClientFd, coolwsd_server_socket_fd);
        assert(rc != -1);

        fakeSocketPipe2(closeNotificationPipeForForwardingThread);

        // Thread pumping Online → JS
        std::thread(
            [this]
            {
                Util::setThreadName("app2js");
                while (true)
                {
                    struct pollfd pfd[2];
                    pfd[0].fd = _document._fakeClientFd;
                    pfd[0].events = POLLIN;
                    pfd[1].fd = closeNotificationPipeForForwardingThread[1];
                    pfd[1].events = POLLIN;
                    if (fakeSocketPoll(pfd, 2, -1) > 0)
                    {
                        if (pfd[1].revents & POLLIN)
                        {
                            fakeSocketClose(closeNotificationPipeForForwardingThread[1]);
                            fakeSocketClose(_document._fakeClientFd);
                            return; // document closed
                        }
                        if (pfd[0].revents & POLLIN)
                        {
                            int n = fakeSocketAvailableDataLength(_document._fakeClientFd);
                            if (n == 0)
                                return;
                            std::vector<char> buf(n);
                            fakeSocketRead(_document._fakeClientFd, buf.data(), n);
                            send2JS(buf);
                        }
                    }
                }
            })
            .detach();

        // 1st request: the initial GET /?file_path=...  (mimic WebSocket upgrade)
        struct pollfd p
        {
        };
        p.fd = _document._fakeClientFd;
        p.events = POLLOUT;
        fakeSocketPoll(&p, 1, -1);
        std::string message(_document._fileURL +
                            (" " + std::to_string(_document._appDocId)));
        fakeSocketWrite(_document._fakeClientFd, message.c_str(), message.size());
    }
    else if (message == "BYE")
    {
        LOG_TRC_NOFILE("Document window terminating on JavaScript side → closing fake socket");
        fakeSocketClose(closeNotificationPipeForForwardingThread[0]);
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
        const QString filePath = QFileDialog::getOpenFileName(
            nullptr, QObject::tr("Open File"), QString(),
            QObject::tr("All Files (*);;"
                        "Text Documents (*.odt *.ott *.doc *.docx *.rtf *.txt);;"
                        "Spreadsheets (*.ods *.ots *.xls *.xlsx *.csv);;"
                        "Presentations (*.odp *.otp *.ppt *.pptx)"
                        )
        );
        if (!filePath.isEmpty())
        {
            WebView* webViewInstance = new WebView(nullptr);
            webViewInstance->load(filePath.toStdString());
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
        const QUrl docUrl(QString::fromStdString(_document._fileURL));
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
    else if (message == "WINDOW_START_MOVE")
    {
        if (_webView && _webView->window() && _webView->window()->windowHandle())
        {
            _webView->window()->windowHandle()->startSystemMove();
        }
    }
    else if (message.starts_with(HYPERLINK))
    {
        QString qurl = QString::fromStdString(message.substr(HYPERLINK.size()));
        QDesktopServices::openUrl(QUrl::fromUserInput(qurl));
    }
    else
    {
        // Forward arbitrary payload from JS → Online
        std::string copy = message; // make lifetime explicit
        std::thread(
            [this, copy]
            {
                struct pollfd p
                {
                };
                p.fd = _document._fakeClientFd;
                p.events = POLLOUT;
                fakeSocketPoll(&p, 1, -1);
                fakeSocketWrite(_document._fakeClientFd, copy.c_str(), copy.size());
            })
            .detach();
    }
    return {};
}

Bridge* bridge = nullptr;

// Disable accessibility
void disableA11y() { qputenv("QT_LINUX_ACCESSIBILITY_ALWAYS_ON", "0"); }

int main(int argc, char** argv)
{
    QApplication app(argc, argv);
    QApplication::setApplicationName("Collabora Office");
    QApplication::setWindowIcon(QIcon::fromTheme("com.collabora.Office.startcenter"));

    QCommandLineParser argParser;
    QCommandLineOption debugOption(
        QStringList() << "d" << "debug",
        "Enable debug output."
    );
    argParser.addOption(debugOption);
    argParser.process(app);
    QStringList files = argParser.positionalArguments();

    if (files.size() < 1)
    {
        fprintf(stderr, "Usage: %s [--debug] DOCUMENT [DOCUMENT...]\n", argv[0]);
        _exit(1);
    }

    std::string logLevel = "warning";
    if (argParser.isSet(debugOption))
        logLevel = "trace";

    Log::initialize("Mobile", logLevel);
    Util::setThreadName("main");

    fakeSocketSetLoggingCallback([](const std::string& line) { LOG_TRC_NOFILE(line); });

    // COOLWSD in a background thread
    std::thread(
        []
        {
            Util::setThreadName("app");
            char* argv_local[2] = { strdup("coda"), nullptr };
            coolwsd = new COOLWSD();
            coolwsd->run(1, argv_local);
            delete coolwsd;
            LOG_TRC("One run of COOLWSD completed");
        })
        .detach();

    for (auto const & file : files)
    {
        // Resolve absolute file URL to pass into Online
        std::string fileURL = Poco::URI(Poco::Path(std::string(file.toUtf8()))).toString();
        WebView* webViewInstance = new WebView(nullptr);
        webViewInstance->load(fileURL);
    }

    return app.exec();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
