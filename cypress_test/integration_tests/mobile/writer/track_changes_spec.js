/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Track Changes', function() {
	var testFileName = 'track_changes.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function confirmChange(action) {
		cy.get('#toolbar-hamburger')
			.click()
			.get('.menu-entry-icon.changesmenu').parent()
			.click();
		if (action === 'Accept All') {
			cy.get('.menu-entry-icon.acceptalltrackedchanges')
				.click();
		} else if (action === 'Reject All') {
			cy.get('.menu-entry-icon.rejectalltrackedchanges')
				.click();
		}
	}
	//enable record for track changes
	function enableRecord() {
		cy.get('#toolbar-hamburger')
			.click()
			.get('.menu-entry-icon.changesmenu').parent()
			.click()
			.get('.menu-entry-icon.trackchanges').parent()
			.click();

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		cy.get('#toolbar-hamburger')
			.click()
			.get('.menu-entry-icon.changesmenu').parent()
			.click()
			.get('.menu-entry-icon.trackchanges').parent()
			.should('have.class', 'menu-entry-checked');

		//to close
		cy.get('#toolbar-hamburger')
			.click();
	}

	it('Accept All', function() {
		helper.typeIntoDocument('Hello World');

		enableRecord();

		helper.selectAllText();

		helper.typeIntoDocument('{del}');

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		helper.selectAllText();

		confirmChange('Accept All');

		cy.log('Typing into document - ctrl + a.');
		helper.typeIntoDocument('{ctrl}a');
		cy.log('Typing into document - leftarrow.');
		helper.typeIntoDocument('{leftarrow}');

		helper.textSelectionShouldNotExist();
	});

	it('Reject All',function() {
		helper.typeIntoDocument('Hello World');

		enableRecord();

		helper.selectAllText();

		helper.typeIntoDocument('{del}');

		//if we don't wait , the test will fail in CLI
		cy.wait(400);

		confirmChange('Reject All');

		cy.get('.leaflet-layer').click();

		helper.selectAllText();

		helper.expectTextForClipboard('\nHello World');
	});
});
