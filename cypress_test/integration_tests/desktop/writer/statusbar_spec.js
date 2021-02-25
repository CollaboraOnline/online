/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Statubar tests.', function() {
	var testFileName = 'statusbar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden ();
		}
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Text selection.', function() {
		cy.get('#StateWordCount')
			.should('have.text', '2 words, 9 characters');

		helper.moveCursor('right', 'shift');

		cy.get('#StateWordCount')
			.should('have.text', 'Selected: 1 word, 1 character');
	});

	it('Switching page.', function() {
		cy.get('#StatePageNumber')
			.should('have.text', 'Page 1 of 1');

		cy.get('#menu-insert')
			.click();

		cy.contains('#menu-insert li a', 'Page Break')
			.click();

		cy.get('#StatePageNumber')
			.should('have.text', 'Page 2 of 2');

		cy.get('#tb_actionbar_item_prev')
			.click();

		cy.get('#StatePageNumber')
			.should('have.text', 'Page 1 of 2');

		cy.get('#tb_actionbar_item_next')
			.click();

		cy.get('#StatePageNumber')
			.should('have.text', 'Page 2 of 2');
	});

	it('Text entering mode.', function() {
		cy.get('#InsertMode')
			.should('have.text', 'Insert');

		helper.typeIntoDocument('{insert}');

		cy.get('#InsertMode')
			.should('have.text', 'Overwrite');

		helper.typeIntoDocument('{insert}');

		cy.get('#InsertMode')
			.should('have.text', 'Insert');
	});

	it('Change zoom level.', function() {
		cy.get('#tb_actionbar_item_zoomreset')
			.click();

		desktopHelper.shouldHaveZoomLevel('100');

		desktopHelper.zoomIn();

		desktopHelper.shouldHaveZoomLevel('120');

		desktopHelper.zoomOut();

		desktopHelper.shouldHaveZoomLevel('100');
	});

	it('Select zoom level.', function() {
		cy.get('#tb_actionbar_item_zoomreset')
			.click();

		desktopHelper.shouldHaveZoomLevel('100');

		desktopHelper.selectZoomLevel('280');

		desktopHelper.shouldHaveZoomLevel('280');
	});
});
