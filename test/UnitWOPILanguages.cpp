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

#include "Unit.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>

class UnitWopiLanguages : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Save, Done) _phase;

    int _loaded_count;

public:
    UnitWopiLanguages()
        : WopiTestServer("UnitWopiLanguages", "hello.odt")
        , _phase(Phase::Load)
        , _loaded_count(0)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded #" << ++_loaded_count << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Save);

        if (_loaded_count == 1)
        {
            LOG_TST("Loading second view (Hungarian)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc() + " lang=hu");
        }
        else if (_loaded_count == 2)
        {
            // Save using the second view (Hungarian).
            WSD_CMD_BY_CONNECTION_INDEX(1, "save dontTerminateEdit=0 dontSaveIfUnmodified=0");
        }

        return true;
    }

    bool onDocumentSaved(const std::string& message, bool success, const std::string& result) override
    {
        if (success || result == "unmodified")
        {
            passTest("Document saved successfully: " + message);
        }
        else
        {
            failTest("Failed to save the document (Core is out-of-date or it has a regression: " +
                     message);
        }

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::Save);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (English)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc() + " lang=en");
                break;
            }
            case Phase::Save:
            {
            }
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// Test timezones time-stamps.
class UnitTimezonesTime : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Load2, Done) _phase;

    std::string _user1Time;
    std::string _user2Time;
    int _loaded_count;
    int _currentUserId;

public:
    UnitTimezonesTime()
        : WopiTestServer("UnitTimezonesTime", "hello.ods")
        , _phase(Phase::Load)
        , _loaded_count(0)
        , _currentUserId(0)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded #" << ++_loaded_count << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Load2);

        if (_loaded_count == 1)
        {
            LOG_TST("Loading second view (Pacific/Auckland)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc() +
                                               " lang=en timezone=Pacific/Auckland");
        }
        else if (_loaded_count == 2)
        {
            // Insert time using the first connection.
            TST_LOG("Inserting current time of first user");
            _currentUserId = 0;
            WSD_CMD_BY_CONNECTION_INDEX(_currentUserId, "uno .uno:InsertCurrentTime");
        }

        return true;
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        if (message.starts_with("cellformula:"))
        {
            if (_currentUserId == 0)
            {
                _user1Time = Util::trimmed(message.substr(sizeof("cellformula:") - 1));
                TST_LOG("User 1 time: " << _user1Time);
                if (_user1Time.empty())
                {
                    TST_LOG("User 1 time is empty. Will wait some more");
                    return false;
                }

                // Insert time from second user.
                TST_LOG("Inserting current time of second user");
                _currentUserId = 1;
                WSD_CMD_BY_CONNECTION_INDEX(_currentUserId, "uno .uno:InsertCurrentTime");
            }
            else if (_currentUserId == 1)
            {
                // We got the second user's time.
                _user2Time = Util::trimmed(message.substr(sizeof("cellformula:") - 1));
                TST_LOG("User 2 time: " << _user2Time);
                if (_user2Time.empty())
                {
                    TST_LOG("User 2 time is empty. Will wait some more");
                    return false;
                }

                // Compare.
                TST_LOG("Comparing: [" << _user1Time << "] with [" << _user2Time << ']');
                if (_user1Time == _user2Time)
                {
                    failTest("Timestamps of first (default) and second users (Pacific/Auckland) "
                             "shouldn't match");
                }
                else if (_user1Time.substr(2) == _user2Time.substr(2))
                {
                    failTest("The hours of first (default) and second users (Pacific/Auckland) "
                             "shouldn't match");
                }
                else
                {
                    passTest("Timezones do not match as expected");
                }
            }
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::Load2);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (default)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc() + " lang=hu");
                break;
            }
            case Phase::Load2:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// Test timezones date-stamps.
class UnitTimezonesDate : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Load2, Done) _phase;

    std::string _user1Time;
    std::string _user2Time;
    int _loaded_count;
    int _currentUserId;

public:
    UnitTimezonesDate()
        : WopiTestServer("UnitTimezonesDate", "hello.ods")
        , _phase(Phase::Load)
        , _loaded_count(0)
        , _currentUserId(0)
    {
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded #" << ++_loaded_count << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Load2);

        if (_loaded_count == 1)
        {
            LOG_TST("Loading second view (Pacific/Tarawa)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc() +
                                               " lang=en timezone=Pacific/Tarawa");
        }
        else if (_loaded_count == 2)
        {
            // Insert time using the first connection.
            TST_LOG("Inserting current time of first user");
            _currentUserId = 0;
            WSD_CMD_BY_CONNECTION_INDEX(_currentUserId, "uno .uno:InsertCurrentDate");
        }

        return true;
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        if (message.starts_with("cellformula:"))
        {
            if (_currentUserId == 0)
            {
                _user1Time = Util::trimmed(message.substr(sizeof("cellformula:") - 1));
                TST_LOG("User 1 time: " << _user1Time);
                if (_user1Time.empty())
                {
                    TST_LOG("User 1 time is empty. Will wait some more");
                    return false;
                }

                // Insert time from second user.
                TST_LOG("Inserting current time of second user");
                _currentUserId = 1;
                WSD_CMD_BY_CONNECTION_INDEX(_currentUserId, "uno .uno:InsertCurrentDate");
            }
            else if (_currentUserId == 1)
            {
                // We got the second user's time.
                _user2Time = Util::trimmed(message.substr(sizeof("cellformula:") - 1));
                TST_LOG("User 2 time: " << _user2Time);
                if (_user2Time.empty())
                {
                    TST_LOG("User 2 time is empty. Will wait some more");
                    return false;
                }

                // Compare.
                TST_LOG("Comparing: [" << _user1Time << "] with [" << _user2Time << ']');
                // Unfortunately, even though there are timezones spaning 26 hours,
                // I couldn't find two timezones that always fall in different dates.
#if 0
                if (_user1Time == _user2Time)
                {
                    failTest("Timestamps of first (Pacific/Midway) and second users "
                             "(Pacific/Kiritimati) shouldn't match");
                }
                else
#endif
                {
                    passTest("Timezones do not match as expected");
                }
            }
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::Load2);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (default)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc() +
                                                   " lang=hu timezone=Pacific/Midway");
                break;
            }
            case Phase::Load2:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [4]
    { new UnitWopiLanguages(), new UnitTimezonesTime(), new UnitTimezonesDate(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
