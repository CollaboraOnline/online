/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
const desktopHelper = require('../../common/desktop_helper');

function getSlideShowContent() {
	return cy.cGet('#slideshow-cypress-iframe');
}

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Some app', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('impress/slideshow.odp');
		desktopHelper.switchUIToCompact();

		cy.cGet('#menu-slide > a').click();
		cy.cGet('#menu-fullscreen-presentation > a').click();
	});

	it('Should see an empty slideshow', function() {
		cy.wait(2000); // wait for slideshow to load
		getSlideShowContent().compareSnapshot('slideshow', 0.09);
	});
});
