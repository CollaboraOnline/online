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

		cy.cGet('body').contains('.context-menu-link', 'Copy')
			.click();

		cy.cGet('#copy_paste_warning-box').should('exist');
	});

	it('Copy plain text.', function() {
		before('copy_paste_simple.odt');

		helper.selectAllText();

		let expected = '    • first\n    • second\n    • third\n';
		cy.cGet('#copy-plain-container').should('have.text', expected.replaceAll('\n', ''));
	});
});
