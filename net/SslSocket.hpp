/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cerrno>

#include "Ssl.hpp"
#include "Socket.hpp"

/// An SSL/TSL, non-blocking, data streaming socket.
class SslStreamSocket final : public StreamSocket
{
public:
    SslStreamSocket(const int fd, bool isClient,
                    std::shared_ptr<ProtocolHandlerInterface> responseClient,
                    ReadType readType = NormalRead) :
        StreamSocket(fd, isClient, std::move(responseClient), readType),
        _bio(nullptr),
        _ssl(nullptr),
        _sslWantsTo(SslWantsTo::Neither),
        _doHandshake(true)
    {
        LOG_DBG("SslStreamSocket ctor #" << fd);

        _bio = BIO_new(BIO_s_socket());
        if (_bio == nullptr)
        {
            throw std::runtime_error("Failed to create SSL BIO.");
        }

        BIO_set_fd(_bio, fd, BIO_NOCLOSE);

        _ssl = SslContext::newSsl();
        if (!_ssl)
        {
            BIO_free(_bio);
            _bio = nullptr;
            throw std::runtime_error("Failed to create SSL.");
        }

        SSL_set_bio(_ssl, _bio, _bio);

        if (isClient)
        {
            SSL_set_connect_state(_ssl);
            if (SSL_connect(_ssl) == 0)
                LOG_DBG("SslStreamSocket connect #" << getFD() << " failed ");
            // else -1 is quite possibly SSL_ERROR_WANT_READ
        }
        else // We are a server-side socket.
            SSL_set_accept_state(_ssl);
    }

    ~SslStreamSocket()
    {
        LOG_DBG("SslStreamSocket dtor #" << getFD());

        if (!isShutdownSignalled())
        {
            setShutdownSignalled();
            SslStreamSocket::closeConnection();
        }

        SSL_free(_ssl);
    }

    /// Shutdown the TLS/SSL connection properly.
    void closeConnection() override
    {
        LOG_DBG("SslStreamSocket::closeConnection() #" << getFD());
        if (SSL_shutdown(_ssl) == 0)
        {
            // Complete the bidirectional shutdown.
            SSL_shutdown(_ssl);
        }

        // Close the TCP Socket.
        Socket::shutdown();
    }

    bool readIncomingData() override
    {
        assertCorrectThread();

        const int rc = doHandshake();
        if (rc <= 0)
            return rc != 0;

        // Default implementation.
        return StreamSocket::readIncomingData();
    }

    void writeOutgoingData() override
    {
        assertCorrectThread();

        const int rc = doHandshake();
        if (rc <= 0)
        {
            return;
        }

        // Default implementation.
        StreamSocket::writeOutgoingData();
    }

    virtual int readData(char* buf, int len) override
    {
        assertCorrectThread();

#if ENABLE_DEBUG
        if (simulateSocketError(true))
            return -1;
#endif
        return handleSslState(SSL_read(_ssl, buf, len));
    }

    virtual int writeData(const char* buf, const int len) override
    {
        assertCorrectThread();

        assert (len > 0); // Never write 0 bytes.

#if ENABLE_DEBUG
        if (simulateSocketError(false))
            return -1;
#endif
        return handleSslState(SSL_write(_ssl, buf, len));
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t & timeoutMaxMicroS) override
    {
        assertCorrectThread();
        int events = StreamSocket::getPollEvents(now, timeoutMaxMicroS); // Default to base.
        if (_sslWantsTo == SslWantsTo::Write) // If OpenSSL wants to write (and we don't).
            events |= POLLOUT;

        return events;
    }

private:
#if ENABLE_DEBUG
    /// Return true and set errno to simulate an error
    virtual bool simulateSocketError(bool read) override;
#endif

    /// The possible next I/O operation that SSL want to do.
    enum class SslWantsTo
    {
        Neither,
        Read,
        Write
    };

    int doHandshake()
    {
        assertCorrectThread();

        if (_doHandshake)
        {
            int rc;
            do
            {
                rc = SSL_do_handshake(_ssl);
            }
            while (rc < 0 && errno == EINTR);

            if (rc <= 0)
            {
                rc = handleSslState(rc);
                if (rc <= 0)
                    return rc != 0;
            }

            _doHandshake = false;
        }

        // Handshake complete.
        return 1;
    }

    /// Handles the state of SSL after read or write.
    int handleSslState(const int rc)
    {
        assertCorrectThread();

        if (rc > 0)
        {
            // Success: Reset so we can do either.
            _sslWantsTo = SslWantsTo::Neither;
            return rc;
        }

        // Last operation failed. Find out if SSL was trying
        // to do something different that failed, or not.
        const int sslError = SSL_get_error(_ssl, rc);
        switch (sslError)
        {
        case SSL_ERROR_ZERO_RETURN:
            // Shutdown complete, we're disconnected.
            LOG_TRC("Socket #" << getFD() << " SSL error: ZERO_RETURN (" << sslError << ").");
            return 0;

        case SSL_ERROR_WANT_READ:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_READ (" << sslError << ").");
            _sslWantsTo = SslWantsTo::Read;
            return rc;

        case SSL_ERROR_WANT_WRITE:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_WRITE (" << sslError << ").");
            _sslWantsTo = SslWantsTo::Write;
            return rc;

        case SSL_ERROR_WANT_CONNECT:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_CONNECT (" << sslError << ").");
            return rc;

        case SSL_ERROR_WANT_ACCEPT:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_ACCEPT (" << sslError << ").");
            return rc;

        case SSL_ERROR_WANT_X509_LOOKUP:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_X509_LOOKUP (" << sslError << ").");
            // Unexpected.
            return rc;

        case SSL_ERROR_SYSCALL:
            if (errno != 0)
            {
                // Posix API error, let the caller handle.
                LOG_SYS("Socket #" << getFD() << " SSL error: SYSCALL (" << sslError << ").");
                return rc;
            }

            // Fallthrough...
        default:
            {
                // Effectively an EAGAIN error at the BIO layer
                if (BIO_should_retry(_bio))
                {
                    LOG_TRC("Socket #" << getFD() << " BIO asks for retry - underlying EAGAIN? " <<
                            SSL_get_error(_ssl, rc));
                    return -1; // poll is used to detect real errors.
                }

                if (sslError == SSL_ERROR_SSL)
                    LOG_TRC("Socket #" << getFD() << " SSL error: SSL (" << sslError << ").");
                else if (sslError == SSL_ERROR_SYSCALL)
                    LOG_TRC("Socket #" << getFD() << " SSL error: SYSCALL (" << sslError << ").");
#if 0 // Recent OpenSSL only
                else if (sslError == SSL_ERROR_WANT_ASYNC)
                    LOG_TRC("Socket #" << getFD() << " SSL error: WANT_ASYNC (" << sslError << ").");
                else if (sslError == SSL_ERROR_WANT_ASYNC_JOB)
                    LOG_TRC("Socket #" << getFD() << " SSL error: WANT_ASYNC_JOB (" << sslError << ").");
#endif
                else
                    LOG_TRC("Socket #" << getFD() << " SSL error: UNKNOWN (" << sslError << ").");

                // The error is comming from BIO. Find out what happened.
                const long bioError = ERR_get_error();
                if (bioError == 0)
                {
                    if (rc == 0)
                    {
                        // Socket closed. Not an error.
                        LOG_INF("Socket #" << getFD() << " SSL BIO error: closed (0).");
                        return 0;
                    }
                    else if (rc == -1)
                    {
                        LOG_SYS("Socket #" << getFD() << " SSL BIO error: closed unexpectedly (-1).");
                        throw std::runtime_error("SSL Socket closed unexpectedly.");
                    }
                    else
                    {
                        LOG_SYS("Socket #" << getFD() << " SSL BIO error: unknown (" << rc << ").");
                        throw std::runtime_error("SSL BIO reported error [" + std::to_string(rc) + "].");
                    }
                }
                else
                {
                    char buf[512];
                    ERR_error_string_n(bioError, buf, sizeof(buf));
                    LOG_SYS("Socket #" << getFD() << " SSL BIO error: " << buf);
                    throw std::runtime_error(buf);
                }
            }
            break;
        }

        return rc;
    }

private:
    BIO* _bio;
    SSL* _ssl;
    /// During handshake SSL might want to read
    /// on write, or write on read.
    SslWantsTo _sslWantsTo;
    /// We must do the handshake during the first
    /// read or write in non-blocking.
    bool _doHandshake;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
