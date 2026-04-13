/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

describe('ViewLayout', function() {

var _ = function(text: string) { return text; };

class ResizeObserver {
	constructor(f: Function) {}

	disconnect() {}

	observe() {}

	unobserve() {}
}

function initializeJSDOM() {
	addCanvasToDom();
	addMockCanvas(window);
	global.requestAnimationFrame = window.requestAnimationFrame;
	global.cancelAnimationFrame = window.cancelAnimationFrame;
	// DocumentBase / TableMiddleware call bare `getComputedStyle(...)`.
	// In the browser it's a window global; in node we forward to jsdom's.
	global.getComputedStyle = window.getComputedStyle.bind(window);
	global.ResizeObserver = ResizeObserver;

	const canvasWidth = 1024;
	const canvasHeight = 768;
	setupCanvasContainer(canvasWidth, canvasHeight);
	app.events = new DocEvents();
}

describe('View Layout Tests', function () {
    this.beforeAll(initializeJSDOM);

    it('Check Pan Direction', function () {
		app.map = {
			on: function() {}
		} as any

        const viewLayout = new ViewLayoutBase();

        viewLayout.viewedRectangle = new cool.SimpleRectangle(100, 100, 100, 100);
        let panDirection = viewLayout.getLastPanDirection();

        nodeassert.ok(panDirection[0] === 1 && panDirection[1] === 1);

        viewLayout.viewedRectangle = new cool.SimpleRectangle(50, 50, 100, 100);
        panDirection = viewLayout.getLastPanDirection();
        nodeassert.ok(panDirection[0] === -1 && panDirection[1] === -1);
	});

	it('Check current coordinate list', function() {

		// DocumentBase + ViewLayoutMultiPage touch a lot of the app surface
		// that is normally populated at browser load (CanvasSectionProps.js,
		// docstate.ts, Map.js, etc.). Under mocha none of that runs, so we
		// stub just the pieces the constructors read.

		// CSections read by MouseControl / TextSelectionSection field
		// initialisers. Values mirror browser/src/canvas/CanvasSectionProps.js.
		(app.CSections as any).MouseControl = {
			name: 'mouse-control', zIndex: 5,
			processingOrder: 72, drawingOrder: 51,
		};
		(app.CSections as any).Tiles = {
			name: 'tiles', zIndex: 5,
			processingOrder: 60, drawingOrder: 50,
		};
		(app.CSections as any).TextSelection = {
			name: 'text selection', zIndex: 5,
			processingOrder: 74, drawingOrder: 52,
		};

		// app.file is populated by docstate.ts in the browser. ViewLayoutMultiPage
		// reset() reads app.file.writer.pageRectangleList.
		(app as any).file = { writer: { pageRectangleList: [] } };

		// Use the real twips/pixel convention (1 pixel = 15 twips). globals.ts
		// has these swapped because the existing "Check Pan Direction" test
		// only relies on the sign of pX1 deltas; here we compare actual tile
		// coordinates so they must be correct.
		app.pixelsToTwips = 15;
		app.twipsToPixels = 1 / 15;

		// A fuller app.map stub than the first test. Covers:
		//   * on()                  - TableMiddleware.setupTableOverlay / ViewLayoutMultiPage ctor
		//   * _docLayer._docType    - DocumentBase ctor branches
		//   * uiManager             - DocumentBase.addSections
		//   * getScaleZoom/setZoom  - ViewLayoutMultiPage.adjustViewZoomLevel
		//   * getZoom               - refreshCurrentCoordList rounds it for tile z
		app.map = {
			on: function() {},
			uiManager: null,
			_docLayer: { _docType: 'other' },
			getScaleZoom: function() { return 1; },
			setZoom: function() {},
			getZoom: function() { return 10; },
		} as any;

		// CanvasSectionContainer.getDocumentAnchorSection returns null until a
		// section has been registered as the anchor. adjustViewZoomLevel and
		// refreshCurrentCoordList both dereference .size, so give it a minimal
		// section-like object. The size matches setupCanvasContainer(1024, 768).
		(app.sectionContainer as any).getDocumentAnchorSection = function() {
			return { size: [1024, 768], myTopLeft: [0, 0] };
		};

		// Assign a real DocumentBase instance. _fileSize must cover all 3
		// pages because BitmapTileManager.isValidTile rejects tile coordinates
		// outside fileSize.
		const activeDocument = new DocumentBase();
		(activeDocument as any)._fileSize = new cool.SimplePoint(7500, 49000);
		app.activeDocument = activeDocument;

		const multiPageViewLayout = new ViewLayoutMultiPage();

		// 3 pages of 7500 x 15000 twips with a 2000-twip vertical gap.
		const pageRectangles = [
			[0, 0, 7500, 15000],
			[0, 17000, 7500, 15000],
			[0, 34000, 7500, 15000],
		];
		app.file.writer.pageRectangleList = pageRectangles;

		// resetViewLayout positions pages into viewRectangles. The public
		// reset() defers via LayoutingService and would also kick off
		// updateViewData (which expects a live socket / docLayer). Calling
		// the layout step directly keeps the test focused.
		(multiPageViewLayout as any).resetViewLayout();

		// Helper: compute the current tile list and return its keys sorted.
		const tileKeysSorted = (): string[] => {
			(multiPageViewLayout as any).refreshCurrentCoordList();
			return multiPageViewLayout
				.getCurrentCoordList()
				.map(function(t: any) { return t.key(); })
				.sort();
		};

		// Helper: assert with a console diff for easy copy/paste when the
		// calculation diverges from reality.
		const expectKeys = (label: string, actual: string[], expected: string[]) => {
			if (JSON.stringify(actual) !== JSON.stringify(expected)) {
				console.error('[' + label + '] tile list mismatch.');
				console.error('  expected: ' + JSON.stringify(expected));
				console.error('  actual:   ' + JSON.stringify(actual));
			}
			nodeassert.deepStrictEqual(actual, expected);
		};

		// --- Initial state, no scroll ---------------------------------------
		// canvasSize = 1024 x 768 (core px). With pixelsToTwips=15 each page
		// is 500 x 1000 px. resetViewLayout puts one page per row centred:
		//   page 0: viewRect (262, 20)..(762, 1020)
		//   page 1: viewRect (262, 1040)..(762, 2040)
		//   page 2: viewRect (262, 2060)..(762, 3060)
		// At viewY=0 only page 0 intersects the 1024x768 view. Visible portion
		// in page 0 doc coords: (0, 0)..(500, 748). With tileSize=256 that
		// gives candidate tiles startX=0..512, startY=0..768. isValidTile then
		// drops x=512 because x*15 = 7680 >= fileSize.x (7500).
		const expectedInitial = [
			'0:0:10:0:0', '0:256:10:0:0', '0:512:10:0:0', '0:768:10:0:0',
			'256:0:10:0:0', '256:256:10:0:0', '256:512:10:0:0', '256:768:10:0:0',
		].sort();

		expectKeys('initial', tileKeysSorted(), expectedInitial);

		// --- After scrolling down by one viewport (768 px) ------------------
		// ViewLayoutNewBase.scroll() rate-limits and uses a multiplier derived
		// from refreshScrollProperties; mutating viewY directly is the simplest
		// way to drive refreshCurrentCoordList without reproducing all of
		// that machinery here.
		multiPageViewLayout.scrollProperties.viewY = 768;

		// view = pY1=768..pY2=1536. Now the bottom of page 0 and the top of
		// page 1 are both visible.
		//   page 0 visible view-y 768..1020 -> doc-y 748..1000
		//     startY=512, rowCount=ceil((1000-512)/256)=2
		//     tile y in {512, 768, 1024}, x in {0, 256} after isValidTile.
		//   page 1 (docRect.pY1 = round(17000/15) = 1133) visible view-y
		//   1040..1536 -> doc-y 1133..1629
		//     startY=1024, rowCount=ceil((1629-1024)/256)=3
		//     tile y in {1024, 1280, 1536, 1792}, x in {0, 256}.
		// The Set in refreshCurrentCoordList dedupes overlapping keys (e.g.
		// 0:1024 appears for both pages). Result: 12 unique tiles.
		const expectedAfterScroll = [
			// from page 0
			'0:512:10:0:0', '0:768:10:0:0', '0:1024:10:0:0',
			'256:512:10:0:0', '256:768:10:0:0', '256:1024:10:0:0',
			// from page 1 (1024 keys overlap with page 0, will be deduped)
			'0:1024:10:0:0', '0:1280:10:0:0', '0:1536:10:0:0', '0:1792:10:0:0',
			'256:1024:10:0:0', '256:1280:10:0:0', '256:1536:10:0:0', '256:1792:10:0:0',
		];
		const expectedAfterScrollDedup = Array.from(new Set(expectedAfterScroll)).sort();

		expectKeys('after-scroll', tileKeysSorted(), expectedAfterScrollDedup);
	});
});

});
