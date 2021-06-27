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
    SslStreamSocket(const std::string hostname, const int fd, bool isClient,
                    std::shared_ptr<ProtocolHandlerInterface> responseClient,
                    ReadType readType = NormalRead)
        : StreamSocket(std::move(hostname), fd, isClient, std::move(responseClient), readType)
        , _bio(nullptr)
        , _ssl(nullptr)
        , _sslWantsTo(SslWantsTo::Neither)
        , _doHandshake(true)
    {
        LOG_DBG("SslStreamSocket ctor #" << fd);

        _bio = BIO_new(BIO_s_socket());
        if (_bio == nullptr)
        {
            throw std::runtime_error("Failed to create SSL BIO.");
        }

        BIO_set_fd(_bio, fd, BIO_NOCLOSE);

        _ssl = isClient ? ssl::Manager::newClientSsl() : ssl::Manager::newServerSsl();
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
        ASSERT_CORRECT_SOCKET_THREAD(this);

        const int rc = doHandshake();
        if (rc <= 0)
            return rc != 0;

        // Default implementation.
        return StreamSocket::readIncomingData();
    }

    void writeOutgoingData() override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

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
        ASSERT_CORRECT_SOCKET_THREAD(this);

#if ENABLE_DEBUG
        if (simulateSocketError(true))
            return -1;
#endif
        return handleSslState(SSL_read(_ssl, buf, len));
    }

    virtual int writeData(const char* buf, const int len) override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

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
        ASSERT_CORRECT_SOCKET_THREAD(this);
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
        ASSERT_CORRECT_SOCKET_THREAD(this);

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

            if (rc == 1)
            {
                // Successful handshake; TLS/SSL connection established.
                if (!verifyCertificate())
                {
                    LOG_WRN("Failed to verify the certificate of [" << hostname() << ']');
                    closeConnection();
                    return 0;
                }
            }
        }

        // Handshake complete.
        return 1;
    }

    /// Verify the peer's certificate.
    /// Return true iff the certificate matches the hostname.
    bool verifyCertificate();

    /// Handles the state of SSL after read or write.
    int handleSslState(const int rc)
    {
        const auto last_errno = errno;

        ASSERT_CORRECT_SOCKET_THREAD(this);

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
            errno = last_errno; // Restore errno.
            return 0;

        case SSL_ERROR_WANT_READ:
#if OPENSSL_VERSION_NUMBER > 0x10100000L
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_READ (" << sslError <<
                    ") has_pending " << SSL_has_pending(_ssl) << " bytes: " << SSL_pending(_ssl) << ".");
#else
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_READ (" << sslError << ").");
#endif
            _sslWantsTo = SslWantsTo::Read;
            errno = last_errno; // Restore errno.
            return rc;

        case SSL_ERROR_WANT_WRITE:
#if OPENSSL_VERSION_NUMBER > 0x10100000L
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_WRITE (" << sslError <<
                    ") has_pending " << SSL_has_pending(_ssl) << " bytes: " << SSL_pending(_ssl) << ".");
#else
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_WRITE (" << sslError << ").");
#endif
            _sslWantsTo = SslWantsTo::Write;
            errno = last_errno; // Restore errno.
            return rc;

        case SSL_ERROR_WANT_CONNECT:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_CONNECT (" << sslError << ").");
            errno = last_errno; // Restore errno.
            return rc;

        case SSL_ERROR_WANT_ACCEPT:
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_ACCEPT (" << sslError << ").");
            errno = last_errno; // Restore errno.
            return rc;

        case SSL_ERROR_WANT_X509_LOOKUP:
            // Unexpected.
            LOG_TRC("Socket #" << getFD() << " SSL error: WANT_X509_LOOKUP (" << sslError << ").");
            errno = last_errno; // Restore errno.
            return rc;

        case SSL_ERROR_SYSCALL:
            if (last_errno != 0)
            {
                // Posix API error, let the caller handle.
                LOG_SYS_ERRNO(last_errno,
                              "Socket #" << getFD() << " SSL error: SYSCALL (" << sslError << ')');
                errno = last_errno; // Restore errno.
                return rc;
            }

            // Fallthrough...
        default:
            {
                // Effectively an EAGAIN error at the BIO layer
                if (BIO_should_retry(_bio))
                {
#if OPENSSL_VERSION_NUMBER > 0x10100000L
                    LOG_TRC("Socket #" << getFD() << " BIO asks for retry - underlying EAGAIN? " <<
                            SSL_get_error(_ssl, rc) << " has_pending " << SSL_has_pending(_ssl) <<
                            " bytes: " << SSL_pending(_ssl) << ".");
#else
                    LOG_TRC("Socket #" << getFD() << " BIO asks for retry - underlying EAGAIN? " <<
                            SSL_get_error(_ssl, rc));
#endif
                    errno = last_errno ? last_errno : EAGAIN; // Restore errno.
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
                        errno = last_errno; // Restore errno.
                        return 0;
                    }
                    else if (rc == -1)
                    {
                        LOG_SYS_ERRNO(last_errno,
                                      "Socket #" << getFD()
                                                 << " SSL BIO error: closed unexpectedly (-1)");
                        errno = last_errno; // Restore errno.
                        throw std::runtime_error("SSL Socket closed unexpectedly.");
                    }
                    else
                    {
                        LOG_SYS_ERRNO(last_errno, "Socket #" << getFD()
                                                             << " SSL BIO error: unknown (" << rc
                                                             << ')');
                        errno = last_errno; // Restore errno.
                        throw std::runtime_error("SSL BIO reported error [" + std::to_string(rc)
                                                 + ']');
                    }
                }
                else
                {
                    char buf[512];
                    ERR_error_string_n(bioError, buf, sizeof(buf));
                    LOG_SYS_ERRNO(last_errno, "Socket #" << getFD() << " SSL BIO error: " << buf);
                    errno = last_errno; // Restore errno.
                    throw std::runtime_error(buf);
                }
            }
            break;
        }

        errno = last_errno; // Restore errno.
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
