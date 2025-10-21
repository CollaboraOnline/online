/* global describe it cy require */

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Clipboard operations.', function() {

	it('Copy and Paste text.', function() {
		helper.setupAndLoadDocument('writer/copy_paste.odt');
		// Select some text
		helper.selectAllText();

		cy.getFrameWindow().then(win => {
			const selectionStart = win.TextSelections.getStartRectangle();
			cy.cGet('#document-container').rightclick(selectionStart.pX1, selectionStart.pY1);
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
