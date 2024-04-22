/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Statubar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/statusbar.odp');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden ();
		}
	});

	it('Selected slide.', function() {
		cy.cGet('#SlideStatus').should('have.text', 'Slide 1 of 2');
		cy.cGet('#toolbar-down #next').click();
		cy.cGet('#SlideStatus').should('have.text', 'Slide 2 of 2');
		cy.cGet('#toolbar-down #prev').click();
		cy.cGet('#SlideStatus').should('have.text', 'Slide 1 of 2');
	});

	it('Change zoom level.', function() {
		desktopHelper.resetZoomLevel();
		desktopHelper.shouldHaveZoomLevel('100');
		desktopHelper.zoomIn();
		desktopHelper.shouldHaveZoomLevel('120');
		desktopHelper.zoomOut();
		desktopHelper.shouldHaveZoomLevel('100');
	});

	it('Select zoom level.', function() {
		desktopHelper.resetZoomLevel();
		desktopHelper.shouldHaveZoomLevel('100');
		desktopHelper.selectZoomLevel('280');
		desktopHelper.shouldHaveZoomLevel('280');
	});
});
