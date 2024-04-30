/* global describe it cy require expect */

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Clipboard operations.', function() {

	it('Copy and Paste text.', function() {
		helper.setupAndLoadDocument('writer/copy_paste.odt');
		// Select some text
		helper.selectAllText();

		cy.cGet('.html-object-section')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top - 5;

				cy.cGet('body').rightclick(XPos, YPos);
			});

		helper.setDummyClipboardForCopy();

		cy.cGet('body').contains('.context-menu-link', 'Copy')
			.click();

		cy.cGet('#copy-paste-container div p').should('have.text', 'text');
	});

	it('Copy plain text.', function() {
		helper.setupAndLoadDocument('writer/copy_paste_simple.odt');

		helper.setDummyClipboardForCopy('text/plain');
		helper.selectAllText();
		helper.copy();

		let expected = '    • first\n    • second\n    • third';
		cy.cGet('#copy-plain-container').should('have.text', expected);
	});
});
