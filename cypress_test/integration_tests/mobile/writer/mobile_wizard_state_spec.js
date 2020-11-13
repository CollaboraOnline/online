/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Mobile wizard state tests', function() {
	var testFileName = 'mobile_wizard_state.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
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

	it.skip('Check level visibility in hamburger menu.', function() {
		helper.initAliasToNegative('originalHeight');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openHamburgerMenu();

		// Get mobile wizard last item vertical pos.
		cy.contains('.ui-header.level-0.mobile-wizard', 'About')
			.invoke('offset')
			.its('top')
			.as('originalTop');

		cy.get('@originalTop')
			.should('be.greaterThan', 0);

		// Step in and step out the File submenu.
		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'Print')
			.should('be.visible');

		cy.get('#mobile-wizard-back')
			.click();

		cy.contains('.menu-entry-with-icon', 'File')
			.should('be.visible');

		cy.get('@originalTop')
			.then(function(originalTop) {
				cy.contains('.ui-header.level-0.mobile-wizard', 'About')
					.should(function(content) {
						expect(content.offset().top).to.be.lessThan(originalTop + 0.0001);
						expect(content.offset().top).to.be.greaterThan(originalTop - 0.0001);
					});
			});
	});
});

