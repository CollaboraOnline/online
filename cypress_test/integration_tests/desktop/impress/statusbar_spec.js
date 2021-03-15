/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Statubar tests.', function() {
	var testFileName = 'statusbar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden ();
		}
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Selected slide.', function() {
		cy.get('#PageStatus')
			.should('have.text', 'Slide 1 of 2');

		cy.get('#tb_actionbar_item_next')
			.click();

		cy.get('#PageStatus')
			.should('have.text', 'Slide 2 of 2');

		cy.get('#tb_actionbar_item_prev')
			.click();

		cy.get('#PageStatus')
			.should('have.text', 'Slide 1 of 2');
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
