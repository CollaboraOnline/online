/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Calc clipboard tests.', function() {
	var origTestFileName = 'clipboard.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	function setDummyClipboard(type, content, image = false, fail = false) {
		cy.window().then(win => {
			var app = win['0'].app;
			var metaURL = encodeURIComponent(app.map._clip.getMetaURL());
			if (type === 'text/html') {
				content = content.replace('%META_URL%', metaURL);
			}
			var blob = new Blob([content]);
			var clipboard = app.map._clip;
			var clipboardItem = {
				getType: function(type) {
					return {
						then: function(resolve/*, reject*/) {
							if (image && type === 'text/html') {
								resolve(new Blob(['<img></img>']));
							} else {
								resolve(blob);
							}
						},
					};
				},
				types: image ? [type, 'text/html'] : [type],
			};
			var clipboardItems = [clipboardItem];
			clipboard._dummyClipboard = {
				read: function() {
					return {
						then: function(resolve, reject) {
							if (fail) {
								reject({
									message: 'rejected',
								});
							} else {
								resolve(clipboardItems);
							}
						},
					};
				},
			};
		});
	}

	it('HTML paste, internal case', function() {
		// Given a document with a SUM() in C1, and copying that to the clipboard:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		// A1 is 1, B1 is 2, so C1 is 3.
		helper.typeIntoInputField('input#addressInput', 'C1');
		cy.window().then(win => {
			var app = win['0'].app;
			app.socket.sendMessage('uno .uno:Copy');
		});
		var html = '<div id="meta-origin" data-coolorigin="%META_URL%">ignored</div>';
		setDummyClipboard('text/html', html);

		// When pasting C1 to D1:
		helper.typeIntoInputField('input#addressInput', 'D1');
		cy.cGet('#home-paste-button').click();
		cy.cGet('#home-paste-entries .ui-combobox-entry').contains('Paste').click();

		// Then make sure the formula gets rewritten as expected:
		// Internal paste: B1 is 2, C1 is 3, so D1 is 5.
		// Without the accompanying fix in place, this test would have failed with:
		// expected **#copy-paste-container table td:nth-of-type(1)** to have text **'5'**, but the text was **''**
		// i.e. a popup dialog was shown, instead of working, like with Ctrl-V.
		helper.setDummyClipboardForCopy();
		helper.copy();
		cy.cGet('#copy-paste-container table td:nth-of-type(1)').should('have.text', '5');
	});

	it('HTML paste, external case', function() {
		// Given a Calc document:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		var html = '<div>clipboard</div>';
		setDummyClipboard('text/html', html);

		// When pasting the clipboard to A1:
		cy.cGet('#home-paste-button').click();
		cy.cGet('#home-paste-entries .ui-combobox-entry').contains('Paste').click();

		// Then make sure we actually consider the content of the HTML:
		cy.cGet('#sc_input_window.formulabar .ui-custom-textarea-text-layer').should('have.text', 'clipboard');
	});

	it('Plain text paste', function() {
		// Given a Calc document:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		var text = 'plain text';
		setDummyClipboard('text/plain', text);

		// When pasting the clipboard to A1:
		cy.cGet('#home-paste-button').click();
		cy.cGet('#home-paste-entries .ui-combobox-entry').contains('Paste').click();

		// Then make the paste happened:
		cy.cGet('#sc_input_window.formulabar .ui-custom-textarea-text-layer').should('have.text', 'plain text');
	});

	it('Image paste', function() {
		// Given a Calc document:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		var base64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEW10NBjBBbqAAAAH0lEQVRo';
		base64 += 'ge3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABmmDh1QAAAABJRU5ErkJggg==';
		var blob = Cypress.Blob.base64StringToBlob(base64, 'image/png');
		setDummyClipboard('image/png', blob, /*image=*/true);

		// When pasting the clipboard:
		cy.cGet('#home-paste-button').click();
		cy.cGet('#home-paste-entries .ui-combobox-entry').contains('Paste').click();

		// Then make sure the paste happened:
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
	});

	it('HTML paste, internal case failing', function() {
		// Given a document with an A1 cell copied to the clipboard:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		helper.typeIntoInputField('input#addressInput', 'A1');
		cy.window().then(win => {
			var app = win['0'].app;
			app.socket.sendMessage('uno .uno:Copy');
		});
		var html = '<div id="meta-origin" data-coolorigin="%META_URL%">ignored</div>';
		setDummyClipboard('text/html', html, /*image=*/false, /*fail=*/true);

		// When pasting the clipboard to B1, which fails:
		helper.typeIntoInputField('input#addressInput', 'B1');
		cy.cGet('#home-paste-button').click();
		cy.cGet('#home-paste-entries .ui-combobox-entry').contains('Paste').click();

		// Then make sure a warning popup is shown:
		cy.cGet('#copy_paste_warning-box').should('exist');
	});
});
