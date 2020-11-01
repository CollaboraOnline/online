/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "HttpHelper.hpp"

#include <algorithm>
#include <string>
#include <zlib.h>

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <common/Common.hpp>
#include <common/FileUtil.hpp>
#include <common/Util.hpp>
#include <net/Socket.hpp>

namespace HttpHelper
{
void sendError(int errorCode, const std::shared_ptr<StreamSocket>& socket, const std::string& body,
               const std::string& extraHeader)
{
    std::ostringstream oss;
    oss << "HTTP/1.1 " << errorCode << "\r\n"
        << "Date: " << Util::getHttpTimeNow() << "\r\n"
        << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
        << "Content-Length: " << body.size() << "\r\n"
        << extraHeader << "\r\n"
        << body;
    socket->send(oss.str());
}

void sendErrorAndShutdown(int errorCode, const std::shared_ptr<StreamSocket>& socket,
                          const std::string& body, const std::string& extraHeader)
{
    sendError(errorCode, socket, body, extraHeader);
    socket->shutdown();
}

void sendUncompressedFileContent(const std::shared_ptr<StreamSocket>& socket,
                                 const std::string& path, const int bufferSize)
{
    std::ifstream file(path, std::ios::binary);
    std::unique_ptr<char[]> buf(new char[bufferSize]);
    do
    {
        file.read(&buf[0], bufferSize);
        const int size = file.gcount();
        if (size > 0)
            socket->send(&buf[0], size, true);
        else
            break;
    } while (file);
}

void sendDeflatedFileContent(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                             const int fileSize)
{
    // FIXME: Should compress once ahead of time
    // compression of bundle.js takes significant time:
    //   200's ms for level 9 (468k), 72ms for level 1(587k)
    //   down from 2Mb.
    if (fileSize > 0)
    {
        std::ifstream file(path, std::ios::binary);
        std::unique_ptr<char[]> buf(new char[fileSize]);
        file.read(&buf[0], fileSize);

        static const unsigned int Level = 1;
        const long unsigned int size = file.gcount();
        long unsigned int compSize = compressBound(size);
        std::unique_ptr<char[]> cbuf(new char[compSize]);
        compress2((Bytef*)&cbuf[0], &compSize, (Bytef*)&buf[0], size, Level);

        if (size > 0)
            socket->send(&cbuf[0], compSize, true);
    }
}

void sendFileAndShutdown(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         const std::string& mediaType, Poco::Net::HTTPResponse* optResponse,
                         const bool noCache, const bool deflate, const bool headerOnly)
{
    Poco::Net::HTTPResponse* response = optResponse;
    Poco::Net::HTTPResponse localResponse;
    if (!response)
        response = &localResponse;

    FileUtil::Stat st(path);
    if (st.bad())
    {
        LOG_WRN('#' << socket->getFD() << ": Failed to stat [" << path
                    << "]. File will not be sent.");
        throw Poco::FileNotFoundException("Failed to stat [" + path + "]. File will not be sent.");
    }

    if (!noCache)
    {
        // 60 * 60 * 24 * 128 (days) = 11059200
        response->set("Cache-Control", "max-age=11059200");
        response->set("ETag", "\"" LOOLWSD_VERSION_HASH "\"");
    }
    else
    {
        response->set("Cache-Control", "no-cache");
    }

    response->setContentType(mediaType);
    response->add("X-Content-Type-Options", "nosniff");

    int bufferSize = std::min<std::size_t>(st.size(), Socket::MaximumSendBufferSize);
    if (static_cast<long>(st.size()) >= socket->getSendBufferSize())
    {
        socket->setSocketBufferSize(bufferSize);
        bufferSize = socket->getSendBufferSize();
    }

    // Disable deflate for now - until we can cache deflated data.
    // FIXME: IE/Edge doesn't work well with deflate, so check with
    // IE/Edge before enabling the deflate again
    if (!deflate || true)
    {
        response->setContentLength(st.size());
        LOG_TRC('#' << socket->getFD() << ": Sending " << (headerOnly ? "header for " : "")
                    << " file [" << path << "].");
        socket->send(*response);

        if (!headerOnly)
            sendUncompressedFileContent(socket, path, bufferSize);
    }
    else
    {
        response->set("Content-Encoding", "deflate");
        LOG_TRC('#' << socket->getFD() << ": Sending " << (headerOnly ? "header for " : "")
                    << " file [" << path << "].");
        socket->send(*response);

        if (!headerOnly)
            sendDeflatedFileContent(socket, path, st.size());
    }
    socket->shutdown();
}

} // namespace HttpHelper
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
