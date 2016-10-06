/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <mutex>
#include <cassert>
#include <memory>
#include <condition_variable>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

#include "LibreOfficeKit.hpp"

#include <cppunit/extensions/HelperMacros.h>

class TestLOKit : public CPPUNIT_NS::TestFixture
{
    std::shared_ptr<lok::Office> _loKit;

    CPPUNIT_TEST_SUITE(TestLOKit);

    CPPUNIT_TEST(testAutoSum);

    CPPUNIT_TEST_SUITE_END();

    void testAutoSum();

public:
    bool _readyCallback;
    std::string _cellFormula;
    std::condition_variable _cvCallback;

    TestLOKit()
    {
        char* userdir = getenv("JAIL_PATH");
        CPPUNIT_ASSERT_MESSAGE("JAIL_PATH env variable not set", userdir != nullptr);

        char* instdir = getenv("LO_PATH");
        CPPUNIT_ASSERT_MESSAGE("LO_PATH env variable not set", instdir != nullptr);

        _loKit = std::make_shared<lok::Office>(lok_init_2(instdir, userdir));
        if (!_loKit || !_loKit->get())
        {
            CPPUNIT_FAIL("LibreOfficeKit initialization failed.");
        }
    }

    ~TestLOKit()
    {
    }

    static void ViewCallback(const int type, const char* payload, void* data)
    {
        if (data == nullptr)
        {
            CPPUNIT_FAIL("Data is nullptr");
        }

        TestLOKit* test = static_cast<TestLOKit*>(data);

        switch (type)
        {
            case LOK_CALLBACK_CELL_FORMULA:
            {
                test->_cellFormula = payload;
                test->_readyCallback = true;
                test->_cvCallback.notify_one();
            }
        }
    }

    void setUp()
    {
    }

    void tearDown()
    {
    }
};

void TestLOKit::testAutoSum()
{
    std::shared_ptr<lok::Document> doc = _loKit->documentLoad(TDOC"/empty.ods");
    CPPUNIT_ASSERT(doc);

    std::mutex mutex;
    doc->initializeForRendering("");
    doc->registerCallback(ViewCallback, this);
    doc->postUnoCommand(".uno:AutoSum");

    std::unique_lock<std::mutex> lock(mutex);
    _cvCallback.wait_for(lock, std::chrono::seconds(2), [this] { return _readyCallback; });
    doc->registerCallback(nullptr, nullptr);
    CPPUNIT_ASSERT(_cellFormula.find("=SUM(") != std::string::npos);
}

CPPUNIT_TEST_SUITE_REGISTRATION(TestLOKit);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
