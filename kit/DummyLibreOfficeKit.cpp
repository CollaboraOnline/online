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

#include <config.h>

#include "DummyLibreOfficeKit.hpp"

#include <cstdlib>
#include <cstring>
#include <memory>

#include <LibreOfficeKit/LibreOfficeKitEnums.h>
#include <LibreOfficeKit/LibreOfficeKitTypes.h>

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

static LibLibreOffice_Impl *impl = nullptr;
static std::weak_ptr< LibreOfficeKitClass > officeClass;
static std::weak_ptr< LibreOfficeKitDocumentClass > documentClass;

extern "C"
{

static void doc_destroy(LibreOfficeKitDocument* this);
static int doc_saveAs(LibreOfficeKitDocument* this, const char* url, const char* format, const char* filterOptions);
static int doc_getDocumentType(LibreOfficeKitDocument* this);
static int doc_getParts(LibreOfficeKitDocument* this);
static char* doc_getPartPageRectangles(LibreOfficeKitDocument* this);
static int doc_getPart(LibreOfficeKitDocument* this);
static void doc_setPart(LibreOfficeKitDocument* this, int part);
static char* doc_getPartName(LibreOfficeKitDocument* this, int part);
static void doc_setPartMode(LibreOfficeKitDocument* this, int partMode);
static int doc_getEditMode(LibreOfficeKitDocument* this);
static void doc_paintTile(LibreOfficeKitDocument* this,
                          unsigned char* buffer,
                          const int canvasWidth, const int canvasHeight,
                          const int tilePosX, const int tilePosY,
                          const int tileWidth, const int tileHeight);
static void doc_paintPartTile(LibreOfficeKitDocument* this,
                              unsigned char* buffer,
                              const int part,
                              const int canvasWidth, const int canvasHeight,
                              const int tilePosX, const int tilePosY,
                              const int tileWidth, const int tileHeight);
static int doc_getTileMode(LibreOfficeKitDocument* this);
static void doc_getDocumentSize(LibreOfficeKitDocument* this,
                                long* width,
                                long* height);
static void doc_getDataArea(LibreOfficeKitDocument* this,
                            long part,
                            long* col,
                            long* row);
static void doc_initializeForRendering(LibreOfficeKitDocument* this,
                                       const char* arguments);

static void doc_registerCallback(LibreOfficeKitDocument* this,
                                LibreOfficeKitCallback callback,
                                void* data);
static void doc_postKeyEvent(LibreOfficeKitDocument* this,
                             int type,
                             int charCode,
                             int keyCode);
static void doc_postMouseEvent (LibreOfficeKitDocument* this,
                                int type,
                                int x,
                                int y,
                                int count,
                                int buttons,
                                int modifier);
static void doc_postUnoCommand(LibreOfficeKitDocument* this,
                               const char* command,
                               const char* arguments,
                               bool notifyWhenFinished);
static void doc_setTextSelection (LibreOfficeKitDocument* this,
                                  int type,
                                  int x,
                                  int y);
static char* doc_getTextSelection(LibreOfficeKitDocument* this,
                                  const char* mimeType,
                                  char** usedMimeType);
static bool doc_paste(LibreOfficeKitDocument* this,
                      const char* mimeType,
                      const char* data,
                      size_t size);
static void doc_setGraphicSelection (LibreOfficeKitDocument* this,
                                  int type,
                                  int x,
                                  int y);
static void doc_resetSelection (LibreOfficeKitDocument* this);
static char* doc_getCommandValues(LibreOfficeKitDocument* this, const char* command);
static void doc_setClientZoom(LibreOfficeKitDocument* this,
                                    int tilePixelWidth,
                                    int tilePixelHeight,
                                    int tileTwipWidth,
                                    int tileTwipHeight);
static void doc_setClientVisibleArea(LibreOfficeKitDocument* this, int x, int y, int width, int height);
static void doc_setOutlineState(LibreOfficeKitDocument* this, bool column, int level, int index, bool hidden);
static int doc_createView(LibreOfficeKitDocument* this);
static void doc_destroyView(LibreOfficeKitDocument* this, int id);
static void doc_setView(LibreOfficeKitDocument* this, int id);
static int doc_getView(LibreOfficeKitDocument* this);
static int doc_getViewsCount(LibreOfficeKitDocument* this);
static bool doc_getViewIds(LibreOfficeKitDocument* this, int* array, size_t size);
static unsigned char* doc_renderFont(LibreOfficeKitDocument* this,
                          const char *fontName,
                          const char *character,
                          int* fontWidth,
                          int* fontHeight);
static unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* this,
                          const char *fontName,
                          const char *character,
                          int* fontWidth,
                          int* fontHeight,
                          int orientation);
static char* doc_getPartHash(LibreOfficeKitDocument* this, int part);

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* this, char** output);

LibLODocument_Impl::LibLODocument_Impl()
{
    if (!(m_pDocumentClass = documentClass.lock()))
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

        documentClass = m_pDocumentClass;
    }
    classPointer = m_pDocumentClass.get();
}

static void                    lo_destroy       (LibreOfficeKit* this);
static LibreOfficeKitDocument* lo_documentLoad  (LibreOfficeKit* this, const char* url);
static char *                  lo_getError      (LibreOfficeKit* this);
static void                    lo_freeError     (char* freePointer);
static LibreOfficeKitDocument* lo_documentLoadWithOptions  (LibreOfficeKit* this,
                                                           const char* url,
                                                           const char* options);
static void                    lo_registerCallback (LibreOfficeKit* this,
                                                    LibreOfficeKitCallback callback,
                                                    void* data);
static char* lo_getFilterTypes(LibreOfficeKit* this);
static void lo_setOptionalFeatures(LibreOfficeKit* this, unsigned long long features);
static void                    lo_setDocumentPassword(LibreOfficeKit* this,
                                                       const char* url,
                                                       const char* password);
static char*                   lo_getVersionInfo(LibreOfficeKit* this);

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

        officeClass = m_pOfficeClass;
    }

    classPointer = m_pOfficeClass.get();
}

static LibreOfficeKitDocument* lo_documentLoad(LibreOfficeKit* this, const char* url)
{
    return lo_documentLoadWithOptions(this, url, nullptr);
}

static LibreOfficeKitDocument* lo_documentLoadWithOptions(LibreOfficeKit* this, const char* url, const char* options)
{
    (void) this;
    (void) url;
    (void) options;

    return new LibLODocument_Impl();
}

static void lo_registerCallback (LibreOfficeKit* this,
                                 LibreOfficeKitCallback callback,
                                 void* data)
{
    (void) this;
    (void) callback;
    (void) data;
}

static int doc_saveAs(LibreOfficeKitDocument* this, const char* url, const char* format, const char* filterOptions)
{
    (void) this;
    (void) url;
    (void) format;
    (void) filterOptions;

    return true;
}

static int doc_getDocumentType (LibreOfficeKitDocument* this)
{
    (void) this;
    return LOK_DOCTYPE_TEXT;
}

static int doc_getParts (LibreOfficeKitDocument* this)
{
    (void) this;
    return 1;
}

static int doc_getPart (LibreOfficeKitDocument* this)
{
    (void) this;
    return 0;
}

static void doc_setPart(LibreOfficeKitDocument* this, int part)
{
    (void) this;
    (void) part;
}

static char* doc_getPartPageRectangles(LibreOfficeKitDocument* this)
{
    (void) this;
    return nullptr;
}

static char* doc_getPartName(LibreOfficeKitDocument* this, int part)
{
    (void) this;
    (void) part;

    char* memory = strdup("Dummy part");
    return memory;

}

static char* doc_getPartHash(LibreOfficeKitDocument* this, int part)
{
    (void) this;
    (void) part;
    return nullptr;
}

static void doc_setPartMode(LibreOfficeKitDocument* this,
                            int partMode)
{
    (void) this;
    (void) partMode;
}

static int doc_getEditMode(LibreOfficeKitDocument* this)
{
    (void) this;
}

static void doc_paintTile(LibreOfficeKitDocument* this,
                          unsigned char* buffer,
                          const int canvasWidth, const int canvasHeight,
                          const int tilePosX, const int tilePosY,
                          const int tileWidth, const int tileHeight)
{
    (void) this;
    (void) buffer;
    (void) canvasWidth;
    (void) canvasHeight;
    (void) tilePosX;
    (void) tilePosY;
    (void) tileWidth;
    (void) tileHeight;

    // TODO maybe at least clean the buffer?
}


static void doc_paintPartTile(LibreOfficeKitDocument* this,
                              unsigned char* buffer,
                              const int part,
                              const int canvasWidth, const int canvasHeight,
                              const int tilePosX, const int tilePosY,
                              const int tileWidth, const int tileHeight)
{
    (void) part;

    doc_paintTile(this, buffer, canvasWidth, canvasHeight, tilePosX, tilePosY, tileWidth, tileHeight);
}

static int doc_getTileMode(LibreOfficeKitDocument* /*this*/)
{
    return LOK_TILEMODE_RGBA;
}

static void doc_getDocumentSize(LibreOfficeKitDocument* this,
                                long* width,
                                long* height)
{
    (void) this;
    // TODO better values here maybe?
    *width = 10000;
    *height = 10000;
}

static void doc_getDataArea(LibreOfficeKitDocument* this,
                            long part,
                            long* col,
                            long* row)
{
    (void) this;
    (void) part;

    *col = 999;
    *row = 999;
}

static void doc_initializeForRendering(LibreOfficeKitDocument* this,
                                       const char* arguments)
{
    (void) this;
    (void) arguments;
}

static void doc_registerCallback(LibreOfficeKitDocument* this,
                                 LibreOfficeKitCallback callback,
                                 void* data)
{
    (void) this;
    (void) callback;
    (void) data;
}

static void doc_postKeyEvent(LibreOfficeKitDocument* this, int type, int charCode, int keyCode)
{
    (void) this;
    (void) type;
    (void) charCode;
    (void) keyCode;
}

static void doc_postUnoCommand(LibreOfficeKitDocument* this, const char* command, const char* arguments, bool notifyWhenFinished)
{
    (void) this;
    (void) command;
    (void) arguments;
    (void) notifyWhenFinished;
}

static void doc_postMouseEvent(LibreOfficeKitDocument* this, int type, int x, int y, int count, int buttons, int modifier)
{
    (void) this;
    (void) type;
    (void) x;
    (void) y;
    (void) count;
    (void) buttons;
    (void) modifier;
}

static void doc_setTextSelection(LibreOfficeKitDocument* this, int type, int x, int y)
{
    (void) this;
    (void) type;
    (void) x;
    (void) y;
}

static char* doc_getTextSelection(LibreOfficeKitDocument* this, const char* mimeType, char** usedMimeType)
{
    (void) this;
    (void) mimeType;
    (void) usedMimeType;

    char* memory = strdup("Dummy text");

    if (usedMimeType)
    {
        *usedMimeType = strdup("text/plain;charset=utf-8");
    }

    return memory;
}

static bool doc_paste(LibreOfficeKitDocument* this, const char* mimeType, const char* data, size_t size)
{
    (void) this;
    (void) mimeType;
    (void) data;
    (void) size;

    return true;
}

static void doc_setGraphicSelection(LibreOfficeKitDocument* this, int type, int x, int y)
{
    (void) this;
    (void) type;
    (void) x;
    (void) y;
}

static void doc_resetSelection(LibreOfficeKitDocument* this)
{
    (void) this;
}

static char* doc_getCommandValues(LibreOfficeKitDocument* this, const char* command)
{
    (void) this;
    (void) command;

    char* memory = strdup("");
    return memory;
}

static void doc_setClientZoom(LibreOfficeKitDocument* this, int tilePixelWidth, int tilePixelHeight,
        int tileTwipWidth, int tileTwipHeight)
{
    (void) this;
    (void) tilePixelWidth;
    (void) tilePixelHeight;
    (void) tileTwipWidth;
    (void) tileTwipHeight;
}

static void doc_setClientVisibleArea(LibreOfficeKitDocument* this, int x, int y, int width, int height)
{
    (void) this;
    (void) x;
    (void) y;
    (void) width;
    (void) height;
}

static void doc_setOutlineState(LibreOfficeKitDocument* this, bool column, int level, int index, bool hidden)
{
    (void) this;
    (void) column;
    (void) level;
    (void) index;
    (void) hidden;
}

static int doc_createView(LibreOfficeKitDocument* /*this*/)
{
    return 1;
}

static void doc_destroyView(LibreOfficeKitDocument* /*this*/, int id)
{
    (void) id;
}

static void doc_setView(LibreOfficeKitDocument* /*this*/, int id)
{
    (void) id;
}

static int doc_getView(LibreOfficeKitDocument* /*this*/)
{
    return 1;
}

static int doc_getViewsCount(LibreOfficeKitDocument* /*this*/)
{
    return 1;
}

static bool doc_getViewIds(LibreOfficeKitDocument* /*this*/, int* array, size_t size)
{
    (void) array;
    (void) size;

    // TODO Should we return something here?
    return true;
}

unsigned char* doc_renderFont(LibreOfficeKitDocument* /*this*/,
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

unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* /*this*/,
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

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* this, char** output)
{
    (void) this;
    (void) output;
    return 0;
}

static char* lo_getError (LibreOfficeKit *this)
{
    (void) this;

    char* memory = strdup("Dummy error");
    return memory;
}

static void lo_freeError(char* freePointer)
{
    free(freePointer);
}

static char* lo_getFilterTypes(LibreOfficeKit* this)
{
    (void) this;

    // TODO aything more here?
    return nullptr;
}

static void lo_setOptionalFeatures(LibreOfficeKit* this, unsigned long long const features)
{
    (void) this;
    (void) features;
}

static void lo_setDocumentPassword(LibreOfficeKit* this,
        const char* url, const char* password)
{
    (void) this;
    (void) url;
    (void) password;
}

static char* lo_getVersionInfo(LibreOfficeKit* /*this*/)
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

    if (!impl)
    {
        impl = new LibLibreOffice_Impl();
    }
    return static_cast<LibreOfficeKit*>(impl);
}

static void doc_destroy(LibreOfficeKitDocument *this)
{
    LibLODocument_Impl *document = static_cast<LibLODocument_Impl*>(this);
    delete document;
}

static void lo_destroy(LibreOfficeKit* this)
{
    LibLibreOffice_Impl* lib = static_cast<LibLibreOffice_Impl*>(this);
    impl = nullptr;

    delete lib;
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
