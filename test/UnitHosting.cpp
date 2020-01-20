/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <ostream>
#include <set>
#include <string>

#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/Exception.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Png.hpp>
#include <Unit.hpp>
#include <helpers.hpp>

// Include config.h last, so the test server URI is still HTTP, even in SSL builds.
#include <config.h>

class LOOLWebSocket;

/// Test suite for /hosting, etc.
class UnitHosting : public UnitWSD
{
    TestResult testDiscovery();
    TestResult testCapabilities();

public:
    void invokeTest() override;
};

UnitBase::TestResult UnitHosting::testDiscovery()
{
    Poco::URI uri(helpers::getTestServerURI());
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/hosting/discovery");
    session->sendRequest(request);

    Poco::Net::HTTPResponse response;
    session->receiveResponse(response);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    LOK_ASSERT_EQUAL(std::string("text/xml"), response.getContentType());

    Poco::Net::HTTPRequest request2(Poco::Net::HTTPRequest::HTTP_GET, "/hosting/discovery/");
    session->sendRequest(request2);

    Poco::Net::HTTPResponse response2;
    session->receiveResponse(response2);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response2.getStatus());
    LOK_ASSERT_EQUAL(std::string("text/xml"), response2.getContentType());
    return TestResult::Ok;
}

UnitBase::TestResult UnitHosting::testCapabilities()
{
    Poco::URI uri(helpers::getTestServerURI());
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));

    // Get discovery first and extract the urlsrc of the capabilities end point
    std::string capabilitiesURI;
    {
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/hosting/discovery");
        session->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = session->receiveResponse(response);
        LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
        LOK_ASSERT_EQUAL(std::string("text/xml"), response.getContentType());

        std::string discoveryXML;
        Poco::StreamCopier::copyToString(rs, discoveryXML);

        Poco::XML::DOMParser parser;
        Poco::XML::AutoPtr<Poco::XML::Document> docXML = parser.parseString(discoveryXML);
        Poco::XML::AutoPtr<Poco::XML::NodeList> listNodes = docXML->getElementsByTagName("action");
        bool foundCapabilities = false;
        for (unsigned long index = 0; index < listNodes->length(); ++index)
        {
            Poco::XML::Element* elem = static_cast<Poco::XML::Element*>(listNodes->item(index));
            Poco::XML::Element* parent = elem->parentNode()
                                             ? static_cast<Poco::XML::Element*>(elem->parentNode())
                                             : nullptr;
            if (parent && parent->getAttribute("name") == "Capabilities")
            {
                foundCapabilities = true;
                capabilitiesURI = elem->getAttribute("urlsrc");
                break;
            }
        }

        LOK_ASSERT(foundCapabilities);
        LOK_ASSERT_EQUAL(uri.toString() + CAPABILITIES_END_POINT, capabilitiesURI);
    }

    // Then get the capabilities json
    {
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, CAPABILITIES_END_POINT);
        session->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = session->receiveResponse(response);
        LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
        LOK_ASSERT_EQUAL(std::string("application/json"), response.getContentType());

        std::ostringstream oss;
        Poco::StreamCopier::copyStream(rs, oss);
        std::string responseString = oss.str();

        Poco::JSON::Parser parser;
        Poco::Dynamic::Var jsonFile = parser.parse(responseString);
        Poco::JSON::Object::Ptr features = jsonFile.extract<Poco::JSON::Object::Ptr>();
        LOK_ASSERT(features);
        LOK_ASSERT(features->has("convert-to"));

        Poco::JSON::Object::Ptr convert_to
            = features->get("convert-to").extract<Poco::JSON::Object::Ptr>();
        LOK_ASSERT(convert_to->has("available"));
        LOK_ASSERT(convert_to->get("available"));
    }
    return TestResult::Ok;
}

void UnitHosting::invokeTest()
{
    UnitBase::TestResult result = testDiscovery();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testCapabilities();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitHosting(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
