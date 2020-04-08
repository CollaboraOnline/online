/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Clipboard operations.', function() {
	beforeEach(function() {
		helper.loadTestDoc('copy_paste.odt');
	});

	afterEach(function() {
		helper.afterAll('copy_paste.odt');
	});

	it('Copy and Paste text.', function() {
		// Select some text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top - 5;
				cy.wait(200);
				cy.get('body').rightclick(XPos, YPos);
			});

		helper.selectItemByContent('.context-menu-link', 'Copy')
			.click();

		// Loleaflet code can not execute document.execCommand() when executed by cypress
		// https://github.com/cypress-io/cypress/issues/2851
		cy.get('.vex-dialog-message p')
			.should('have.text', 'Your browser has very limited access to the clipboard, so use these keyboard shortcuts:');
	});
});
