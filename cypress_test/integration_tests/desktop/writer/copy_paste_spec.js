/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');

describe('Clipboard operations.', function() {
	var testFileName = 'copy_paste.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Copy and Paste text.', function() {
		// Select some text
		helper.selectAllText();

		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top - 5;

				cy.get('body').rightclick(XPos, YPos);
			});

		cy.contains('.context-menu-link', 'Copy')
			.click();

		// COOL code can not execute document.execCommand() when executed by cypress
		// https://github.com/cypress-io/cypress/issues/2851
		cy.get('.vex-dialog-message p')
			.should('have.text', 'Your browser has very limited access to the clipboard, so use these keyboard shortcuts:');

		cy.get('.vex-dialog-form button[type=\'submit\']')
			.click();

		cy.get('.vex-dialog-form')
			.should('not.exist');
	});
});
