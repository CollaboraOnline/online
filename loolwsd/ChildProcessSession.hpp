/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLCHILDPROCESSSESSION_HPP
#define INCLUDED_LOOLCHILDPROCESSSESSION_HPP

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>

#include <Poco/StringTokenizer.h>

#include "LOOLSession.hpp"

class ChildProcessSession final : public LOOLSession
{
public:
    ChildProcessSession(std::shared_ptr<Poco::Net::WebSocket> ws, LibreOfficeKit *loKit);
    virtual ~ChildProcessSession();

    virtual bool handleInput(const char *buffer, int length) override;

    virtual bool getStatus(const char *buffer, int length);

    LibreOfficeKitDocument *_loKitDocument;

 protected:
    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) override;

    virtual void sendTile(const char *buffer, int length, Poco::StringTokenizer& tokens);

    bool getTextSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool keyEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool mouseEvent(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool unoCommand(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectText(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool selectGraphic(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool resetSelection(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool saveAs(const char *buffer, int length, Poco::StringTokenizer& tokens);
    bool setClientPart(const char *buffer, int length, Poco::StringTokenizer& tokens);

    std::string _jail;
    std::string _loSubPath;
    LibreOfficeKit *_loKit;

 private:
    int _clientPart;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
