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

#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>
#include <StringVector.hpp>
#include <WebSocketSession.hpp>
#include <test/testlog.hpp>
#include <test/lokassert.hpp>

#include <LibreOfficeKit/LibreOfficeKit.hxx>

#include <string>
#include <thread>

namespace {
    void *memdup(const void *ptr, size_t size)
    {
        auto p = malloc(size);
        memcpy(p, ptr, size);
        return p;
    }
}

/// Save torture testcase.
class UnitSyntheticLok : public UnitWSD
{
    void loadAndSynthesize(const std::string& name, const std::string& docName);

public:
    UnitSyntheticLok();
    void invokeWSDTest() override;
};

void UnitSyntheticLok::loadAndSynthesize(
    const std::string& name, const std::string& docName)
{
    auto timeout = std::chrono::seconds(10);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL(docName, documentPath, documentURL, name);

    TST_LOG("Starting test on " << documentURL << ' ' << documentPath);

    std::shared_ptr<SocketPoll> poll = std::make_shared<SocketPoll>("WebSocketPoll");
    poll->startThread();

    Poco::URI uri(helpers::getTestServerURI());
    auto wsSession = helpers::loadDocAndGetSession(poll, docName, uri, testname);

    std::vector<char> message
        = wsSession->waitForMessage("status:", timeout, name);
    const std::string status = COOLProtocol::getFirstLine(message);

    // Kit will signal success through unitresult: to wsd in its own time.
}

UnitSyntheticLok::UnitSyntheticLok()
    : UnitWSD("UnitSyntheticLok")
{
    setHasKitHooks();
    // Double of the default.
    constexpr std::chrono::minutes timeout_minutes(1);
    setTimeout(timeout_minutes);
}

void UnitSyntheticLok::invokeWSDTest()
{
    const auto name = "syntheticLok";

    static bool started = false;
    if (!started)
    {
        started = true;
        loadAndSynthesize(name, "empty.ods");
    }
    // wait for result from the Kit process
}

class UnitKitSyntheticLok;

UnitKitSyntheticLok *GlobalUnitKit;

// Inside the forkit & kit processes
class UnitKitSyntheticLok : public UnitKit
{
public:
    LibreOfficeKit *_kit;

    // Original and overridden vtables
    LibreOfficeKitClass *_kitClass;
    LibreOfficeKitClass *_kitClassClean;

    // Original and overridden vtables
    LibreOfficeKitDocumentClass *_docClass;
    LibreOfficeKitDocumentClass *_docClassClean;

    // Polling replacement
    LibreOfficeKitPollCallback _pollCallback;
    LibreOfficeKitWakeCallback _wakeCallback;
    void* _pollData;

    LibreOfficeKitCallback _docCallback;
    void *_docCallbackData;

    bool isDocumentCreated() const { return _docCallback != nullptr; }

    UnitKitSyntheticLok()
        : UnitKit("SyntheticLok")
        , _docCallback(nullptr)
        , _docCallbackData(nullptr)
    {
        TST_LOG("SyntheticLOK kit bootstrap\n");
        setTimeout(std::chrono::hours(1));
        GlobalUnitKit = this;
    }

    virtual LibreOfficeKit *lok_init(
        const char *instdir, const char *userdir,
        LokHookFunction2 fn) override;

    void postLOKDocumentEvent(int nType, const char* pPayload)
    {
        assert(_docCallback);
        _docCallback(nType, pPayload, _docCallbackData);
    }

    bool prePollCallback(int /* timeoutUs */)
    {
        return true;
    }

    virtual void doTest()
    {
        if (isDocumentCreated())
        {
            TST_LOG("Send test event");
            postLOKDocumentEvent(LOK_CALLBACK_CELL_CURSOR, "EMPTY");
            exitTest(TestResult::Ok);
        }
    }
};


extern "C" {

    int syn_pollCallback(void* /* pData */, int timeoutUs)
    {
        assert(GlobalUnitKit);
        bool finished = UnitKit::get().isFinished();
        if (!finished && timeoutUs > 1000) // post initial setup we hope
            GlobalUnitKit->doTest();
        if (GlobalUnitKit->prePollCallback(timeoutUs))
            return GlobalUnitKit->_pollCallback(GlobalUnitKit->_pollData, timeoutUs);
        return 0;
    }

    void syn_wakeCallback(void* /* pData */)
    {
        assert(GlobalUnitKit);
        GlobalUnitKit->_wakeCallback(GlobalUnitKit->_pollData);
    }

    void syn_registerCallback (LibreOfficeKitDocument* pThis,
                               LibreOfficeKitCallback pCallback,
                               void* pData)
    {
        assert(GlobalUnitKit);
        GlobalUnitKit->_docCallback = pCallback;
        GlobalUnitKit->_docCallbackData = pData;
        GlobalUnitKit->_docClassClean->registerCallback(pThis, pCallback, pData);
    }

    LibreOfficeKitDocument* syn_documentLoadWithOptions (LibreOfficeKit* pThis,
                                                         const char* pURL,
                                                         const char* pOptions)
    {
        assert(GlobalUnitKit);

        // chain to parent
        LibreOfficeKitDocument *doc = GlobalUnitKit->_kitClassClean->documentLoadWithOptions(pThis, pURL, pOptions);

        GlobalUnitKit->_docClass = reinterpret_cast<LibreOfficeKitDocumentClass *>(memdup(doc->pClass, doc->pClass->nSize));
        GlobalUnitKit->_docClassClean = reinterpret_cast<LibreOfficeKitDocumentClass *>(memdup(doc->pClass, doc->pClass->nSize));
        doc->pClass = GlobalUnitKit->_docClass;

        GlobalUnitKit->_docClass->registerCallback = syn_registerCallback;

        return doc;
    }

    void syn_runLoop (LibreOfficeKit* pThis,
                      LibreOfficeKitPollCallback pPollCallback,
                      LibreOfficeKitWakeCallback pWakeCallback,
                      void* pData)
    {
        assert(GlobalUnitKit);

        GlobalUnitKit->_pollCallback = pPollCallback;
        GlobalUnitKit->_wakeCallback = pWakeCallback;
        GlobalUnitKit->_pollData = pData;

        GlobalUnitKit->_kitClassClean->runLoop(pThis, syn_pollCallback, syn_wakeCallback, pData);
    }
};

LibreOfficeKit *UnitKitSyntheticLok::lok_init(const char *instdir,
                                              const char *userdir,
                                              LokHookFunction2 fn)
{
    // Let the parent have a go
    _kit = fn(instdir, userdir);
    if (!_kit || !_kit->pClass)
        LOK_ASSERT_FAIL("Failed to get kit initialized");

    _kitClass = reinterpret_cast<LibreOfficeKitClass *>(memdup(_kit->pClass, _kit->pClass->nSize));
    _kitClassClean = reinterpret_cast<LibreOfficeKitClass *>(memdup(_kit->pClass, _kit->pClass->nSize));

    // switch to our vtable
    _kit->pClass = _kitClass;

    _kitClass->runLoop = syn_runLoop;
    _kitClass->documentLoadWithOptions = syn_documentLoadWithOptions;

    return _kit;
}

UnitBase* unit_create_wsd(void) { return new UnitSyntheticLok(); }

UnitBase *unit_create_kit(void) { return new UnitKitSyntheticLok(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
