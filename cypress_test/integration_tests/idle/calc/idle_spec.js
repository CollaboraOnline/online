/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Idle', function() {
	var origTestFileName = 'idle.ods';
	var testFileName;
	var dimDialogSelector = '#modal-dialog-inactive_user_message-overlay';

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function checkIfIsInteractiveAgain() {
		calcHelper.dblClickOnFirstCell();

		const content = 'New content';
		helper.typeIntoDocument(content + '{enter}');

		calcHelper.selectEntireSheet();

		helper.waitUntilIdle('#copy-paste-container tbody');

		calcHelper.assertDataClipboardTable(['C' + content + 'ypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	}

	it('Check idle out of focus', function() {
		cy.getFrameWindow()
			.its('L')
			.then(function(L) {
				L.Map.THIS._onLostFocus();
			});

		cy.cGet(dimDialogSelector, { timeout: 1000 }).should('not.exist');
		cy.wait(1100); // out of focus timeout is 1s
		cy.cGet(dimDialogSelector, { timeout: 1000 }).should('exist');

		checkIfIsInteractiveAgain();
	});

	it('Check idle after inactivity', function() {
		cy.cGet(dimDialogSelector).should('not.exist');
		cy.wait(7100); // inactivity timeout is 7s
		cy.cGet(dimDialogSelector).should('exist');

		checkIfIsInteractiveAgain();
	});

	it('Check interactivity of document after dialog close', function() {
		// Check if sidebar-dock-wrapper is visible
		cy.cGet('#sidebar-dock-wrapper').should('be.visible').then(($sidebar) => {
			// If it's not visible, click on SidebarDeck.PropertyDeck to make it visible
			if (!$sidebar.is(':visible')) {
				cy.cGet('#SidebarDeck.PropertyDeck').click();
			}
		});
		cy.cGet('div.sidebar#Underline > .arrowbackground').click();
		cy.cGet('.jsdialog-window.modalpopup').should('exist');
		cy.cGet(dimDialogSelector).should('not.exist');
		cy.wait(7100); // inactivity timeout is 7s
		cy.cGet(dimDialogSelector).should('exist');

		// check if cell is editable or not after document again become active
		checkIfIsInteractiveAgain();

		// Make sure the sidebar dropdown is closed after document again become interactive
		cy.cGet('.jsdialog-window.modalpopup').should('not.exist');
	});
});
