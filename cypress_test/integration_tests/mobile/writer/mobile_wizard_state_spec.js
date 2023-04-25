/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Mobile wizard state tests', function() {
	var origTestFileName = 'mobile_wizard_state.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Open and close mobile wizard by toolbar item.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openMobileWizard();
		// Close mobile wizard
		mobileHelper.closeMobileWizard();
		// Open mobile wizard again
		mobileHelper.openMobileWizard();
	});

	it('Close mobile wizard by hamburger menu.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openMobileWizard();
		// Open hamburger menu
		mobileHelper.openHamburgerMenu();
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon', 'Track Changes').should('be.visible');
		// Close hamburger menu
		mobileHelper.closeHamburgerMenu();
		// Open mobile wizard again
		mobileHelper.openMobileWizard();
	});

	it('Close mobile wizard by context wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openMobileWizard();
		// Open context wizard by right click on document
		mobileHelper.longPressOnDocument(40, 40);
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon', 'Paste').should('be.visible');

		// TODO: fix this bug
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('not.have.class', 'checked');

		// Open mobile wizard again
		cy.cGet('#tb_actionbar_item_mobile_wizard').click();

		// TODO: fix this bug
		//cy.get('#mobile-wizard-content')
		//	.should('not.be.empty');
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('have.class', 'checked');
	});
});

