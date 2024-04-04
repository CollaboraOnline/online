/* global describe it cy require expect afterEach*/

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Clipboard operations.', function() {
	var testFileName;

	function before(filename) {
		testFileName = helper.beforeAll(filename, 'writer');
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	// Replaces the system clipboard with a dummy one. The specified type will be injected into
	// the DOM for assertion purposes.
	function setDummyClipboard(type) {
		if (type === undefined) {
			type = 'text/html';
		}
		cy.window().then(win => {
			const app = win['0'].app;
			const clipboard = app.map._clip;
			clipboard._dummyClipboard = {
				write: function(clipboardItems) {
					const clipboardItem = clipboardItems[0];
					clipboardItem.getType(type).then(blob => blob.text())
					.then(function (text) {
						if (type === 'text/html') {
							clipboard._dummyDiv.innerHTML = text;
						} else if (type == 'text/plain') {
							clipboard._dummyPlainDiv.innerHTML = text;
						}
					});
					return {
						then: function(resolve/*, reject*/) {
							resolve();
						},
					};
				},

				useAsyncWrite: true,
			};
		});
	}

	function copy() {
		cy.window().then(win => {
			const app = win['0'].app;
			const clipboard = app.map._clip;
			clipboard.filterExecCopyPaste('.uno:Copy');
		});
	}

	it('Copy and Paste text.', function() {
		before('copy_paste.odt');
		// Select some text
		helper.selectAllText();

		cy.cGet('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top - 5;

				cy.cGet('body').rightclick(XPos, YPos);
			});

		setDummyClipboard();

		cy.cGet('body').contains('.context-menu-link', 'Copy')
			.click();

		cy.cGet('#copy-paste-container div p').should('have.text', 'text');
	});

	it('Copy plain text.', function() {
		before('copy_paste_simple.odt');

		setDummyClipboard('text/plain');
		helper.selectAllText();
		copy();

		let expected = '    • first\n    • second\n    • third';
		cy.cGet('#copy-plain-container').should('have.text', expected);
	});
});
