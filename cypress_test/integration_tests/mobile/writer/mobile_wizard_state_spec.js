/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Mobile wizard state tests', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('mobile_wizard_state.odt', 'writer');
	});

	afterEach(function() {
		helper.afterAll('mobile_wizard_state.odt');
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

		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon', 'About')
			.should('be.visible');

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

		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon', 'Paste')
			.should('be.visible');

		// TODO: fix this bug
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('not.have.class', 'checked');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// TODO: fix this bug
		//cy.get('#mobile-wizard-content')
		//	.should('not.be.empty');
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('have.class', 'checked');
	});
});

