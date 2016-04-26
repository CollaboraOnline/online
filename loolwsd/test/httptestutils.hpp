/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef TEST_HTTPTESTUTILS_HPP
#define TEST_HTTPTESTUTILS_HPP

namespace httptest
{

inline void assertHTTPFilesExist(const Poco::URI& uri, Poco::RegularExpression& expr, const std::string& html, const std::string& mimetype = std::string())
{
    Poco::RegularExpression::MatchVec matches;

    for (int offset = 0; expr.match(html, offset, matches) > 0; offset = static_cast<int>(matches[0].offset + matches[0].length))
    {
	CPPUNIT_ASSERT_EQUAL(2, (int)matches.size());
	Poco::URI uriScript(html.substr(matches[1].offset, matches[1].length));
	if (uriScript.getHost().empty())
	{
	    std::string scriptString(uriScript.toString());

	    // ignore the branding bits, they do not have to be there
	    if (scriptString.find("/branding.") != std::string::npos)
	    {
		std::cout << "skipping test for... " << scriptString << std::endl;
		continue;
	    }

#if ENABLE_SSL
	    Poco::Net::HTTPSClientSession sessionScript(uri.getHost(), uri.getPort());
#else
	    Poco::Net::HTTPClientSession sessionScript(uri.getHost(), uri.getPort());
#endif
	    std::cout << "checking... " << scriptString;
	    Poco::Net::HTTPRequest requestScript(Poco::Net::HTTPRequest::HTTP_GET, scriptString);
	    sessionScript.sendRequest(requestScript);

	    Poco::Net::HTTPResponse responseScript;
	    sessionScript.receiveResponse(responseScript);
	    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseScript.getStatus());

	    if (!mimetype.empty())
		CPPUNIT_ASSERT_EQUAL(mimetype, responseScript.getContentType());

	    std::cout << " OK" << std::endl;
	}
	else
	{
	    std::cout << "skip " << uriScript.toString() << std::endl;
	}
    }
}

}

#endif // TEST_HTTPTESTUTILS_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
