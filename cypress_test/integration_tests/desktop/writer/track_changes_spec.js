/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Track Changes', function () {
	var testFileName = 'track_changes.odt';

	beforeEach(function () {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function confirmChange(action) {
		cy.get('#menu-editmenu')
			.click()
			.get('#menu-changesmenu')
			.click()
			.contains(action)
			.click();
	}

	//enable record for track changes
	function enableRecord() {
		cy.get('#menu-editmenu')
			.click()
			.get('#menu-changesmenu')
			.click()
			.contains('Record')
			.click();

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		cy.get('#menu-editmenu')
			.click()
			.get('#menu-changesmenu')
			.click()
			.contains('Record')
			.should('have.class', 'lo-menu-item-checked');

		//to close
		cy.get('#menu-changesmenu')
			.click();
	}

	it('Accept All', function () {

		helper.typeIntoDocument('Hello World');

		enableRecord();

		helper.clearAllText();
		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		helper.selectAllText();

		confirmChange('Accept All');

		cy.wait(200);

		helper.typeIntoDocument('{ctrl}a');

		helper.textSelectionShouldNotExist();
	});

	it.skip('Reject All', function () {

		helper.typeIntoDocument('Hello World');

		enableRecord();

		helper.clearAllText();

		//if we don't wait , the test will fail in CLI
		cy.wait(600);

		helper.selectAllText();

		confirmChange('Reject All');

		cy.wait(200);

		cy.get('.leaflet-layer').click();

		helper.selectAllText();

		helper.expectTextForClipboard('\nHello World');
	});
});
