/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Impress Transition Tab Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/slideshow.odp');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Transition tab exists in notebookbar', function() {
		cy.cGet('#Transition-tab-label')
			.should('exist')
			.should('be.visible')
			.should('have.text', 'Transition');
	});

	it('Apply to All Slides button exists', function() {
		cy.cGet('#Transition-tab-label').click();
		cy.cGet('#Transition-tab-label').should('have.class', 'selected');
		cy.cGet('#apply_to_all').should('exist');
	});
});
