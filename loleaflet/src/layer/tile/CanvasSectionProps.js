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
L.CSections.Tiles = 				{ name: 'tiles'				, zIndex: 5 };
L.CSections.CalcGrid = 				{ name: 'calc grid'			, zIndex: 5 };
L.CSections.Debug.Splits = 			{ name: 'splits'			, zIndex: 5 };
L.CSections.Debug.TilePixelGrid = 	{ name: 'tile pixel grid'	, zIndex: 5 };

L.CSections.ColumnHeader = 			{ name: 'column header'		, zIndex: 5 };
L.CSections.RowHeader = 			{ name: 'row header'		, zIndex: 5 };
L.CSections.CornerHeader = 			{ name: 'corner header'		, zIndex: 5 };

L.CSections.ColumnGroup = 			{ name: 'column group'		, zIndex: 5 };
L.CSections.RowGroup = 				{ name: 'row group'			, zIndex: 5 };
L.CSections.CornerGroup = 			{ name: 'corner group'		, zIndex: 5 };


/* Processing and drawing orders are meaningful between sections with the same zIndex. */
/* Processing order	: Important for locations and sizes of sections. */
/* Drawing order	: Highest with the same zIndex will be drawn on top. */

/* zIndex = 5 */
L.CSections.CornerHeader.processingOrder =			1; // Calc.
L.CSections.RowHeader.processingOrder =				2; // Calc.
L.CSections.ColumnHeader.processingOrder =			3; // Calc.
L.CSections.Tiles.processingOrder = 				5; // Writer & Impress & Calc.
L.CSections.Debug.TilePixelGrid.processingOrder = 	5; // Writer & Impress & Calc. This is bound to tiles, processingOrder is not important.
L.CSections.CalcGrid.processingOrder = 				5; // Calc. This is bound to tiles, processingOrder is not important.
L.CSections.Debug.Splits.processingOrder = 			5; // Calc. This is bound to tiles, processingOrder is not important.


L.CSections.CalcGrid.drawingOrder = 				4; // Calc. This is 7 when debugging is enabled.
L.CSections.Tiles.drawingOrder = 					5; // Writer & Impress & Calc.
L.CSections.Debug.TilePixelGrid.drawingOrder = 		6; // Writer & Impress & Calc.
/* drawingOrder = 7 is reserved for debugging mode of CalcGrid */
L.CSections.Debug.Splits.drawingOrder = 			8; // Calc.
L.CSections.RowHeader.drawingOrder = 				9; // Calc.
L.CSections.ColumnHeader.drawingOrder = 			10; // Calc.
L.CSections.CornerHeader.drawingOrder =				11; // Calc.



/* zIndex = 6 and goes on. */