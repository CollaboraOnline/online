/* global describe it cy beforeEach require expect Cypress */

var helper = require('../../common/helper');

// Wait for the #coolframe iframe to have a fully loaded document
// (app.map._docLayer exists).  WASM initialization can be slow.
function waitForDocInFrame() {
	cy.get('#coolframe', {timeout: 120000}).should(function($iframe) {
		var win = $iframe[0].contentWindow;
		expect(win.app, 'app').to.exist;
		expect(win.app.map, 'app.map').to.exist;
		expect(win.app.map._docLayer, 'app.map._docLayer').to.exist;
	});
}

// Load a document in WASM mode instead of the default server mode.
function loadDocumentWasm(filePath) {
	var URI = '/browser/' + Cypress.env('WSD_VERSION_HASH') + '/wasm.html'
		+ '?lang=en-US'
		+ '&file_path=' + Cypress.env('DATA_WORKDIR') + filePath;

	cy.visit(URI);
	waitForDocInFrame();
}

// Get the iframe's content window.
function getFrameWindow() {
	return cy.get('#coolframe').its('0.contentWindow');
}

describe(['tagwasm'], 'WASM to server mode in-place switch.', function() {

	beforeEach(function() {
		// Set active frame so the afterEach hook in
		// support/index.js does not fail.
		cy.cSetActiveFrame('#coolframe');
	});

	// Requires Firefox Nightly (Chrome lacks SharedArrayBuffer
	// in the Cypress iframe) and geckodriver on PATH.  Run via:
	//   CYPRESS_BROWSER=/path/to/firefox-nightly make check-wasm
	it('Switch to server mode preserving view state', function() {
		var testFile = helper.setupDocument('calc/cell_cursor.ods');
		loadDocumentWasm(testFile);

		getFrameWindow().then(function(win) {
			expect(win.ThisIsTheEmscriptenApp).to.equal(true);
		});

		// Navigate to a distant cell via the address input.
		// The toolbar may be hidden in readonly/viewing mode, so
		// use force to bypass the visibility check.
		cy.get('#coolframe').its('0.contentDocument')
			.find('#addressInput input')
			.clear({force: true}).type('Z50{enter}', {force: true});

		getFrameWindow().then(function(win) {
			cy.wrap(win.app.map.getZoom()).as('savedZoom');
			cy.wrap(win.app.map.getCenter().lat).as('savedLat');

			// Switch to server mode in-place (no page reload).
			win.switchToServerMode();
		});

		// The in-place switch mutes the emscripten bridge and
		// connects a real WebSocket.  Wait for the reconnection
		// to complete: ThisIsTheEmscriptenApp should be cleared
		// and the document should still be loaded.
		cy.get('#coolframe', {timeout: 60000}).should(function($iframe) {
			var win = $iframe[0].contentWindow;
			expect(win.ThisIsTheEmscriptenApp,
				'should no longer be WASM').to.not.equal(true);
			// The doc layer should still exist (in-place switch
			// preserves it via the reconnection path).
			expect(win.app.map._docLayer,
				'docLayer should still exist').to.exist;
		});

		getFrameWindow().then(function(win) {
			// Zoom should be preserved.
			cy.get('@savedZoom').then(function(savedZoom) {
				expect(win.app.map.getZoom()).to.equal(savedZoom);
			});

			// Scroll position should be approximately preserved
			// (the reconnection path sends the current part).
			cy.get('@savedLat').then(function(savedLat) {
				var currentLat = win.app.map.getCenter().lat;
				// Allow some tolerance for layout differences
				// between WASM and server rendering.
				expect(Math.abs(currentLat - savedLat)).to.be.below(50);
			});
		});
	});
});
