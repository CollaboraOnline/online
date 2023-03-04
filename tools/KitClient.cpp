/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cassert>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <memory>
#include <sysexits.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

#include <Poco/String.h>
#include <Poco/TemporaryFile.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include <KitHelper.hpp>
#include <Png.hpp>
#include <Util.hpp>
#include <Protocol.hpp>

using Poco::TemporaryFile;
using Poco::Util::Application;

extern "C"
{
    static void myCallback(int type, const char* payload, void*)
    {
        std::cout << "Callback: " << lokCallbackTypeToString(type)
                  << " payload: " << payload << std::endl;
    }
}

/// The application class implementing a client.
class LOKitClient: public Application
{
public:
protected:
    int main(const std::vector<std::string>& args) override
    {
        if (args.size() != 2)
        {
            logger().fatal("Usage: lokitclient /path/to/lo/installation/program /path/to/document");
            return EX_USAGE;
        }

        LibreOfficeKit *loKit;
        LibreOfficeKitDocument *loKitDocument;

        loKit = lok_init(args[0].c_str());
        if (!loKit)
        {
            logger().fatal("LibreOfficeKit initialisation failed");
            return EX_UNAVAILABLE;
        }


        loKitDocument = loKit->pClass->documentLoad(loKit, args[1].c_str());
        if (!loKitDocument)
        {
            logger().fatal("Document loading failed: " + std::string(loKit->pClass->getError(loKit)));
            return EX_UNAVAILABLE;
        }

        loKitDocument->pClass->registerCallback(loKitDocument, myCallback, nullptr);

        loKitDocument->pClass->initializeForRendering(loKitDocument, nullptr);

        if (isatty(0))
        {
            std::cout << "Enter LOKit \"commands\", one per line. 'help' for help. EOF to finish." << std::endl;
        }

        while (!std::cin.eof())
        {
            std::string line;
            std::getline(std::cin, line);

            StringVector tokens(StringVector::tokenize(line, ' '));

            if (tokens.empty())
                continue;

            if (tokens.equals(0, "?") || tokens.equals(0, "help"))
            {
                std::cout <<
                    "Commands mimic COOL protocol but we talk directly to LOKit:" << std::endl <<
                    "    status" << std::endl <<
                    "        calls LibreOfficeKitDocument::getDocumentType, getParts, getPartName, getDocumentSize" << std::endl <<
                    "    tile part pixelwidth pixelheight docposx docposy doctilewidth doctileheight" << std::endl <<
                    "        calls LibreOfficeKitDocument::paintTile" << std::endl;
            }
            else if (tokens.equals(0, "status"))
            {
                if (tokens.size() != 1)
                {
                    std::cout << "? syntax" << std::endl;
                    continue;
                }
                std::cout << LOKitHelper::documentStatus(loKitDocument) << std::endl;
                for (int i = 0; i < loKitDocument->pClass->getParts(loKitDocument); i++)
                {
                    std::cout << "  " << i << ": '" << loKitDocument->pClass->getPartName(loKitDocument, i) << '\'' << std::endl;
                }
            }
            else if (tokens.equals(0, "tile"))
            {
                if (tokens.size() != 8)
                {
                    std::cout << "? syntax" << std::endl;
                    continue;
                }

                int partNumber(std::stoi(tokens[1]));
                int canvasWidth(std::stoi(tokens[2]));
                int canvasHeight(std::stoi(tokens[3]));
                int tilePosX(std::stoi(tokens[4]));
                int tilePosY(std::stoi(tokens[5]));
                int tileWidth(std::stoi(tokens[6]));
                int tileHeight(std::stoi(tokens[7]));

                std::vector<unsigned char> pixmap(canvasWidth*canvasHeight*4);
                loKitDocument->pClass->setPart(loKitDocument, partNumber);
                loKitDocument->pClass->paintTile(loKitDocument, pixmap.data(), canvasWidth, canvasHeight, tilePosX, tilePosY, tileWidth, tileHeight);

                if (!Util::windowingAvailable())
                    continue;

                std::vector<char> png;
                const auto mode = static_cast<LibreOfficeKitTileMode>(loKitDocument->pClass->getTileMode(loKitDocument));

                Png::encodeBufferToPNG(pixmap.data(), canvasWidth, canvasHeight, png, mode);

                TemporaryFile pngFile;
                std::ofstream pngStream(pngFile.path(), std::ios::binary);
                pngStream.write(png.data(), png.size());
                pngStream.close();

                if (std::system((std::string("display ") + pngFile.path()).c_str()) == -1)
                {
                    // Not worth it to display a warning, this is just a throwaway test program, and
                    // the developer running it surely notices if nothing shows up...
                }
            }
            else
            {
                std::cout << "? unrecognized" << std::endl;
            }
        }

        // Safest to just bluntly exit
        Util::forcedExit(EX_OK);
    }
};

namespace Util
{

void alertAllUsers(const std::string& cmd, const std::string& kind)
{
    std::cout << "error: cmd=" << cmd << " kind=" << kind << std::endl;
    (void) kind;
}

}

POCO_APP_MAIN(LOKitClient)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
