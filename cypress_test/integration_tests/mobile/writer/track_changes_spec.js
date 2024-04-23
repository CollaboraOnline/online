/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Track Changes', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/track_changes.odt');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	function confirmChange(action) {
		cy.cGet('#toolbar-hamburger').click();
		cy.cGet('.menu-entry-icon.changesmenu').parent().click();
		if (action === 'Accept All') {
			cy.cGet('.menu-entry-icon.acceptalltrackedchanges').click();
		} else if (action === 'Reject All') {
			cy.cGet('.menu-entry-icon.rejectalltrackedchanges').click();
		}
	}
	//enable record for track changes
	function enableRecord() {
		cy.cGet('#toolbar-hamburger').click();
		cy.cGet('.menu-entry-icon.changesmenu').parent().click();
		cy.cGet('.menu-entry-icon.trackchanges').parent().click();

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		cy.cGet('#toolbar-hamburger').click();
		cy.cGet('.menu-entry-icon.changesmenu').parent().click();
		cy.cGet('.menu-entry-icon.trackchanges').parent().should('have.class', 'menu-entry-checked');

		//to close
		cy.cGet('#toolbar-hamburger').click();
	}

	it('Accept All', function() {
		helper.typeIntoDocument('Hello World');
		cy.wait(1000);
		enableRecord();
		helper.selectAllText();
		helper.typeIntoDocument('{del}');
		//if we don't wait, the test will fail in CI
		cy.wait(200);
		helper.selectAllText();
		confirmChange('Accept All');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Reject All',function() {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('Hello World');
		cy.wait(1000);
		enableRecord();
		helper.selectAllText();
		helper.typeIntoDocument('{del}');
		//if we don't wait , the test will fail in CLI
		cy.wait(400);
		confirmChange('Reject All');
		cy.cGet('.leaflet-layer').click();
		helper.selectAllText();
		helper.copy();
		helper.expectTextForClipboard('Hello World');
	});
});
