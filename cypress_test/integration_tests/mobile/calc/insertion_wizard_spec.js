/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var calcHelper = require('./calc_helper');

describe('Calc insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('insertion_wizard.ods', 'calc');

		// Click on edit button
		cy.get('#mobile-edit-button').click();
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Check existance of image insertion items.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		cy.get('.menu-entry-with-icon')
			.contains('Local Image...');

		cy.get('.menu-entry-with-icon')
			.contains('Image...');
	});

	it('Insert chart.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		cy.get('.menu-entry-with-icon')
			.contains('Chart...')
			.click();

		cy.get('.leaflet-drag-transform-marker')
			.should('have.length', 8);
	});

	it('Insert hyperlink.', function() {
		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		cy.get('.menu-entry-with-icon')
			.contains('Hyperlink...')
			.click();

		// Dialog is opened
		cy.get('.vex-content.hyperlink-dialog')
			.should('exist');

		// Type text and link
		cy.get('.vex-content.hyperlink-dialog input[name="text"]')
			.clear()
			.type('some text');
		cy.get('.vex-content.hyperlink-dialog input[name="link"]')
			.type('www.something.com');

		// Insert
		cy.get('.vex-content.hyperlink-dialog .vex-dialog-button-primary')
			.click();

		cy.get('.blinking-cursor')
			.should('be.visible');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td a')
			.contains('some text');

		cy.get('#copy-paste-container table td a')
			.should('have.attr', 'href', 'http://www.something.com');
	});
});
