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

static LibLibreOffice_Impl *gImpl = nullptr;
static std::weak_ptr< LibreOfficeKitClass > gOfficeClass;
static std::weak_ptr< LibreOfficeKitDocumentClass > gDocumentClass;

extern "C"
{

static void doc_destroy(LibreOfficeKitDocument* pThis);
static int doc_saveAs(LibreOfficeKitDocument* pThis, const char* pUrl, const char* pFormat, const char* pFilterOptions);
static int doc_getDocumentType(LibreOfficeKitDocument* pThis);
static int doc_getParts(LibreOfficeKitDocument* pThis);
static char* doc_getPartPageRectangles(LibreOfficeKitDocument* pThis);
static int doc_getPart(LibreOfficeKitDocument* pThis);
static void doc_setPart(LibreOfficeKitDocument* pThis, int nPart);
static char* doc_getPartName(LibreOfficeKitDocument* pThis, int nPart);
static void doc_setPartMode(LibreOfficeKitDocument* pThis, int nPartMode);
static int doc_getEditMode(LibreOfficeKitDocument* pThis);
static void doc_paintTile(LibreOfficeKitDocument* pThis,
                          unsigned char* pBuffer,
                          const int nCanvasWidth, const int nCanvasHeight,
                          const int nTilePosX, const int nTilePosY,
                          const int nTileWidth, const int nTileHeight);
static void doc_paintPartTile(LibreOfficeKitDocument* pThis,
                              unsigned char* pBuffer,
                              const int nPart,
                              const int nCanvasWidth, const int nCanvasHeight,
                              const int nTilePosX, const int nTilePosY,
                              const int nTileWidth, const int nTileHeight);
static int doc_getTileMode(LibreOfficeKitDocument* pThis);
static void doc_getDocumentSize(LibreOfficeKitDocument* pThis,
                                long* pWidth,
                                long* pHeight);
static void doc_getDataArea(LibreOfficeKitDocument* pThis,
                            long nPart,
                            long* pCol,
                            long* pRow);
static void doc_initializeForRendering(LibreOfficeKitDocument* pThis,
                                       const char* pArguments);

static void doc_registerCallback(LibreOfficeKitDocument* pThis,
                                LibreOfficeKitCallback pCallback,
                                void* pData);
static void doc_postKeyEvent(LibreOfficeKitDocument* pThis,
                             int nType,
                             int nCharCode,
                             int nKeyCode);
static void doc_postMouseEvent (LibreOfficeKitDocument* pThis,
                                int nType,
                                int nX,
                                int nY,
                                int nCount,
                                int nButtons,
                                int nModifier);
static void doc_postUnoCommand(LibreOfficeKitDocument* pThis,
                               const char* pCommand,
                               const char* pArguments,
                               bool bNotifyWhenFinished);
static void doc_setTextSelection (LibreOfficeKitDocument* pThis,
                                  int nType,
                                  int nX,
                                  int nY);
static char* doc_getTextSelection(LibreOfficeKitDocument* pThis,
                                  const char* pMimeType,
                                  char** pUsedMimeType);
static bool doc_paste(LibreOfficeKitDocument* pThis,
                      const char* pMimeType,
                      const char* pData,
                      size_t nSize);
static void doc_setGraphicSelection (LibreOfficeKitDocument* pThis,
                                  int nType,
                                  int nX,
                                  int nY);
static void doc_resetSelection (LibreOfficeKitDocument* pThis);
static char* doc_getCommandValues(LibreOfficeKitDocument* pThis, const char* pCommand);
static void doc_setClientZoom(LibreOfficeKitDocument* pThis,
                                    int nTilePixelWidth,
                                    int nTilePixelHeight,
                                    int nTileTwipWidth,
                                    int nTileTwipHeight);
static void doc_setClientVisibleArea(LibreOfficeKitDocument* pThis, int nX, int nY, int nWidth, int nHeight);
static void doc_setOutlineState(LibreOfficeKitDocument* pThis, bool bColumn, int nLevel, int nIndex, bool bHidden);
static int doc_createView(LibreOfficeKitDocument* pThis);
static void doc_destroyView(LibreOfficeKitDocument* pThis, int nId);
static void doc_setView(LibreOfficeKitDocument* pThis, int nId);
static int doc_getView(LibreOfficeKitDocument* pThis);
static int doc_getViewsCount(LibreOfficeKitDocument* pThis);
static bool doc_getViewIds(LibreOfficeKitDocument* pThis, int* pArray, size_t nSize);
static unsigned char* doc_renderFont(LibreOfficeKitDocument* pThis,
                          const char *pFontName,
                          const char *pChar,
                          int* pFontWidth,
                          int* pFontHeight);
static unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* pThis,
                          const char *pFontName,
                          const char *pChar,
                          int* pFontWidth,
                          int* pFontHeight,
                          int pOrientation);
static char* doc_getPartHash(LibreOfficeKitDocument* pThis, int nPart);

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* pThis, char** pOutput);

LibLODocument_Impl::LibLODocument_Impl()
{
    if (!(m_pDocumentClass = gDocumentClass.lock()))
    {
        m_pDocumentClass = std::make_shared<LibreOfficeKitDocumentClass>();

        m_pDocumentClass->nSize = sizeof(LibreOfficeKitDocument);

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
    pClass = m_pDocumentClass.get();
}

static void                    lo_destroy       (LibreOfficeKit* pThis);
static LibreOfficeKitDocument* lo_documentLoad  (LibreOfficeKit* pThis, const char* pURL);
static char *                  lo_getError      (LibreOfficeKit* pThis);
static void                    lo_freeError     (char* pFree);
static LibreOfficeKitDocument* lo_documentLoadWithOptions  (LibreOfficeKit* pThis,
                                                           const char* pURL,
                                                           const char* pOptions);
static void                    lo_registerCallback (LibreOfficeKit* pThis,
                                                    LibreOfficeKitCallback pCallback,
                                                    void* pData);
static char* lo_getFilterTypes(LibreOfficeKit* pThis);
static void lo_setOptionalFeatures(LibreOfficeKit* pThis, unsigned long long features);
static void                    lo_setDocumentPassword(LibreOfficeKit* pThis,
                                                       const char* pURL,
                                                       const char* pPassword);
static char*                   lo_getVersionInfo(LibreOfficeKit* pThis);

LibLibreOffice_Impl::LibLibreOffice_Impl()
{
    if(!m_pOfficeClass) {
        m_pOfficeClass.reset(new LibreOfficeKitClass);
        m_pOfficeClass->nSize = sizeof(LibreOfficeKitClass);

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

    pClass = m_pOfficeClass.get();
}

static LibreOfficeKitDocument* lo_documentLoad(LibreOfficeKit* pThis, const char* pURL)
{
    return lo_documentLoadWithOptions(pThis, pURL, nullptr);
}

static LibreOfficeKitDocument* lo_documentLoadWithOptions(LibreOfficeKit* pThis, const char* pURL, const char* pOptions)
{
    (void) pThis;
    (void) pURL;
    (void) pOptions;

    return new LibLODocument_Impl();
}

static void lo_registerCallback (LibreOfficeKit* pThis,
                                 LibreOfficeKitCallback pCallback,
                                 void* pData)
{
    (void) pThis;
    (void) pCallback;
    (void) pData;
}

static int doc_saveAs(LibreOfficeKitDocument* pThis, const char* sUrl, const char* pFormat, const char* pFilterOptions)
{
    (void) pThis;
    (void) sUrl;
    (void) pFormat;
    (void) pFilterOptions;

    return true;
}

static int doc_getDocumentType (LibreOfficeKitDocument* pThis)
{
    (void) pThis;
    return LOK_DOCTYPE_TEXT;
}

static int doc_getParts (LibreOfficeKitDocument* pThis)
{
    (void) pThis;
    return 1;
}

static int doc_getPart (LibreOfficeKitDocument* pThis)
{
    (void) pThis;
    return 0;
}

static void doc_setPart(LibreOfficeKitDocument* pThis, int nPart)
{
    (void) pThis;
    (void) nPart;
}

static char* doc_getPartPageRectangles(LibreOfficeKitDocument* pThis)
{
    (void) pThis;
    return nullptr;
}

static char* doc_getPartName(LibreOfficeKitDocument* pThis, int nPart)
{
    (void) pThis;
    (void) nPart;

    char* pMemory = strdup("Dummy part");
    return pMemory;

}

static char* doc_getPartHash(LibreOfficeKitDocument* pThis, int nPart)
{
    (void) pThis;
    (void) nPart;
    return nullptr;
}

static void doc_setPartMode(LibreOfficeKitDocument* pThis,
                            int nPartMode)
{
    (void) pThis;
    (void) nPartMode;
}

static int doc_getEditMode(LibreOfficeKitDocument* pThis)
{
    (void) pThis;
}

static void doc_paintTile(LibreOfficeKitDocument* pThis,
                          unsigned char* pBuffer,
                          const int nCanvasWidth, const int nCanvasHeight,
                          const int nTilePosX, const int nTilePosY,
                          const int nTileWidth, const int nTileHeight)
{
    (void) pThis;
    (void) pBuffer;
    (void) nCanvasWidth;
    (void) nCanvasHeight;
    (void) nTilePosX;
    (void) nTilePosY;
    (void) nTileWidth;
    (void) nTileHeight;

    // TODO maybe at least clean the buffer?
}


static void doc_paintPartTile(LibreOfficeKitDocument* pThis,
                              unsigned char* pBuffer,
                              const int nPart,
                              const int nCanvasWidth, const int nCanvasHeight,
                              const int nTilePosX, const int nTilePosY,
                              const int nTileWidth, const int nTileHeight)
{
    (void) nPart;

    doc_paintTile(pThis, pBuffer, nCanvasWidth, nCanvasHeight, nTilePosX, nTilePosY, nTileWidth, nTileHeight);
}

static int doc_getTileMode(LibreOfficeKitDocument* /*pThis*/)
{
    return LOK_TILEMODE_RGBA;
}

static void doc_getDocumentSize(LibreOfficeKitDocument* pThis,
                                long* pWidth,
                                long* pHeight)
{
    (void) pThis;
    // TODO better values here maybe?
    *pWidth = 10000;
    *pHeight = 10000;
}

static void doc_getDataArea(LibreOfficeKitDocument* pThis,
                            long nPart,
                            long* pCol,
                            long* pRow)
{
    (void) pThis;
    (void) nPart;

    *pCol = 999;
    *pRow = 999;
}

static void doc_initializeForRendering(LibreOfficeKitDocument* pThis,
                                       const char* pArguments)
{
    (void) pThis;
    (void) pArguments;
}

static void doc_registerCallback(LibreOfficeKitDocument* pThis,
                                 LibreOfficeKitCallback pCallback,
                                 void* pData)
{
    (void) pThis;
    (void) pCallback;
    (void) pData;
}

static void doc_postKeyEvent(LibreOfficeKitDocument* pThis, int nType, int nCharCode, int nKeyCode)
{
    (void) pThis;
    (void) nType;
    (void) nCharCode;
    (void) nKeyCode;
}

static void doc_postUnoCommand(LibreOfficeKitDocument* pThis, const char* pCommand, const char* pArguments, bool bNotifyWhenFinished)
{
    (void) pThis;
    (void) pCommand;
    (void) pArguments;
    (void) bNotifyWhenFinished;
}

static void doc_postMouseEvent(LibreOfficeKitDocument* pThis, int nType, int nX, int nY, int nCount, int nButtons, int nModifier)
{
    (void) pThis;
    (void) nType;
    (void) nX;
    (void) nY;
    (void) nCount;
    (void) nButtons;
    (void) nModifier;
}

static void doc_setTextSelection(LibreOfficeKitDocument* pThis, int nType, int nX, int nY)
{
    (void) pThis;
    (void) nType;
    (void) nX;
    (void) nY;
}

static char* doc_getTextSelection(LibreOfficeKitDocument* pThis, const char* pMimeType, char** pUsedMimeType)
{
    (void) pThis;
    (void) pMimeType;
    (void) pUsedMimeType;

    char* pMemory = strdup("Dummy text");

    if (pUsedMimeType)
    {
        *pUsedMimeType = strdup("text/plain;charset=utf-8");
    }

    return pMemory;
}

static bool doc_paste(LibreOfficeKitDocument* pThis, const char* pMimeType, const char* pData, size_t nSize)
{
    (void) pThis;
    (void) pMimeType;
    (void) pData;
    (void) nSize;

    return true;
}

static void doc_setGraphicSelection(LibreOfficeKitDocument* pThis, int nType, int nX, int nY)
{
    (void) pThis;
    (void) nType;
    (void) nX;
    (void) nY;
}

static void doc_resetSelection(LibreOfficeKitDocument* pThis)
{
    (void) pThis;
}

static char* doc_getCommandValues(LibreOfficeKitDocument* pThis, const char* pCommand)
{
    (void) pThis;
    (void) pCommand;

    char* pMemory = strdup("");
    return pMemory;
}

static void doc_setClientZoom(LibreOfficeKitDocument* pThis, int nTilePixelWidth, int nTilePixelHeight,
        int nTileTwipWidth, int nTileTwipHeight)
{
    (void) pThis;
    (void) nTilePixelWidth;
    (void) nTilePixelHeight;
    (void) nTileTwipWidth;
    (void) nTileTwipHeight;
}

static void doc_setClientVisibleArea(LibreOfficeKitDocument* pThis, int nX, int nY, int nWidth, int nHeight)
{
    (void) pThis;
    (void) nX;
    (void) nY;
    (void) nWidth;
    (void) nHeight;
}

static void doc_setOutlineState(LibreOfficeKitDocument* pThis, bool bColumn, int nLevel, int nIndex, bool bHidden)
{
    (void) pThis;
    (void) bColumn;
    (void) nLevel;
    (void) nIndex;
    (void) bHidden;
}

static int doc_createView(LibreOfficeKitDocument* /*pThis*/)
{
    return 1;
}

static void doc_destroyView(LibreOfficeKitDocument* /*pThis*/, int nId)
{
    (void) nId;
}

static void doc_setView(LibreOfficeKitDocument* /*pThis*/, int nId)
{
    (void) nId;
}

static int doc_getView(LibreOfficeKitDocument* /*pThis*/)
{
    return 1;
}

static int doc_getViewsCount(LibreOfficeKitDocument* /*pThis*/)
{
    return 1;
}

static bool doc_getViewIds(LibreOfficeKitDocument* /*pThis*/, int* pArray, size_t nSize)
{
    (void) pArray;
    (void) nSize;

    // TODO Should we return something here?
    return true;
}

unsigned char* doc_renderFont(LibreOfficeKitDocument* /*pThis*/,
                    const char* pFontName,
                    const char* pChar,
                    int* pFontWidth,
                    int* pFontHeight)
{
    (void) pFontName;
    (void) pChar;
    (void) pFontWidth;
    (void) pFontHeight;

    return nullptr;
}

unsigned char* doc_renderFontOrientation(LibreOfficeKitDocument* /*pThis*/,
                    const char* pFontName,
                    const char* pChar,
                    int* pFontWidth,
                    int* pFontHeight,
                    int pOrientation)
{
    (void) pFontName;
    (void) pChar;
    (void) pFontWidth;
    (void) pFontHeight;
    (void) pOrientation;

    return nullptr;
}

static size_t doc_renderShapeSelection(LibreOfficeKitDocument* pThis, char** pOutput)
{
    (void) pThis;
    (void) pOutput;
    return 0;
}

static char* lo_getError (LibreOfficeKit *pThis)
{
    (void) pThis;

    char* pMemory = strdup("Dummy error");
    return pMemory;
}

static void lo_freeError(char* pFree)
{
    free(pFree);
}

static char* lo_getFilterTypes(LibreOfficeKit* pThis)
{
    (void) pThis;

    // TODO anything more here?
    return nullptr;
}

static void lo_setOptionalFeatures(LibreOfficeKit* pThis, unsigned long long const features)
{
    (void) pThis;
    (void) features;
}

static void lo_setDocumentPassword(LibreOfficeKit* pThis,
        const char* pURL, const char* pPassword)
{
    (void) pThis;
    (void) pURL;
    (void) pPassword;
}

static char* lo_getVersionInfo(LibreOfficeKit* /*pThis*/)
{
    const char version[] =
        "{ "
        "\"ProductName\": \"Dummy\", "
        "\"ProductVersion\": \"5.3\", "
        "\"ProductExtension\": \"Dummy\", "
        "\"BuildId\": \"1\" "
        "}";

    char* pVersion = strdup(version);
    return pVersion;
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

static void doc_destroy(LibreOfficeKitDocument *pThis)
{
    LibLODocument_Impl *pDocument = static_cast<LibLODocument_Impl*>(pThis);
    delete pDocument;
}

static void lo_destroy(LibreOfficeKit* pThis)
{
    LibLibreOffice_Impl* pLib = static_cast<LibLibreOffice_Impl*>(pThis);
    gImpl = nullptr;

    delete pLib;
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
