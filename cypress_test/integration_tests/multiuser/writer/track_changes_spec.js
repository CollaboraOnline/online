/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Track Changes', function () {
	var testFileName = 'track_changes.odt';

	beforeEach(function () {
		helper.beforeAll(testFileName, 'writer', undefined, true);
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function confirmChange(frameId, action) {
		cy.enter(frameId).then(getBody => {
			getBody().find('#menu-editmenu')
				.click()
				.find('#menu-changesmenu')
				.click()
				.contains(action)
				.click();
		});
	}

	//enable record for track changes
	function enableRecord(frameId) {
		cy.enter(frameId).then(getBody => {
			getBody().find('#menu-editmenu')
				.click()
				.find('#menu-changesmenu')
				.click()
				.contains('Record')
				.click();

			//if we don't wait , the test will fail in CLI
			cy.wait(200);

			getBody().find('#menu-editmenu')
				.click()
				.find('#menu-changesmenu')
				.click()
				.contains('Record')
				.should('have.class', 'lo-menu-item-checked');

			//to close
			getBody().find('#menu-changesmenu')
				.click();
		});
	}

	function acceptAll(frameId1, frameId2) {

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.typeIntoDocument('Hello World', frameId1);

		enableRecord(frameId1);

		cy.wait(1000);

		helper.clearAllText(frameId1);
		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		helper.selectAllText(frameId1);

		confirmChange(frameId2,'Accept All');

		//assert in frame1/frame2 depending on the parameters
		helper.typeIntoDocument('{ctrl}a', frameId1);

		helper.textSelectionShouldNotExist(frameId1);

		//assert in frame2/frame1 depending on the parameters
		helper.typeIntoDocument('{ctrl}a', frameId2);

		helper.textSelectionShouldNotExist(frameId2);
	}

	function rejectAll(frameId1, frameId2) {

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.typeIntoDocument('Hello World', frameId1);

		enableRecord(frameId1);

		cy.wait(1000);

		helper.clearAllText(frameId1);

		cy.wait(400);

		confirmChange(frameId2, 'Reject All');

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.selectAllText(frameId1);

		//assert for user-1/2 depending on parameters
		helper.expectTextForClipboard('\nHello World', frameId1);

		//assert for user-2/1 depending on parameters
		cy.customGet('.leaflet-layer', frameId2).click();

		helper.selectAllText(frameId2);

		helper.expectTextForClipboard('\nHello World', frameId2);
	}


	it('Accept All by user-2', function () {
		acceptAll('#iframe1', '#iframe2');
	});

	it('Accept All by user-1', function () {
		acceptAll('#iframe2', '#iframe1');
	});

	it('Reject All by user-2', function() {
		rejectAll('#iframe1', '#iframe2');
	});

	it('Reject All by user-1', function() {
		rejectAll('#iframe2', '#iframe1');
	});
});
