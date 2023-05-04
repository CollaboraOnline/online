/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Track Changes', function () {
	var origTestFileName = 'track_changes.odt';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function confirmChange(action) {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains(action).click();
	}

	//enable record for track changes
	function enableRecord() {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Record').click();

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Record').should('have.class', 'lo-menu-item-checked');

		//to close
		cy.cGet('#menu-changesmenu').click();
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

		cy.cGet('.leaflet-layer').click();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});
});
