/* global describe it cy require beforeEach */

var helper = require('../../common/helper');

function getSlideShowContent() {
	return cy.cGet('#slideshow-cypress-iframe');
}

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Some app', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('impress/slideshow.odp');
		cy.cGet('.notebookbar #View-tab-label').click();
		cy.cGet('.notebookbar #view-presentation-button').click();
		cy.cGet('#view-presentation-entry-0').click();
	});

	it('Should see an empty slideshow', function() {
		getSlideShowContent().should('be.visible');
		getSlideShowContent().compareSnapshot('slideshow', 0.15);
	});
});
