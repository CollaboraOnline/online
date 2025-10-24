/* -*- js-indent-level: 8; fill-column: 100 -*- */
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
 * CanvasSectionProps
 *
 * It's really difficult to set drawing and processing orders of sections, since they are mostly defined on different files.
 * So we have this file, to manage their orders easily. Define them here, globally. Then you can use from everywhere.
 * Refer to CanvasSectionContainer.ts for definitions of processingOrder, drawingOrder and zIndex.
 */

/*
    z-index        : Higher zIndex will be drawn on top.
    Processing and drawing orders are meaningful between sections with the same zIndex.
    Processing order	: Important for locations and sizes of sections. Lowest processing order will be processed first.
    Drawing order	: Highest with the same zIndex will be drawn on top.
*/

/* global app */

app.CSections.Debug = {}; // For keeping things simple.

// First definitions. Other properties will be written according to their orders.
app.CSections.CommentList =			{ name: 'comment list'		, zIndex: 5	};
app.CSections.Tiles = 				{ name: 'tiles'				, zIndex: 5 };
app.CSections.Overlays =				{ name: 'overlay'			, zIndex: 5 };
app.CSections.CalcGrid = 				{ name: 'calc grid'			, zIndex: 5 };
app.CSections.Debug.Splits = 			{ name: 'splits'			, zIndex: 5 };
app.CSections.Debug.TilePixelGrid = 	{ name: 'tile pixel grid'	, zIndex: 5 };
app.CSections.Debug.DebugOverlay = 	{ name: 'debug overlay'     , zIndex: 5 };
app.CSections.Debug.PreloadMap = 	    { name: 'preload map'	    , zIndex: 5 };
app.CSections.ColumnHeader = 			{ name: 'column header'		, zIndex: 5 };
app.CSections.RowHeader = 			{ name: 'row header'		, zIndex: 5 };
app.CSections.Splitter =              { name: 'splitter'			, zIndex: 5 };
app.CSections.CornerHeader = 			{ name: 'corner header'		, zIndex: 5 };
app.CSections.OtherViewCellCursor =   { zIndex: 5 };
app.CSections.ColumnGroup = 			{ name: 'column group'		, zIndex: 5 };
app.CSections.RowGroup = 				{ name: 'row group'			, zIndex: 5 };
app.CSections.CornerGroup = 			{ name: 'corner group'		, zIndex: 5 };

app.CSections.Comment =				{ name: 'comment'			, zIndex: 7	}; // This class is for comment markers. It is a document object. One should change instance's name after initializing (there may be many instances of this class).

app.CSections.AutoFillMarker = 		{ name: 'auto fill marker'	, zIndex: 5 };
app.CSections.CellCursor = 			{ name: 'OwnCellCursor'     , zIndex: 5 };
app.CSections.FocusCell =             { name: 'focus cell'		, zIndex: 5 };
app.CSections.DefaultForDocumentObjects = {                         zIndex: 9 };
app.CSections.HTMLObject     =        {                             zIndex: 9 };
app.CSections.TableResizeMarker =     { name: 'table resize marker' };
app.CSections.TableSelectMarker =     { name: 'table select marker' };
app.CSections.FormFieldButton =       { name: 'form field button' };
app.CSections.CursorHandler =     { name: 'cursor handler' };

app.CSections.ContentControl =        { name: 'content control'   , zIndex: 11 };
app.CSections.CalcValidityDropDown =  { name: 'calc validity dropdown', zIndex: 11 };

app.CSections.Scroll =				{ name: 'scroll'			, zIndex: 13 };

/*
    zIndex = 5. z-index of tiles.
    These are sections either:
        * Bound to tiles section.
        * At the same level with tiles section - so they share the available canvas space.
*/

app.CSections.CommentList.processingOrder = 			24; // Writer & Impress. Before tiles section, because tiles section will be expanded into the empty area.
app.CSections.CornerGroup.processingOrder =			25; // Calc.
app.CSections.RowGroup.processingOrder =				27; // Calc.
app.CSections.ColumnGroup.processingOrder =			29; // Calc.
app.CSections.CornerHeader.processingOrder =			30; // Calc.
app.CSections.RowHeader.processingOrder =				40; // Calc.
app.CSections.ColumnHeader.processingOrder =			50; // Calc.
app.CSections.Tiles.processingOrder = 				60; // Writer & Impress & Calc.
app.CSections.FocusCell.processingOrder =     		61; // Calc.
app.CSections.OtherViewCellCursor.processingOrder =   62; // Calc. Other views' cell cursors.
app.CSections.CellCursor.processingOrder =			63; // Calc.
app.CSections.AutoFillMarker.processingOrder =		64; // Calc.
app.CSections.Overlays.processingOrder =				65; // Writer & Impress & Calc. This is bound to tiles.
app.CSections.Debug.TilePixelGrid.processingOrder = 	66; // Writer & Impress & Calc. This is bound to tiles.
app.CSections.Debug.DebugOverlay.processingOrder = 	67; // Writer & Impress & Calc. This is bound to tiles.
app.CSections.Debug.PreloadMap.processingOrder =		68; // Writer & Impress & Calc. This is bound to tiles.
app.CSections.CalcGrid.processingOrder = 				69; // Calc. This is bound to tiles.
app.CSections.Debug.Splits.processingOrder = 			70; // Calc. This is bound to tiles.
app.CSections.Splitter.processingOrder = 			    80; // Calc.

app.CSections.CalcGrid.drawingOrder = 				40; // Calc.
app.CSections.Tiles.drawingOrder = 					50; // Writer & Impress & Calc.
app.CSections.CommentList.drawingOrder =				55; // Writer & Impress.
app.CSections.Debug.TilePixelGrid.drawingOrder = 		60; // Writer & Impress & Calc.
app.CSections.Debug.DebugOverlay.drawingOrder = 		60; // Writer & Impress & Calc.
app.CSections.Debug.PreloadMap.drawingOrder = 		60; // Writer & Impress & Calc.
app.CSections.Overlays.drawingOrder =					71; // Writer & Impress & Calc.
app.CSections.Debug.Splits.drawingOrder = 			90; // Calc.
app.CSections.FocusCell.drawingOrder =		    	91; // Calc.
app.CSections.OtherViewCellCursor.drawingOrder =      92; // Calc.
app.CSections.CellCursor.drawingOrder =				93; // Calc.
app.CSections.AutoFillMarker.drawingOrder =			94; // Calc.
app.CSections.RowGroup.drawingOrder =					100; // Calc.
app.CSections.ColumnGroup.drawingOrder =				110; // Calc.
app.CSections.CornerGroup.drawingOrder =				120; // Calc.
app.CSections.CornerHeader.drawingOrder =				130; // Calc.
app.CSections.RowHeader.drawingOrder = 				140; // Calc.
app.CSections.ColumnHeader.drawingOrder = 			150; // Calc.
app.CSections.Splitter.drawingOrder = 				160; // Calc.

/* zIndex = 6 and goes on. */

/* zIndex = 7 */
app.CSections.Comment.processingOrder =				1; // Since this is a document object, processing order is not very important. But it should be higher than tiles's processing order. Because tiles section is the document anchor.

app.CSections.Comment.drawingOrder =					1; // Writer & Imnpress & Calc.

/* zIndex = 9  */
app.CSections.HTMLObject.drawingOrder     =           55; // Calc.
app.CSections.HTMLObject.processingOrder     =        1; // Calc.
app.CSections.DefaultForDocumentObjects.processingOrder = 10;
app.CSections.DefaultForDocumentObjects.drawingOrder = 10;

/* zIndex = 11  */
app.CSections.ContentControl.processingOrder =		1; // Writer.

app.CSections.ContentControl.drawingOrder =			1; // Writer.

/* zIndex = 13 */
app.CSections.Scroll.processingOrder = 				1; // Writer & Impress & Calc.

app.CSections.Scroll.drawingOrder = 					1; // Writer & Impress & Calc.
