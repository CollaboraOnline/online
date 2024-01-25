/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Calc clipboard tests.', function() {
	var origTestFileName = 'clipboard.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function setDummyClipboard(html) {
		cy.window().then(win => {
			var app = win['0'].app;
			var metaURL = encodeURIComponent(app.map._clip.getMetaURL());
			html = html.replace('%META_URL%', metaURL);
			var blob = new Blob([html]);
			var clipboard = app.map._clip;
			var clipboardItem = {
				getType: function(/*type*/) {
					return {
						then: function(resolve/*, reject*/) {
							resolve(blob);
						},
					};
				},
				types: ['text/html'],
			};
			var clipboardItems = [clipboardItem];
			clipboard._dummyClipboard = {
				read: function() {
					return {
						then: function(resolve/*, reject*/) {
							resolve(clipboardItems);
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
		setDummyClipboard(html);

		// When pasting C1 to D1:
		helper.typeIntoInputField('input#addressInput', 'D1');
		cy.cGet('#home-paste-button').click();
		cy.cGet('#w2ui-overlay-pastemenu tr[title="Ctrl + V"]').click();

		// Then make sure the formula gets rewritten as expected:
		// Internal paste: B1 is 2, C1 is 3, so D1 is 5.
		// Without the accompanying fix in place, this test would have failed with:
		// expected **#copy-paste-container table td:nth-of-type(1)** to have text **'5'**, but the text was **''**
		// i.e. a popup dialog was shown, instead of working, like with Ctrl-V.
		cy.cGet('#copy-paste-container table td:nth-of-type(1)').should('have.text', '5');
	});

	it('HTML paste, external case', function() {
		// Given a Calc document:
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		var html = '<div>clipboard</div>';
		setDummyClipboard(html);

		// When pasting the clipboard to A1:
		cy.cGet('#home-paste-button').click();
		cy.cGet('#w2ui-overlay-pastemenu tr[title="Ctrl + V"]').click();

		// Then make sure we actually consider the content of the HTML:
		cy.cGet('#sc_input_window.formulabar .ui-custom-textarea-text-layer').should('have.text', 'clipboard');
	});
});
