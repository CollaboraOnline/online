/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cerrno>
#include <memory>
#include <sstream>
#include <string>

#include "Common.hpp"
#include "Ssl.hpp"
#include "Socket.hpp"

/// An SSL/TSL, non-blocking, data streaming socket.
class SslStreamSocket final : public StreamSocket
{
public:
    SslStreamSocket(const std::string& host, const int fd, bool isClient,
                    std::shared_ptr<ProtocolHandlerInterface> responseClient,
                    ReadType readType = NormalRead)
        : StreamSocket(host, fd, isClient, std::move(responseClient), readType)
        , _bio(nullptr)
        , _ssl(nullptr)
        , _sslWantsTo(SslWantsTo::Neither)
        , _doHandshake(true)
    {
        LOG_TRC("SslStreamSocket ctor #" << fd);

        _bio = BIO_new(BIO_s_socket());
        if (_bio == nullptr)
        {
            throw std::runtime_error("Failed to create SSL BIO.");
        }

        BIO_set_fd(_bio, fd, BIO_NOCLOSE);

        _ssl = isClient ? ssl::Manager::newClientSsl(_verification)
                        : ssl::Manager::newServerSsl(_verification);
        if (!_ssl)
        {
            BIO_free(_bio);
            _bio = nullptr;
            throw std::runtime_error("Failed to create SSL.");
        }

        if (!hostname().empty())
        {
            if (!SSL_set_tlsext_host_name(_ssl, hostname().c_str()))
                LOG_WRN("Failed to set hostname for Server Name Indication [" << hostname() << ']');
            else
                LOG_TRC("Set [" << hostname() << "] as TLS hostname.");
        }

        SSL_set_bio(_ssl, _bio, _bio);

        if (isClient)
        {
            LOG_TRC("Setting SSL into connect state");
            SSL_set_connect_state(_ssl);
            if (SSL_connect(_ssl) == 0)
                LOG_DBG("SslStreamSocket connect #" << getFD() << " failed ");
            // else -1 is quite possibly SSL_ERROR_WANT_READ
        }
        else // We are a server-side socket.
        {
            LOG_TRC("Setting SSL into accept state");
            SSL_set_accept_state(_ssl);
        }
    }

    ~SslStreamSocket()
    {
        LOG_TRC("SslStreamSocket dtor #" << getFD());

        if (!isShutdownSignalled())
        {
            setShutdownSignalled();
            SslStreamSocket::closeConnection();
        }

        SSL_free(_ssl);
    }

    /// Returns the servername per the SSL, as set by
    /// SSL_set_tlsext_host_name, if called. For testing.
    std::string getSslServername() const
    {
        const int type = SSL_get_servername_type(_ssl);
        if (type != -1)
        {
            const char* name = SSL_get_servername(_ssl, type);
            if (name)
            {
                return std::string(name);
            }
        }

        return std::string();
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

    int readIncomingData() override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        const int rc = doHandshake();
        if (rc <= 0)
        {
            // 0 means shutdown.
            return rc;
        }

        // Default implementation.
        return StreamSocket::readIncomingData();
    }

    int writeOutgoingData() override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        const int rc = doHandshake();
        if (rc <= 0)
        {
            // 0 means shutdown.
            return rc;
        }

        // Default implementation.
        return StreamSocket::writeOutgoingData();
    }

    virtual int readData(char* buf, int len) override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        // avoided in readIncomingData
        if (ignoringInput())
            return -1;

#if ENABLE_DEBUG
        if (simulateSocketError(true))
            return -1;
#endif
        return handleSslState(SSL_read(_ssl, buf, len), "read");
    }

    virtual int writeData(const char* buf, const int len) override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        assert (len > 0); // Never write 0 bytes.

#if ENABLE_DEBUG
        if (simulateSocketError(false))
            return -1;
#endif
        return handleSslState(SSL_write(_ssl, buf, len), "write");
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t & timeoutMaxMicroS) override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        // We cannot communicate with a client when SSL wants
        // to negotiate the handshake. Here, we give priority to
        // SSL's needs. Only when SSL is done negotiating
        // (i.e. wants neither to read, nor to write) do we see
        // what data activity we have.
        if (_doHandshake)
        {
            if (_sslWantsTo == SslWantsTo::Write)
            {
                return POLLOUT;
            }

            if (_sslWantsTo == SslWantsTo::Read)
            {
                return POLLIN;
            }

            // The first call will have SslWantsTo::Neither and
            // we will fall-through and call the base.
        }

        int events = StreamSocket::getPollEvents(now, timeoutMaxMicroS); // Default to base.
        if (_sslWantsTo == SslWantsTo::Write) // If OpenSSL wants to write (and we don't).
            events |= POLLOUT;

        return events;
    }

private:
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
                rc = handleSslState(rc, "handshake");
                if (rc <= 0)
                {
                    // 0 means shutdown.
                    return rc;
                }
            }

            if (rc == 1)
            {
                // Successful handshake; TLS/SSL connection established.
                LOG_TRC("SSL handshake completed successfully");
                _doHandshake = false;
                _sslWantsTo = SslWantsTo::Neither; // Reset until we are told otherwise.

                if (!verifyCertificate())
                {
                    LOG_WRN("Failed to verify the certificate of [" << hostname() << ']');
                    closeConnection();
                    return 0; // Connection is closed.
                }
            }
            else
            {
                LOG_ERR("Unexpected return code from SSL_do_handshake: " << rc);
                return rc;
            }
        }

        // Handshake complete.
        return 1;
    }

    /// Verify the peer's certificate.
    /// Return true iff the certificate matches the hostname.
    bool verifyCertificate();

    /// Handles the state of SSL after read or write.
    int handleSslState(const int rc, const char* context)
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
                LOG_TRC("SSL error (" << context << "): ZERO_RETURN (" << sslError
                                      << "): " << getBioError(rc));
                errno = last_errno; // Restore errno.
                return 0;

            case SSL_ERROR_WANT_READ:
#if OPENSSL_VERSION_NUMBER > 0x10100000L
                LOG_TRC("SSL error (" << context << "): WANT_READ (" << sslError << ") has "
                                      << (SSL_has_pending(_ssl) ? "" : "no")
                                      << " pending data to read: " << SSL_pending(_ssl) << ". "
                                      << getBioError(rc));
#else
                LOG_TRC("SSL error (" << context << "): WANT_READ (" << sslError << ").");
#endif
                _sslWantsTo = SslWantsTo::Read;
                errno = last_errno; // Restore errno.
                return rc;

            case SSL_ERROR_WANT_WRITE:
#if OPENSSL_VERSION_NUMBER > 0x10100000L
                LOG_TRC("SSL error (" << context << "): WANT_WRITE (" << sslError << ") has "
                                      << (SSL_has_pending(_ssl) ? "" : "no")
                                      << " pending data to read: " << SSL_pending(_ssl) << ". "
                                      << getBioError(rc));
#else
                LOG_TRC("SSL error: WANT_WRITE (" << sslError << ").");
#endif
                _sslWantsTo = SslWantsTo::Write;
                errno = last_errno; // Restore errno.
                return rc;

            case SSL_ERROR_WANT_CONNECT:
                LOG_TRC("SSL error (" << context << "): WANT_CONNECT (" << sslError
                                      << "): " << getBioError(rc));
                errno = last_errno; // Restore errno.
                return rc;

            case SSL_ERROR_WANT_ACCEPT:
                LOG_TRC("SSL error (" << context << "): WANT_ACCEPT (" << sslError
                                      << "): " << getBioError(rc));
                errno = last_errno; // Restore errno.
                return rc;

            case SSL_ERROR_WANT_X509_LOOKUP:
                // Unexpected.
                LOG_TRC("SSL error (" << context << "): WANT_X509_LOOKUP (" << sslError
                                      << "): " << getBioError(rc));
                errno = last_errno; // Restore errno.
                return rc;

            case SSL_ERROR_SYSCALL:
                if (last_errno != 0)
                {
                    // Posix API error, let the caller handle.
                    LOG_TRC("SSL error (" << context << "): SYSCALL error " << sslError << " ("
                                          << Util::symbolicErrno(last_errno) << ": "
                                          << std::strerror(last_errno) << "): " << getBioError(rc));
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
                    LOG_TRC("BIO asks for retry - underlying EAGAIN? ("
                            << context << "): " << SSL_get_error(_ssl, rc) << " has_pending "
                            << SSL_has_pending(_ssl) << " bytes: " << SSL_pending(_ssl) << ". "
                            << getBioError(rc));
#else
                    LOG_TRC("BIO asks for retry - underlying EAGAIN? " << SSL_get_error(_ssl, rc)
                                                                       << ". " << getBioError(rc));
#endif
                    errno = last_errno ? last_errno : EAGAIN; // Restore errno.
                    return -1; // poll is used to detect real errors.
                }

                if (sslError == SSL_ERROR_SSL)
                    LOG_TRC("SSL error (" << context << "): SSL (" << sslError << ") "
                                          << getBioError(rc));
                else if (sslError == SSL_ERROR_SYSCALL)
                    LOG_TRC("SSL error (" << context << "): SYSCALL (" << sslError << ") "
                                          << getBioError(rc));
#if OPENSSL_VERSION_NUMBER > 0x10100000L
                else if (sslError == SSL_ERROR_WANT_ASYNC)
                    LOG_TRC("SSL error (" << context << "): WANT_ASYNC (" << sslError << ") "
                                          << getBioError(rc));
                else if (sslError == SSL_ERROR_WANT_ASYNC_JOB)
                    LOG_TRC("SSL error (" << context << "): WANT_ASYNC_JOB (" << sslError << ") "
                                          << getBioError(rc));
#endif
                else
                    LOG_TRC("SSL error (" << context << "): UNKNOWN (" << sslError << ") "
                                          << getBioError(rc));

                // The error is coming from BIO. Find out what happened.
                const long bioError = ERR_peek_error();

                std::ostringstream oss;
                oss << '#' << getFD();

                if (bioError == 0)
                {
                    if (rc == 0)
                    {
                        // Socket closed. Not an error.
                        oss << " (" << context << "): closed. " << getBioError(rc);
                        LOG_INF(oss.str());
                        errno = last_errno; // Restore errno.
                        return 0;
                    }
                    else if (rc == -1)
                    {
                        oss << " (" << context << "): socket closed unexpectedly. ";
                    }
                    else
                    {
                        oss << " (" << context << "): unknown. ";
                    }
                }
                else
                {
                    oss << " (" << context << "): unknown. ";
                }

                oss << getBioError(rc);
                const std::string msg = oss.str();
                LOG_TRC("Throwing SSL Error ("
                        << context << "): " << msg); // Locate the source of the exception.
                errno = last_errno; // Restore errno.
                throw std::runtime_error(msg);
            }
            break;
        }

        errno = last_errno; // Restore errno.
        return rc;
    }

    std::string getBioError(const int rc) const
    {
        // The error is coming from BIO. Find out what happened.
        const long bioError = ERR_peek_error();

        std::ostringstream oss;
        oss << "BIO error: " << bioError << ", rc: " << rc;

        char buf[512];
        ERR_error_string_n(bioError, buf, sizeof(buf));

        oss << ": " << buf << ':';

        auto cb = [](const char* str, size_t len, void* u) -> int
        {
            std::ostringstream& os = *reinterpret_cast<std::ostringstream*>(u);
            os << '\n' << std::string(str, len);
            return 1; // Apparently 0 means failure here.
        };

        ERR_print_errors_cb(cb, &oss);
        return oss.str();
    }

private:
    BIO* _bio;
    SSL* _ssl;
    ssl::CertificateVerification _verification; //< The certificate verification requirement.

    /// During handshake SSL might want to read
    /// on write, or write on read.
    SslWantsTo _sslWantsTo;
    /// We must do the handshake during the first
    /// read or write in non-blocking.
    bool _doHandshake;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
