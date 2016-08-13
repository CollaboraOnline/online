/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LIBREOFFICEKIT_HPP
#define INCLUDED_LIBREOFFICEKIT_HPP

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include "Log.hpp"

namespace lok
{

/// The lok::Document class represents one loaded document instance.
class Document
{
private:
    LibreOfficeKitDocument* _pDoc;
    std::mutex _mutex;

public:
    /// A lok::Document is typically created by the lok::Office::documentLoad() method.
    inline Document(LibreOfficeKitDocument* pDoc) :
        _pDoc(pDoc)
    {
        Log::trace("lok::Document ctor.");
    }

    inline ~Document()
    {
        Log::trace("lok::~Document dtor.");
        _pDoc->pClass->destroy(_pDoc);
    }

    /// This lock must be held while calling
    /// one or more members of this class if
    /// the client is multi-threaded.
    /// No member function takes this lock otherwise.
    std::unique_lock<std::mutex> getLock()
    {
        return std::unique_lock<std::mutex>(_mutex);
    }

    /**
     * Stores the document's persistent data to a URL and
     * continues to be a representation of the old URL.
     *
     * @param pUrl the location where to store the document
     * @param pFormat the format to use while exporting, when omitted, then deducted from pURL's extension
     * @param pFilterOptions options for the export filter, e.g. SkipImages.
     *        Another useful FilterOption is "TakeOwnership".  It is consumed
     *        by the saveAs() itself, and when provided, the document identity
     *        changes to the provided pUrl - meaning that '.uno:ModifiedStatus'
     *        is triggered as with the "Save As..." in the UI.
     *        "TakeOwnership" mode must not be used when saving to PNG or PDF.
     */
    inline bool saveAs(const char* pUrl, const char* pFormat = NULL, const char* pFilterOptions = NULL)
    {
        Log::trace() << "lok::Document: saveAs: URL: [" << pUrl << "], Format: [" << pFormat
                     << "], FilterOptions: " << pFilterOptions << "." << Log::end;
        return _pDoc->pClass->saveAs(_pDoc, pUrl, pFormat, pFilterOptions) != 0;
    }

    /// Gives access to the underlying C pointer.
    inline LibreOfficeKitDocument *get()
    {
        return _pDoc;
    }

#if defined LOK_USE_UNSTABLE_API || defined LIBO_INTERNAL_ONLY
    /**
     * Get document type.
     *
     * @return an element of the LibreOfficeKitDocumentType enum.
     */
    inline int getDocumentType()
    {
        return _pDoc->pClass->getDocumentType(_pDoc);
    }

    /**
     * Get number of part that the document contains.
     *
     * Part refers to either individual sheets in a Calc, or slides in Impress,
     * and has no relevance for Writer.
     */
    inline int getParts()
    {
        return _pDoc->pClass->getParts(_pDoc);
    }

    /**
     * Get the logical rectangle of each part in the document.
     *
     * A part refers to an individual page in Writer and has no relevant for
     * Calc or Impress.
     *
     * @return a rectangle list, using the same format as
     * LOK_CALLBACK_TEXT_SELECTION.
     */
    inline char* getPartPageRectangles()
    {
        return _pDoc->pClass->getPartPageRectangles(_pDoc);
    }

    /// Get the current part of the document.
    /// Note: For Writer documents this always returns 0
    /// since text docs have a single coordinate system.
    inline int getPart()
    {
        return getDocumentType() == LOK_DOCTYPE_TEXT ? 0 : _pDoc->pClass->getPart(_pDoc);
    }

    /// Set the current part of the document.
    inline void setPart(int nPart)
    {
        Log::trace() << "lok::Document: setPart: Part: " << nPart << "." << Log::end;
        _pDoc->pClass->setPart(_pDoc, nPart);
    }

    /// Get the current part's name.
    inline char* getPartName(int nPart)
    {
        return _pDoc->pClass->getPartName(_pDoc, nPart);
    }

    /// Get the current part's hash.
    inline char* getPartHash(int nPart)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getPartHash(_pDoc, nPart);
    }

    inline void setPartMode(int nMode)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: setPartMode: Mode: " << nMode << "." << Log::end;
        _pDoc->pClass->setPartMode(_pDoc, nMode);
    }

    /**
     * Renders a subset of the document to a pre-allocated buffer.
     *
     * Note that the buffer size and the tile size implicitly supports
     * rendering at different zoom levels, as the number of rendered pixels and
     * the rendered rectangle of the document are independent.
     *
     * @param pBuffer pointer to the buffer, its size is determined by nCanvasWidth and nCanvasHeight.
     * @param nCanvasWidth number of pixels in a row of pBuffer.
     * @param nCanvasHeight number of pixels in a column of pBuffer.
     * @param nTilePosX logical X position of the top left corner of the rendered rectangle, in TWIPs.
     * @param nTilePosY logical Y position of the top left corner of the rendered rectangle, in TWIPs.
     * @param nTileWidth logical width of the rendered rectangle, in TWIPs.
     * @param nTileHeight logical height of the rendered rectangle, in TWIPs.
     */
    inline void paintTile(unsigned char* pBuffer,
                          const int nCanvasWidth,
                          const int nCanvasHeight,
                          const int nTilePosX,
                          const int nTilePosY,
                          const int nTileWidth,
                          const int nTileHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->paintTile(_pDoc, pBuffer, nCanvasWidth, nCanvasHeight,
                                nTilePosX, nTilePosY, nTileWidth, nTileHeight);
    }

    /**
     * Gets the tile mode: the pixel format used for the pBuffer of paintTile().
     *
     * @return an element of the LibreOfficeKitTileMode enum.
     */
    inline int getTileMode()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getTileMode(_pDoc);
    }

    /// Get the document sizes in TWIPs.
    inline void getDocumentSize(long* pWidth, long* pHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->getDocumentSize(_pDoc, pWidth, pHeight);
    }

    /**
     * Initialize document for rendering.
     *
     * Sets the rendering and document parameters to default values that are
     * needed to render the document correctly using tiled rendering. This
     * method has to be called right after documentLoad() in case any of the
     * tiled rendering methods are to be used later.
     *
     * Example argument string for text documents:
     *
     * {
     *     ".uno:HideWhitespace":
     *     {
     *         "type": "boolean",
     *         "value": "true"
     *     }
     * }
     *
     * @param pArguments arguments of the rendering
     */
    inline void initializeForRendering(const char* pArguments = NULL)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: initializeForRendering: Arguments: [" << pArguments << "]." << Log::end;
        _pDoc->pClass->initializeForRendering(_pDoc, pArguments);
    }

    /**
     * Registers a callback. LOK will invoke this function when it wants to
     * inform the client about events.
     *
     * @param pCallback the callback to invoke
     * @param pData the user data, will be passed to the callback on invocation
     */
    inline void registerCallback(LibreOfficeKitCallback pCallback, void* pData)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->registerCallback(_pDoc, pCallback, pData);
    }

    /**
     * Posts a keyboard event to the focused frame.
     *
     * @param nType Event type, like press or release.
     * @param nCharCode contains the Unicode character generated by this event or 0
     * @param nKeyCode contains the integer code representing the key of the event (non-zero for control keys)
     */
    inline void postKeyEvent(int nType, int nCharCode, int nKeyCode)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->postKeyEvent(_pDoc, nType, nCharCode, nKeyCode);
    }

    /**
     * Posts a mouse event to the document.
     *
     * @param nType Event type, like down, move or up.
     * @param nX horizontal position in document coordinates
     * @param nY vertical position in document coordinates
     * @param nCount number of clicks: 1 for single click, 2 for double click
     * @param nButtons: which mouse buttons: 1 for left, 2 for middle, 4 right
     * @param nModifier: which keyboard modifier: (see include/rsc/rsc-vcl-shared-types.hxx for possible values)
     */
    inline void postMouseEvent(int nType, int nX, int nY, int nCount, int nButtons, int nModifier)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->postMouseEvent(_pDoc, nType, nX, nY, nCount, nButtons, nModifier);
    }

    /**
     * Posts an UNO command to the document.
     *
     * Example argument string:
     *
     * {
     *     "SearchItem.SearchString":
     *     {
     *         "type": "string",
     *         "value": "foobar"
     *     },
     *     "SearchItem.Backward":
     *     {
     *         "type": "boolean",
     *         "value": "false"
     *     }
     * }
     *
     * @param pCommand uno command to be posted to the document, like ".uno:Bold"
     * @param pArguments arguments of the uno command.
     */
    inline void postUnoCommand(const char* pCommand, const char* pArguments = NULL, bool bNotifyWhenFinished = false)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->postUnoCommand(_pDoc, pCommand, pArguments, bNotifyWhenFinished);
    }

    /**
     * Sets the start or end of a text selection.
     *
     * @param nType @see LibreOfficeKitSetTextSelectionType
     * @param nX horizontal position in document coordinates
     * @param nY vertical position in document coordinates
     */
    inline void setTextSelection(int nType, int nX, int nY)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->setTextSelection(_pDoc, nType, nX, nY);
    }

    /**
     * Gets the currently selected text.
     *
     * @param pMimeType suggests the return format, for example text/plain;charset=utf-8.
     * @param pUsedMimeType output parameter to inform about the determined format (suggested one or plain text).
     */
    inline char* getTextSelection(const char* pMimeType, char** pUsedMimeType = NULL)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getTextSelection(_pDoc, pMimeType, pUsedMimeType);
    }

    /**
     * Pastes content at the current cursor position.
     *
     * @param pMimeType format of pData, for example text/plain;charset=utf-8.
     * @param pData the actual data to be pasted.
     * @return if the supplied data was pasted successfully.
     */
    inline bool paste(const char* pMimeType, const char* pData, size_t nSize)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->paste(_pDoc, pMimeType, pData, nSize);
    }

    /**
     * Adjusts the graphic selection.
     *
     * @param nType @see LibreOfficeKitSetGraphicSelectionType
     * @param nX horizontal position in document coordinates
     * @param nY vertical position in document coordinates
     */
    inline void setGraphicSelection(int nType, int nX, int nY)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->setGraphicSelection(_pDoc, nType, nX, nY);
    }

    /**
     * Gets rid of any text or graphic selection.
     */
    inline void resetSelection()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        _pDoc->pClass->resetSelection(_pDoc);
    }

    /**
     * Returns a json mapping of the possible values for the given command
     * e.g. {commandName: ".uno:StyleApply", commandValues: {"familyName1" : ["list of style names in the family1"], etc.}}
     * @param pCommand a uno command for which the possible values are requested
     * @return {commandName: unoCmd, commandValues: {possible_values}}
     */
    inline char* getCommandValues(const char* pCommand)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getCommandValues(_pDoc, pCommand);
    }

    /**
     * Save the client's view so that we can compute the right zoom level
     * for the mouse events. This only affects CALC.
     * @param nTilePixelWidth - tile width in pixels
     * @param nTilePixelHeight - tile height in pixels
     * @param nTileTwipWidth - tile width in twips
     * @param nTileTwipHeight - tile height in twips
     */
    inline void setClientZoom(
            int nTilePixelWidth,
            int nTilePixelHeight,
            int nTileTwipWidth,
            int nTileTwipHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: setClientZoom: TilePixelWidth: " << nTilePixelWidth
                     << ", TilePixelHeight: " << nTileTwipHeight
                     <<  ", TileTwipWidth: " << nTileTwipWidth
                     << ", TileTwipHeight: " << nTileTwipHeight << "." << Log::end;
        _pDoc->pClass->setClientZoom(_pDoc, nTilePixelWidth, nTilePixelHeight, nTileTwipWidth, nTileTwipHeight);
    }

    /**
     * Inform core about the currently visible area of the document on the
     * client, so that it can perform e.g. page down (which depends on the
     * visible height) in a sane way.
     *
     * @param nX - top left corner horizontal position
     * @param nY - top left corner vertical position
     * @param nWidth - area width
     * @param nHeight - area height
     */
    inline void setClientVisibleArea(int nX, int nY, int nWidth, int nHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: setClientVisibleArea: X: " << nX
                     << ", Y: " << nY << ", Width: " << nWidth
                     << ", Height: " << nHeight << "." << Log::end;
        _pDoc->pClass->setClientVisibleArea(_pDoc, nX, nY, nWidth, nHeight);
    }

    /**
     * Create a new view for an existing document.
     * By default a loaded document has 1 view.
     * @return the ID of the new view.
     */
    int createView()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: createView" << Log::end;
        return _pDoc->pClass->createView(_pDoc);
    }

    /**
     * Destroy a view of an existing document.
     * @param nId a view ID, returned by createView().
     */
    void destroyView(int nId)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: destroyView: " << nId << Log::end;
        _pDoc->pClass->destroyView(_pDoc, nId);
    }

    /**
     * Set an existing view of an existing document as current.
     * @param nId a view ID, returned by createView().
     */
    void setView(int nId)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace() << "lok::Document: setView: " << nId << Log::end;
        _pDoc->pClass->setView(_pDoc, nId);
    }

    /**
     * Get the current view.
     * @return a view ID, previously returned by createView().
     */
    int getView()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getView(_pDoc);
    }

    /**
     * Get number of views of this document.
     */
    inline int getViews()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->getViews(_pDoc);
    }

    /**
     * Paints a font name to be displayed in the font list
     * @param pFontName the font to be painted
     */
    inline unsigned char* renderFont(const char *pFontName,
                          int *pFontWidth,
                          int *pFontHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->renderFont(_pDoc, pFontName, pFontWidth, pFontHeight);
    }

    /**
     * Renders a subset of the document's part to a pre-allocated buffer.
     *
     * @param nPart the part number of the document of which the tile is painted.
     * @see paintTile.
     */
    inline void paintPartTile(unsigned char* pBuffer,
                              const int nPart,
                              const int nCanvasWidth,
                              const int nCanvasHeight,
                              const int nTilePosX,
                              const int nTilePosY,
                              const int nTileWidth,
                              const int nTileHeight)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        return _pDoc->pClass->paintPartTile(_pDoc, pBuffer, nPart,
                                            nCanvasWidth, nCanvasHeight,
                                            nTilePosX, nTilePosY,
                                            nTileWidth, nTileHeight);
    }

#endif // defined LOK_USE_UNSTABLE_API || defined LIBO_INTERNAL_ONLY
};

/// The lok::Office class represents one started LibreOfficeKit instance.
class Office
{
private:
    LibreOfficeKit* _pOffice;
    std::mutex _mutex;

public:
    /// A lok::Office is typically created by the lok_cpp_init() function.
    inline Office(LibreOfficeKit* pThis) :
        _pOffice(pThis)
    {
        Log::trace("lok::Office ctor.");
        assert(_pOffice);
    }

    inline ~Office()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        Log::trace("lok::~Office dtor.");
        _pOffice->pClass->destroy(_pOffice);
    }

    /// This lock must be held while calling
    /// one or more member of this class.
    std::unique_lock<std::mutex> getLock()
    {
        return std::unique_lock<std::mutex>(_mutex);
    }

    /// Gives access to the underlying C pointer.
    inline LibreOfficeKit* get()
    {
        return _pOffice;
    }

    /**
     * Loads a document from an URL.
     *
     * @param pUrl the URL of the document to load
     * @param pFilterOptions options for the import filter, e.g. SkipImages.
     */
    inline std::shared_ptr<Document> documentLoad(const char* pUrl, const char* pFilterOptions = NULL)
    {
        Log::trace() << "lok::Office: documentLoad: URL: [" << pUrl
                     << "], FilterOptions: [" << pFilterOptions
                     << "]." << Log::end;
        LibreOfficeKitDocument* pDoc = NULL;

        if (LIBREOFFICEKIT_HAS(_pOffice, documentLoadWithOptions))
            pDoc = _pOffice->pClass->documentLoadWithOptions(_pOffice, pUrl, pFilterOptions);
        else
            pDoc = _pOffice->pClass->documentLoad(_pOffice, pUrl);

        return std::make_shared<lok::Document>(pDoc);
    }

    /// Returns the last error as a string, the returned pointer has to be freed by the caller.
    inline char* getError()
    {
        return _pOffice->pClass->getError(_pOffice);
    }

    /// Frees the memory pointed to by pFree.
    inline void freeError(char* pFree)
    {
        _pOffice->pClass->freeError(pFree);
    }


#if defined LOK_USE_UNSTABLE_API || defined LIBO_INTERNAL_ONLY
    /**
     * Returns details of filter types.
     *
     * Example returned string:
     *
     * {
     *     "writer8": {
     *         "MediaType": "application/vnd.oasis.opendocument.text"
     *     },
     *     "calc8": {
     *         "MediaType": "application/vnd.oasis.opendocument.spreadsheet"
     *     }
     * }
     */
    inline char* getFilterTypes()
    {
        return _pOffice->pClass->getFilterTypes(_pOffice);
    }

    /**
     * Set bitmask of optional features supported by the client.
     *
     * @see LibreOfficeKitOptionalFeatures
     */
    void setOptionalFeatures(uint64_t features)
    {
        return _pOffice->pClass->setOptionalFeatures(_pOffice, features);
    }

    /**
     * Set password required for loading or editing a document.
     *
     * Loading the document is blocked until the password is provided.
     *
     * @param pURL      the URL of the document, as sent to the callback
     * @param pPassword the password, nullptr indicates no password
     *
     * In response to LOK_CALLBACK_DOCUMENT_PASSWORD, a vaild password
     * will continue loading the document, an invalid password will
     * result in another LOK_CALLBACK_DOCUMENT_PASSWORD request,
     * and a NULL password will abort loading the document.
     *
     * In response to LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY, a vaild
     * password will continue loading the document, an invalid password will
     * result in another LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY request,
     * and a NULL password will continue loading the document in read-only
     * mode.
     */
    inline void setDocumentPassword(char const* pURL, char const* pPassword)
    {
        _pOffice->pClass->setDocumentPassword(_pOffice, pURL, pPassword);
    }

    /**
     * Get version information of the LOKit process
     *
     * @returns string containing version information in format:
     * PRODUCT_NAME PRODUCT_VERSION PRODUCT_EXTENSION BUILD_ID
     *
     * Eg: LibreOffice 5.3 .0.0 alpha0 <commit hash>
     */
    inline char* getVersionInfo()
    {
        return _pOffice->pClass->getVersionInfo(_pOffice);
    }
#endif // defined LOK_USE_UNSTABLE_API || defined LIBO_INTERNAL_ONLY
};

}

#endif // INCLUDED_LIBREOFFICEKIT_HPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
