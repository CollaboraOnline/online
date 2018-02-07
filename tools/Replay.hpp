/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_REPLAY_HPP
#define INCLUDED_REPLAY_HPP

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>

#include <LOOLWebSocket.hpp>

#include "TraceFile.hpp"
#include <test/helpers.hpp>

/// Connection class with WSD.
class Connection
{
public:
    static
    std::shared_ptr<Connection> create(const std::string& serverURI, const std::string& documentURL, const std::string& sessionId)
    {
        try
        {
            Poco::URI uri(serverURI);

            std::unique_lock<std::mutex> lock(Mutex);

            // Load a document and get its status.
            std::cout << "NewSession [" << sessionId << "]: " << uri.toString() << "... ";

            std::string encodedUri;
            Poco::URI::encode(documentURL, ":/?", encodedUri);
            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/lool/" + encodedUri + "/ws");
            Poco::Net::HTTPResponse response;
            std::shared_ptr<LOOLWebSocket> ws = helpers::connectLOKit(uri, request, response, sessionId + ' ');
            std::cout << "Connected to " << serverURI << ".\n";
            return std::shared_ptr<Connection>(new Connection(documentURL, sessionId, ws));
        }
        catch (const std::exception& exc)
        {
            std::cout << "ERROR while connecting to [" << serverURI << "]: " << exc.what() << std::endl;
            return nullptr;
        }
    }

    const std::string& getName() const { return _name; }
    std::shared_ptr<LOOLWebSocket> getWS() const { return _ws; };

    /// Send a command to the server.
    bool send(const std::string& data) const
    {
        try
        {
            helpers::sendTextFrame(_ws, data, _name);
            return true;
        }
        catch (const std::exception& exc)
        {
            std::cout << "Error in " << _name << " while sending ["
                      << data << "]: " << exc.what() << std::endl;
        }

        return false;
    }

    /// Poll socket until expected prefix is fetched, or timeout.
    std::vector<char> recv(const std::string& prefix)
    {
        return helpers::getResponseMessage(_ws, prefix, _name);
    }

    /// Request loading the document and wait for completion.
    bool load()
    {
        send("load url=" + _documentURL);
        return helpers::isDocumentLoaded(_ws, _name);
    }

private:
    Connection(const std::string& documentURL, const std::string& sessionId, std::shared_ptr<LOOLWebSocket>& ws) :
        _documentURL(documentURL),
        _sessionId(sessionId),
        _name(sessionId + ' '),
        _ws(ws)
    {
    }

private:
    const std::string _documentURL;
    const std::string _sessionId;
    const std::string _name;
    std::shared_ptr<LOOLWebSocket> _ws;
    static std::mutex Mutex;
};

/// Main thread class to replay a trace file.
class Replay : public Poco::Runnable
{
public:

    Replay(const std::string& serverUri, const std::string& uri, bool ignoreTiming = true) :
        _serverUri(serverUri),
        _uri(uri),
        _ignoreTiming(ignoreTiming)
    {
    }

    void run() override
    {
        try
        {
            replay();
        }
        catch (const Poco::Exception &e)
        {
            std::cout << "Error: " << e.name() << ' ' << e.message() << std::endl;
        }
        catch (const std::exception &e)
        {
            std::cout << "Error: " << e.what() << std::endl;
        }
    }

protected:

    void replay()
    {
        TraceFileReader traceFile(_uri);

        Poco::Int64 epochFile(traceFile.getEpochStart());
        auto epochCurrent = std::chrono::steady_clock::now();

        const Poco::Int64 replayDuration = (traceFile.getEpochEnd() - epochFile);
        std::cout << "Replaying file [" << _uri << "] of " << replayDuration / 1000000. << " second length." << std::endl;

        for (;;)
        {
            const TraceFileRecord rec = traceFile.getNextRecord();
            if (rec.Dir == TraceFileRecord::Direction::Invalid)
            {
                // End of trace file.
                break;
            }

            const std::chrono::microseconds::rep deltaCurrent = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - epochCurrent).count();
            const unsigned deltaFile = rec.TimestampNs - epochFile;
            const unsigned delay = (_ignoreTiming ? 0 : deltaFile - deltaCurrent);
            if (delay > 0)
            {
                if (delay > 1e6)
                {
                    std::cout << "Sleeping for " << delay / 1000 << " ms.\n";
                }

                std::this_thread::sleep_for(std::chrono::microseconds(delay));
            }

            std::cout << rec.toString() << std::endl;

            if (rec.Dir == TraceFileRecord::Direction::Event)
            {
                // Meta info about about an event.
                static const std::string NewSession("NewSession: ");
                static const std::string EndSession("EndSession: ");

                if (rec.Payload.find(NewSession) == 0)
                {
                    const std::string uriOrig = rec.Payload.substr(NewSession.size());
                    std::string uri;
                    Poco::URI::decode(uriOrig, uri);
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        // Add a new session.
                        if (it->second.find(rec.SessionId) != it->second.end())
                        {
                            std::cout << "ERROR: session [" << rec.SessionId << "] already exists on doc [" << uri << "]\n";
                        }
                        else
                        {
                            std::shared_ptr<Connection> connection = Connection::create(_serverUri, uri, rec.SessionId);
                            if (connection)
                            {
                                it->second.emplace(rec.SessionId, connection);
                            }
                        }
                    }
                    else
                    {
                        std::cout << "New Document: " << uri << "\n";
                        _childToDoc.emplace(rec.Pid, uri);
                        std::shared_ptr<Connection> connection = Connection::create(_serverUri, uri, rec.SessionId);
                        if (connection)
                        {
                            _sessions[uri].emplace(rec.SessionId, connection);
                        }
                    }
                }
                else if (rec.Payload.find(EndSession) == 0)
                {
                    const std::string uriOrig = rec.Payload.substr(EndSession.size());
                    std::string uri;
                    Poco::URI::decode(uriOrig, uri);
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        std::cout << "EndSession [" << rec.SessionId << "]: " << uri << "\n";

                        it->second.erase(rec.SessionId);
                        if (it->second.empty())
                        {
                            std::cout << "End Doc [" << uri << "].\n";
                            _sessions.erase(it);
                            _childToDoc.erase(rec.Pid);
                        }
                    }
                    else
                    {
                        std::cout << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
            }
            else if (rec.Dir == TraceFileRecord::Direction::Incoming)
            {
                auto docIt = _childToDoc.find(rec.Pid);
                if (docIt != _childToDoc.end())
                {
                    const auto& uri = docIt->second;
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        const auto sessionIt = it->second.find(rec.SessionId);
                        if (sessionIt != it->second.end())
                        {
                            // Send the command.
                            if (!sessionIt->second->send(rec.Payload))
                            {
                                it->second.erase(sessionIt);
                            }
                        }
                        else
                        {
                            std::cout << "ERROR: Session [" << rec.SessionId << "] does not exist.\n";
                        }
                    }
                    else
                    {
                        std::cout << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
                else
                {
                    std::cout << "ERROR: Unknown PID [" << rec.Pid << "] maps to no active document.\n";
                }
            }
            else
            {
                std::cout << "ERROR: Unknown trace file direction [" << static_cast<char>(rec.Dir) << "].\n";
            }

            epochCurrent = std::chrono::steady_clock::now();
            epochFile = rec.TimestampNs;
        }
    }

protected:
    const std::string _serverUri;
    const std::string _uri;

    /// Should we ignore timing that is saved in the trace file?
    bool _ignoreTiming;

    /// LOK child process PID to Doc URI map.
    std::map<unsigned, std::string> _childToDoc;

    /// Doc URI to _sessions map. _sessions are maps of SessionID to Connection.
    std::map<std::string, std::map<std::string, std::shared_ptr<Connection>>> _sessions;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
