/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Statubar tests.', function() {
	var origTestFileName = 'statusbar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		desktopHelper.switchUIToCompact();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden ();
		}
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Text selection.', function() {
		cy.cGet('body').contains('#tb_actionbar_item_StateWordCount', '2 words, 9 characters');
		helper.moveCursor('right', 'shift');
		cy.cGet('body').contains('#tb_actionbar_item_StateWordCount', 'Selected: 1 word, 1 character');
	});

	it('Switching page.', function() {
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 1');
		cy.cGet('#menu-insert').click();
		cy.cGet('body').contains('#menu-insert li a', 'Page Break').click();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 2');
		cy.cGet('#tb_actionbar_item_prev').click();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 2');
		cy.cGet('#tb_actionbar_item_next').click();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 2');
	});

	it('Text entering mode.', function() {
		cy.cGet('#InsertMode').should('have.text', 'Insert');
		helper.typeIntoDocument('{insert}');
		cy.cGet('#InsertMode').should('have.text', 'Overwrite');
		helper.typeIntoDocument('{insert}');
		cy.cGet('#InsertMode').should('have.text', 'Insert');
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
