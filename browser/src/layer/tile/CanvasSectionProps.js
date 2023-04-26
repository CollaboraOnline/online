/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * CanvasSectionProps
 *
 * It's really difficult to set drawing and processing orders of sections, since they are mostly defined on different files.
 * So we have this file, to manage their orders easily. Define them here, globally. Then you can use from everywhere.
 * Refer to CanvasSectionContainer.ts for definitions of processingOrder, drawingOrder and zIndex.
 */
/* global L */

L.CSections = {};
L.CSections.Debug = {}; // For keeping things simple.

// First definitions. Other properties will be written according to their orders.
L.CSections.CommentList =			{ name: 'comment list'		, zIndex: 5	};
L.CSections.Tiles = 				{ name: 'tiles'				, zIndex: 5 };
L.CSections.Overlays =				{ name: 'overlay'			, zIndex: 5 };
L.CSections.CalcGrid = 				{ name: 'calc grid'			, zIndex: 5 };
L.CSections.Debug.Splits = 			{ name: 'splits'			, zIndex: 5 };
L.CSections.Debug.TilePixelGrid = 	{ name: 'tile pixel grid'	, zIndex: 5 };

L.CSections.ColumnHeader = 			{ name: 'column header'		, zIndex: 5 };
L.CSections.RowHeader = 			{ name: 'row header'		, zIndex: 5 };
L.CSections.CornerHeader = 			{ name: 'corner header'		, zIndex: 5 };

L.CSections.ColumnGroup = 			{ name: 'column group'		, zIndex: 5 };
L.CSections.RowGroup = 				{ name: 'row group'			, zIndex: 5 };
L.CSections.CornerGroup = 			{ name: 'corner group'		, zIndex: 5 };

L.CSections.Scroll =				{ name: 'scroll'			, zIndex: 8};

L.CSections.Comment =				{ name: 'comment'			, zIndex: 9	}; // This class is for comment markers. It is a document object. One should change instance's name after initializing (there may be many instances of this class).

L.CSections.AutoFillMarker = 		{ name: 'auto fill marker'	, zIndex: 10};

L.CSections.ContentControl =        { name: 'content control'   , zIndex: 11 };
/* Processing and drawing orders are meaningful between sections with the same zIndex. */
/* Processing order	: Important for locations and sizes of sections. */
/* Drawing order	: Highest with the same zIndex will be drawn on top. */

/* zIndex = 5 */

L.CSections.CommentList.processingOrder = 			24; // Writer & Impress. Before tiles section, because tiles section will be expanded into the empty area.
L.CSections.CornerGroup.processingOrder =			25; // Calc.
L.CSections.RowGroup.processingOrder =				27; // Calc.
L.CSections.ColumnGroup.processingOrder =			29; // Calc.
L.CSections.CornerHeader.processingOrder =			30; // Calc.
L.CSections.RowHeader.processingOrder =				40; // Calc.
L.CSections.ColumnHeader.processingOrder =			50; // Calc.
L.CSections.Tiles.processingOrder = 				60; // Writer & Impress & Calc.
L.CSections.Overlays.processingOrder =				61; // Writer & Impress & Calc. This is bound to tiles.
L.CSections.Debug.TilePixelGrid.processingOrder = 	62; // Writer & Impress & Calc. This is bound to tiles.
L.CSections.CalcGrid.processingOrder = 				63; // Calc. This is bound to tiles.
L.CSections.Debug.Splits.processingOrder = 			64; // Calc. This is bound to tiles.

L.CSections.CalcGrid.drawingOrder = 				40; // Calc.
L.CSections.Tiles.drawingOrder = 					50; // Writer & Impress & Calc.
L.CSections.CommentList.drawingOrder =				55; // Writer & Impress.
L.CSections.Debug.TilePixelGrid.drawingOrder = 		60; // Writer & Impress & Calc.
L.CSections.Overlays.drawingOrder =					71; // Writer & Impress & Calc.
L.CSections.CalcGrid.drawingOrderDebug =            80; // Calc debug mode.
L.CSections.Debug.Splits.drawingOrder = 			90; // Calc.
L.CSections.RowGroup.drawingOrder =					100; // Calc.
L.CSections.ColumnGroup.drawingOrder =				110; // Calc.
L.CSections.CornerGroup.drawingOrder =				120; // Calc.
L.CSections.CornerHeader.drawingOrder =				130; // Calc.
L.CSections.RowHeader.drawingOrder = 				140; // Calc.
L.CSections.ColumnHeader.drawingOrder = 			150; // Calc.


/* zIndex = 6 and goes on. */

/* zIndex = 8 */
L.CSections.Scroll.processingOrder = 				1; // Writer & Impress & Calc.

L.CSections.Scroll.drawingOrder = 					1; // Writer & Impress & Calc.

/* zIndex = 9 */
L.CSections.Comment.processingOrder =				1; // Since this is a document object, processing order is not very important. But it should be higher than tiles's processing order. Because tiles section is the document anchor.

L.CSections.Comment.drawingOrder =					1; // Writer & Imnpress & Calc.

/* zIndex = 10  */
L.CSections.AutoFillMarker.processingOrder =		1; // Calc.

L.CSections.AutoFillMarker.drawingOrder =			1; // Calc.


/* zIndex = 11  */
L.CSections.ContentControl.processingOrder =		1; // Writer.

L.CSections.ContentControl.drawingOrder =			1; // Writer.
