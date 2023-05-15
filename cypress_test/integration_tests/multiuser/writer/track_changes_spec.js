/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe.skip(['tagmultiuser'], 'Track Changes', function () {
	var origTestFileName = 'track_changes.odt';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function confirmChange(action) {
		cy.cGet('body').find('#menu-editmenu')
				.click()
				.find('#menu-changesmenu')
				.click()
				.contains(action)
				.click();
	}

	//enable record for track changes
	function enableRecord() {
		cy.cGet('body').find('#menu-editmenu')
			.click()
			.find('#menu-changesmenu')
			.click()
			.contains('Record')
			.click();

		//if we don't wait , the test will fail in CLI
		cy.wait(200);

		cy.cGet('body').find('#menu-editmenu')
			.click()
			.find('#menu-changesmenu')
			.click()
			.contains('Record')
			.should('have.class', 'lo-menu-item-checked');

		//to close
		cy.cGet('body').find('#menu-changesmenu').click();
	}

	function acceptAll(frameId1, frameId2) {
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click();
		helper.typeIntoDocument('Hello World');
		enableRecord();
		cy.wait(1000);
		helper.clearAllText();
		//if we don't wait , the test will fail in CLI
		cy.wait(200);
		helper.selectAllText();

		cy.cSetActiveFrame(frameId2);
		confirmChange('Accept All');

		//assert in frame1/frame2 depending on the parameters
		cy.cSetActiveFrame(frameId1);
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();

		//assert in frame2/frame1 depending on the parameters
		cy.cSetActiveFrame(frameId2);
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	}

	function rejectAll(frameId1, frameId2) {
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click();
		helper.typeIntoDocument('Hello World');
		enableRecord();
		cy.wait(1000);
		helper.clearAllText();
		cy.wait(400);

		cy.cSetActiveFrame(frameId2);
		confirmChange('Reject All');

		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click();
		helper.selectAllText();
		//assert for user-1/2 depending on parameters
		helper.expectTextForClipboard('Hello World');

		//assert for user-2/1 depending on parameters
		cy.cSetActiveFrame(frameId2);
		cy.cGet('.leaflet-layer').click();
		helper.selectAllText();
		helper.expectTextForClipboard('Hello World');
	}

	it('Accept All by user-2', function () {
		acceptAll('#iframe1', '#iframe2');
	});

	it('Accept All by user-1', function () {
		acceptAll('#iframe2', '#iframe1');
	});

	it.skip('Reject All by user-2', function() {
		rejectAll('#iframe1', '#iframe2');
	});

	it.skip('Reject All by user-1', function() {
		rejectAll('#iframe2', '#iframe1');
	});
});
