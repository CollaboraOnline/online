/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Sheet Operation', function () {
	var origTestFileName = 'sheet_operation.ods';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertNumberofSheets(n) {
		cy.cGet('button.spreadsheet-tab').should('have.length', n);
	}

	function selectOptionMobileWizard(menu) {
		var eventOptions = {
			force: true,
			button: 0,
			pointerType: 'mouse'
		};

		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected')
			.trigger('pointerdown', eventOptions)
			.wait(1000);

		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', menu)
			.click();
	}

	it('Insert sheet', function () {
		assertNumberofSheets(1);

		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);
	});

	it('Insert sheet before', function () {
		assertNumberofSheets(1);

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		selectOptionMobileWizard('Insert sheet before this');

		assertNumberofSheets(2);

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');

		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet1');
	});

	it('Insert sheet after', function () {
		assertNumberofSheets(1);

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		selectOptionMobileWizard('Insert sheet after this');

		assertNumberofSheets(2);

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet2');
	});

	it('Delete sheet', function () {
		assertNumberofSheets(1);

		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		selectOptionMobileWizard('Delete Sheet...');

		cy.cGet('#delete-sheet-modal-response').click();

		assertNumberofSheets(1);
	});

	it('Rename sheet', function () {
		assertNumberofSheets(1);

		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'Sheet1');

		selectOptionMobileWizard('Rename Sheet...');

		cy.cGet('#mobile-wizard-content-modal-dialog-rename-calc-sheet').should('exist');
		cy.cGet('#input-modal-input').clear().type('renameSheet');
		cy.cGet('#response-ok').click();
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'renameSheet');
	});

	it('Hide/Show sheet', function () {
		assertNumberofSheets(1);

		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		//hide sheet
		selectOptionMobileWizard('Hide Sheet');

		assertNumberofSheets(1);

		//show sheet
		selectOptionMobileWizard('Show Sheet');

		cy.cGet('#mobile-wizard-content-modal-dialog-show-sheets-modal').should('exist');
		cy.cGet('#hidden-part-checkbox-1').check();
		cy.cGet('#show-sheets-modal-response').click();

		assertNumberofSheets(2);
	});

	it('Move sheet left/right', function () {
		assertNumberofSheets(1);

		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		//left
		selectOptionMobileWizard('Move Sheet Left');

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');

		//right
		selectOptionMobileWizard('Move Sheet Right');

		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
	});
});
