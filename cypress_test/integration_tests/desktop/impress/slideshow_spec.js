/* global describe it cy require beforeEach */

var helper = require('../../common/helper');

function getSlideShowContent() {
	return cy.cGet('#slideshow-cypress-iframe');
}

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Some app', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('impress/slideshow.odp');
		cy.cGet('.notebookbar #Slideshow-tab-label').click();
		cy.cGet('.notebookbar #slide-fullscreen-presentation-button').click();
	});

	it('Should see an empty slideshow', function () {
		getSlideShowContent().should('be.visible');
		//FIXME: remove explicit wait. I tried to assert slideshow's canvas but for some reason cypress can't find slideshow iframe
		cy.wait(1000);
		getSlideShowContent().compareSnapshot('slideshow', 0.15);
	});
});
