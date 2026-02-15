/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Dummy LibreOfficeKit implementation for testing.
 * Classes: LibLODocument_Impl, LibLibreOffice_Impl - Mock LOK interfaces
 */

#include <config.h>

#include "DummyLibreOfficeKit.hpp"

#include <LibreOfficeKit/LibreOfficeKitEnums.h>
#include <LibreOfficeKit/LibreOfficeKitTypes.h>

#include <cstdlib>
#include <cstring>
#include <memory>

struct LibLODocument_Impl : public _LibreOfficeKitDocument
{
private:
    std::shared_ptr< LibreOfficeKitDocumentClass > m_pDocumentClass;

public:
    LibLODocument_Impl();
};

struct LibLibreOffice_Impl : public _LibreOfficeKit
{
private:
    std::shared_ptr< LibreOfficeKitClass > m_pOfficeClass;

public:
    LibLibreOffice_Impl();
};

static LibLibreOffice_Impl *gImpl = nullptr;
static std::weak_ptr< LibreOfficeKitClass > gOfficeClass;
static std::weak_ptr< LibreOfficeKitDocumentClass > gDocumentClass;

extern "C"
{

static void doc_destroy(LibreOfficeKitDocument* self);
static int doc_saveAs(LibreOfficeKitDocument* self, const char* url, const char* format, const char* filterOptions);
static int doc_getDocumentType(LibreOfficeKitDocument* self);
static int doc_getParts(LibreOfficeKitDocument* self);
static char* doc_getPartPageRectangles(LibreOfficeKitDocument* self);
static int doc_getPart(LibreOfficeKitDocument* self);
static void doc_setPart(LibreOfficeKitDocument* self, int part);
static char* doc_getPartName(LibreOfficeKitDocument* self, int part);
static void doc_setPartMode(LibreOfficeKitDocument* self, int partMode);
static int doc_getEditMode(LibreOfficeKitDocument* self);
static void doc_paintTile(LibreOfficeKitDocument* self,
                          unsigned char* buffer,
                          const int canvasWidth, const int canvasHeight,
                          const int tilePosX, const int tilePosY,
                          const int tileWidth, const int tileHeight);
static void doc_paintPartTile(LibreOfficeKitDocument* self,
                              unsigned char* buffer,
                              const int part,
                              const int canvasWidth, const int canvasHeight,
                              const int tilePosX, const int tilePosY,
                              const int tileWidth, const int tileHeight);
static int doc_getTileMode(LibreOfficeKitDocument* self);
static void doc_getDocumentSize(LibreOfficeKitDocument* self,
                                long* width,
                                long* height);
static void doc_getDataArea(LibreOfficeKitDocument* self,
                            long part,
                            long* col,
                            long* row);
static void doc_initializeForRendering(LibreOfficeKitDocument* self,
                                       const char* arguments);

static void doc_registerCallback(LibreOfficeKitDocument* self,
                                LibreOfficeKitCallback callback,
                                void* data);
static void doc_postKeyEvent(LibreOfficeKitDocument* self,
                             int type,
                             int charCode,
                             int keyCode);
static void doc_postMouseEvent (LibreOfficeKitDocument* self,
                                int type,
                                int x,
                                int y,
                                int count,
                                int buttons,
                                int modifier);
static void doc_postUnoCommand(LibreOfficeKitDocument* self,
                               const char* command,
                               const char* arguments,
                               bool notifyWhenFinished);
static void doc_setTextSelection (LibreOfficeKitDocument* self,
                                  int type,
                                  int x,
                                  int y);
static char* doc_getTextSelection(LibreOfficeKitDocument* self,
                                  const char* mimeType,
                                  char** usedMimeType);
static bool doc_paste(LibreOfficeKitDocument* self,
                      const char* mimeType,
                      const char* data,
                      size_t size);
static void doc_setGraphicSelection (LibreOfficeKitDocument* self,
                                  int type,
                                  int x,
                                  int y);
static void doc_resetSelection (LibreOfficeKitDocument* self);
static char* doc_getCommandValues(LibreOfficeKitDocument* self, const char* command);
static void doc_setClientZoom(LibreOfficeKitDocument* self,
                                    int tilePixelWidth,
                                    int tilePixelHeight,
                                    int tileTwipWidth,
                                    int tileTwipHeight);
static void doc_setClientVisibleArea(LibreOfficeKitDocument* self, int x, int y, int width, int height);
static void doc_setOutlineState(LibreOfficeKitDocument* self, bool column, int level, int index, bool hidden);
static int doc_createView(LibreOfficeKitDocument* self);
static void doc_destroyView(LibreOfficeKitDocument* self, int id);
static void doc_setView(LibreOfficeKitDocument* self, int id);
static int doc_getView(LibreOfficeKitDocument* self);
static int doc_getViewsCount(LibreOfficeKitDocument* self);
static bool doc_getViewIds(LibreOfficeKitDocument* self, int* array, size_t size);
static unsigned char* doc_renderFont(LibreOfficeKitDocument* self,
                          const char *fontName,
                          const char *character,
                          int* fontWidth,
                          int* fontHeight);
static unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* self,
                          const char *fontName,
                          const char *character,
                          int* fontWidth,
                          int* fontHeight,
                          int orientation);
static char* doc_getPartHash(LibreOfficeKitDocument* self, int part);

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* self, char** output);

LibLODocument_Impl::LibLODocument_Impl()
{
    if (!(m_pDocumentClass = gDocumentClass.lock()))
    {
        m_pDocumentClass = std::make_shared<LibreOfficeKitDocumentClass>();

        m_pDocumentClass->size = sizeof(LibreOfficeKitDocument);

        m_pDocumentClass->destroy = doc_destroy;
        m_pDocumentClass->saveAs = doc_saveAs;
        m_pDocumentClass->getDocumentType = doc_getDocumentType;
        m_pDocumentClass->getParts = doc_getParts;
        m_pDocumentClass->getPartPageRectangles = doc_getPartPageRectangles;
        m_pDocumentClass->getPart = doc_getPart;
        m_pDocumentClass->setPart = doc_setPart;
        m_pDocumentClass->getPartName = doc_getPartName;
        m_pDocumentClass->setPartMode = doc_setPartMode;
        m_pDocumentClass->getEditMode = doc_getEditMode;
        m_pDocumentClass->paintTile = doc_paintTile;
        m_pDocumentClass->paintPartTile = doc_paintPartTile;
        m_pDocumentClass->getTileMode = doc_getTileMode;
        m_pDocumentClass->getDocumentSize = doc_getDocumentSize;
        m_pDocumentClass->getDataArea = doc_getDataArea;
        m_pDocumentClass->initializeForRendering = doc_initializeForRendering;
        m_pDocumentClass->registerCallback = doc_registerCallback;
        m_pDocumentClass->postKeyEvent = doc_postKeyEvent;
        m_pDocumentClass->postMouseEvent = doc_postMouseEvent;
        m_pDocumentClass->postUnoCommand = doc_postUnoCommand;
        m_pDocumentClass->setTextSelection = doc_setTextSelection;
        m_pDocumentClass->getTextSelection = doc_getTextSelection;
        m_pDocumentClass->paste = doc_paste;
        m_pDocumentClass->setGraphicSelection = doc_setGraphicSelection;
        m_pDocumentClass->resetSelection = doc_resetSelection;
        m_pDocumentClass->getCommandValues = doc_getCommandValues;
        m_pDocumentClass->setClientZoom = doc_setClientZoom;
        m_pDocumentClass->setClientVisibleArea = doc_setClientVisibleArea;
        m_pDocumentClass->setOutlineState = doc_setOutlineState;

        m_pDocumentClass->createView = doc_createView;
        m_pDocumentClass->destroyView = doc_destroyView;
        m_pDocumentClass->setView = doc_setView;
        m_pDocumentClass->getView = doc_getView;
        m_pDocumentClass->getViewsCount = doc_getViewsCount;
        m_pDocumentClass->getViewIds = doc_getViewIds;

        m_pDocumentClass->renderFont = doc_renderFont;
        m_pDocumentClass->renderFontOrientation = doc_renderFontOrientation;
        m_pDocumentClass->getPartHash = doc_getPartHash;

        m_pDocumentClass->renderShapeSelection = doc_renderShapeSelection;

        gDocumentClass = m_pDocumentClass;
    }
    classPointer = m_pDocumentClass.get();
}

static void                    lo_destroy       (LibreOfficeKit* self);
static LibreOfficeKitDocument* lo_documentLoad  (LibreOfficeKit* self, const char* url);
static char *                  lo_getError      (LibreOfficeKit* self);
static void                    lo_freeError     (char* freePointer);
static LibreOfficeKitDocument* lo_documentLoadWithOptions  (LibreOfficeKit* self,
                                                           const char* url,
                                                           const char* options);
static void                    lo_registerCallback (LibreOfficeKit* self,
                                                    LibreOfficeKitCallback callback,
                                                    void* data);
static char* lo_getFilterTypes(LibreOfficeKit* self);
static void lo_setOptionalFeatures(LibreOfficeKit* self, unsigned long long features);
static void                    lo_setDocumentPassword(LibreOfficeKit* self,
                                                       const char* url,
                                                       const char* password);
static char*                   lo_getVersionInfo(LibreOfficeKit* self);

LibLibreOffice_Impl::LibLibreOffice_Impl()
{
    if(!m_pOfficeClass) {
        m_pOfficeClass.reset(new LibreOfficeKitClass);
        m_pOfficeClass->size = sizeof(LibreOfficeKitClass);

        m_pOfficeClass->destroy = lo_destroy;
        m_pOfficeClass->documentLoad = lo_documentLoad;
        m_pOfficeClass->getError = lo_getError;
        m_pOfficeClass->freeError = lo_freeError;
        m_pOfficeClass->documentLoadWithOptions = lo_documentLoadWithOptions;
        m_pOfficeClass->registerCallback = lo_registerCallback;
        m_pOfficeClass->getFilterTypes = lo_getFilterTypes;
        m_pOfficeClass->setOptionalFeatures = lo_setOptionalFeatures;
        m_pOfficeClass->setDocumentPassword = lo_setDocumentPassword;
        m_pOfficeClass->getVersionInfo = lo_getVersionInfo;

        gOfficeClass = m_pOfficeClass;
    }

    classPointer = m_pOfficeClass.get();
}

static LibreOfficeKitDocument* lo_documentLoad(LibreOfficeKit* self, const char* url)
{
    return lo_documentLoadWithOptions(self, url, nullptr);
}

static LibreOfficeKitDocument* lo_documentLoadWithOptions(LibreOfficeKit* self, const char* url, const char* options)
{
    (void) self;
    (void) url;
    (void) options;

    return new LibLODocument_Impl();
}

static void lo_registerCallback (LibreOfficeKit* self,
                                 LibreOfficeKitCallback callback,
                                 void* data)
{
    (void) self;
    (void) callback;
    (void) data;
}

static int doc_saveAs(LibreOfficeKitDocument* self, const char* url, const char* format, const char* filterOptions)
{
    (void) self;
    (void) url;
    (void) format;
    (void) filterOptions;

    return true;
}

static int doc_getDocumentType (LibreOfficeKitDocument* self)
{
    (void) self;
    return LOK_DOCTYPE_TEXT;
}

static int doc_getParts (LibreOfficeKitDocument* self)
{
    (void) self;
    return 1;
}

static int doc_getPart (LibreOfficeKitDocument* self)
{
    (void) self;
    return 0;
}

static void doc_setPart(LibreOfficeKitDocument* self, int part)
{
    (void) self;
    (void) part;
}

static char* doc_getPartPageRectangles(LibreOfficeKitDocument* self)
{
    (void) self;
    return nullptr;
}

static char* doc_getPartName(LibreOfficeKitDocument* self, int part)
{
    (void) self;
    (void) part;

    char* memory = strdup("Dummy part");
    return memory;

}

static char* doc_getPartHash(LibreOfficeKitDocument* self, int part)
{
    (void) self;
    (void) part;
    return nullptr;
}

static void doc_setPartMode(LibreOfficeKitDocument* self,
                            int partMode)
{
    (void) self;
    (void) partMode;
}

static int doc_getEditMode(LibreOfficeKitDocument* self)
{
    (void) self;
}

static void doc_paintTile(LibreOfficeKitDocument* self,
                          unsigned char* buffer,
                          const int canvasWidth, const int canvasHeight,
                          const int tilePosX, const int tilePosY,
                          const int tileWidth, const int tileHeight)
{
    (void) self;
    (void) buffer;
    (void) canvasWidth;
    (void) canvasHeight;
    (void) tilePosX;
    (void) tilePosY;
    (void) tileWidth;
    (void) tileHeight;

    // TODO maybe at least clean the buffer?
}


static void doc_paintPartTile(LibreOfficeKitDocument* self,
                              unsigned char* buffer,
                              const int part,
                              const int canvasWidth, const int canvasHeight,
                              const int tilePosX, const int tilePosY,
                              const int tileWidth, const int tileHeight)
{
    (void) part;

    doc_paintTile(self, buffer, canvasWidth, canvasHeight, tilePosX, tilePosY, tileWidth, tileHeight);
}

static int doc_getTileMode(LibreOfficeKitDocument* /*self*/)
{
    return LOK_TILEMODE_RGBA;
}

static void doc_getDocumentSize(LibreOfficeKitDocument* self,
                                long* width,
                                long* height)
{
    (void) self;
    // TODO better values here maybe?
    *width = 10000;
    *height = 10000;
}

static void doc_getDataArea(LibreOfficeKitDocument* self,
                            long part,
                            long* col,
                            long* row)
{
    (void) self;
    (void) part;

    *col = 999;
    *row = 999;
}

static void doc_initializeForRendering(LibreOfficeKitDocument* self,
                                       const char* arguments)
{
    (void) self;
    (void) arguments;
}

static void doc_registerCallback(LibreOfficeKitDocument* self,
                                 LibreOfficeKitCallback callback,
                                 void* data)
{
    (void) self;
    (void) callback;
    (void) data;
}

static void doc_postKeyEvent(LibreOfficeKitDocument* self, int type, int charCode, int keyCode)
{
    (void) self;
    (void) type;
    (void) charCode;
    (void) keyCode;
}

static void doc_postUnoCommand(LibreOfficeKitDocument* self, const char* command, const char* arguments, bool notifyWhenFinished)
{
    (void) self;
    (void) command;
    (void) arguments;
    (void) notifyWhenFinished;
}

static void doc_postMouseEvent(LibreOfficeKitDocument* self, int type, int x, int y, int count, int buttons, int modifier)
{
    (void) self;
    (void) type;
    (void) x;
    (void) y;
    (void) count;
    (void) buttons;
    (void) modifier;
}

static void doc_setTextSelection(LibreOfficeKitDocument* self, int type, int x, int y)
{
    (void) self;
    (void) type;
    (void) x;
    (void) y;
}

static char* doc_getTextSelection(LibreOfficeKitDocument* self, const char* mimeType, char** usedMimeType)
{
    (void) self;
    (void) mimeType;
    (void) usedMimeType;

    char* memory = strdup("Dummy text");

    if (usedMimeType)
    {
        *usedMimeType = strdup("text/plain;charset=utf-8");
    }

    return memory;
}

static bool doc_paste(LibreOfficeKitDocument* self, const char* mimeType, const char* data, size_t size)
{
    (void) self;
    (void) mimeType;
    (void) data;
    (void) size;

    return true;
}

static void doc_setGraphicSelection(LibreOfficeKitDocument* self, int type, int x, int y)
{
    (void) self;
    (void) type;
    (void) x;
    (void) y;
}

static void doc_resetSelection(LibreOfficeKitDocument* self)
{
    (void) self;
}

static char* doc_getCommandValues(LibreOfficeKitDocument* self, const char* command)
{
    (void) self;
    (void) command;

    char* memory = strdup("");
    return memory;
}

static void doc_setClientZoom(LibreOfficeKitDocument* self, int tilePixelWidth, int tilePixelHeight,
        int tileTwipWidth, int tileTwipHeight)
{
    (void) self;
    (void) tilePixelWidth;
    (void) tilePixelHeight;
    (void) tileTwipWidth;
    (void) tileTwipHeight;
}

static void doc_setClientVisibleArea(LibreOfficeKitDocument* self, int x, int y, int width, int height)
{
    (void) self;
    (void) x;
    (void) y;
    (void) width;
    (void) height;
}

static void doc_setOutlineState(LibreOfficeKitDocument* self, bool column, int level, int index, bool hidden)
{
    (void) self;
    (void) column;
    (void) level;
    (void) index;
    (void) hidden;
}

static int doc_createView(LibreOfficeKitDocument* /*self*/)
{
    return 1;
}

static void doc_destroyView(LibreOfficeKitDocument* /*self*/, int id)
{
    (void) id;
}

static void doc_setView(LibreOfficeKitDocument* /*self*/, int id)
{
    (void) id;
}

static int doc_getView(LibreOfficeKitDocument* /*self*/)
{
    return 1;
}

static int doc_getViewsCount(LibreOfficeKitDocument* /*self*/)
{
    return 1;
}

static bool doc_getViewIds(LibreOfficeKitDocument* /*self*/, int* array, size_t size)
{
    (void) array;
    (void) size;

    // TODO Should we return something here?
    return true;
}

unsigned char* doc_renderFont(LibreOfficeKitDocument* /*self*/,
                    const char* fontName,
                    const char* character,
                    int* fontWidth,
                    int* fontHeight)
{
    (void) fontName;
    (void) character;
    (void) fontWidth;
    (void) fontHeight;

    return nullptr;
}

unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* /*self*/,
                    const char* fontName,
                    const char* character,
                    int* fontWidth,
                    int* fontHeight,
                    int orientation)
{
    (void) fontName;
    (void) character;
    (void) fontWidth;
    (void) fontHeight;
    (void) orientation;

    return nullptr;
}

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* self, char** output)
{
    (void) self;
    (void) output;
    return 0;
}

static char* lo_getError (LibreOfficeKit *self)
{
    (void) self;

    char* memory = strdup("Dummy error");
    return memory;
}

static void lo_freeError(char* freePointer)
{
    free(freePointer);
}

static char* lo_getFilterTypes(LibreOfficeKit* self)
{
    (void) self;

    // TODO aything more here?
    return nullptr;
}

static void lo_setOptionalFeatures(LibreOfficeKit* self, unsigned long long const features)
{
    (void) self;
    (void) features;
}

static void lo_setDocumentPassword(LibreOfficeKit* self,
        const char* url, const char* password)
{
    (void) self;
    (void) url;
    (void) password;
}

static char* lo_getVersionInfo(LibreOfficeKit* /*self*/)
{
    const char version[] =
        "{ "
        "\"ProductName\": \"Dummy\", "
        "\"ProductVersion\": \"5.3\", "
        "\"ProductExtension\": \"Dummy\", "
        "\"BuildId\": \"1\" "
        "}";

    char* version = strdup(version);
    return version;
}

LibreOfficeKit* dummy_lok_init_2(const char *install_path,  const char *user_profile_url)
{
    (void) install_path;
    (void) user_profile_url;

    if (!gImpl)
    {
        gImpl = new LibLibreOffice_Impl();
    }
    return static_cast<LibreOfficeKit*>(gImpl);
}

static void doc_destroy(LibreOfficeKitDocument *self)
{
    LibLODocument_Impl *document = static_cast<LibLODocument_Impl*>(self);
    delete document;
}

static void lo_destroy(LibreOfficeKit* self)
{
    LibLibreOffice_Impl* lib = static_cast<LibLibreOffice_Impl*>(self);
    gImpl = nullptr;

    delete lib;
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
