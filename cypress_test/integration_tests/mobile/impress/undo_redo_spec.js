/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Editing Operations', function() {
	var testFileName = 'annotation.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	function undo() {
		cy.get('.leaflet-layer').dblclick();

		cy.wait(3000);

		helper.typeIntoDocument('Hello World');

		cy.get('path.leaflet-interactive').dblclick();

		//if we don't wait tests in CLI is failing
		cy.wait(3000);

		cy.get('#tb_actionbar_item_undo').click();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello Worl');
	}

	it('Undo', function() {
		undo();
	});


	it('Redo',function() {
		undo();

		cy.get('#tb_actionbar_item_redo').click();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		cy.get('.leaflet-layer').dblclick();

		helper.typeIntoDocument('Hello World');

		cy.get('#toolbar-hamburger')
			.click()
			.get('.menu-entry-icon.editmenu').parent()
			.click()
			.get('.menu-entry-icon.repair').parent()
			.click();

		cy.get('.leaflet-popup-content table').should('exist');

		cy.contains('.leaflet-popup-content table tbody tr','Undo').eq(0)
			.click();

		cy.get('.leaflet-popup-content > input').click();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello Worl');
	});
});
