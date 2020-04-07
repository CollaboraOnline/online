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

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Toolbar button is checked
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is closed
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('not.have.class', 'checked');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');
	});

	it('Close mobile wizard by hamburger menu.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Open hamburger menu
		mobileHelper.pushHamburgerMenuIconMobile();
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('About');

		// Close hamburger menu
		mobileHelper.pushHamburgerMenuIconMobile();
		// Mobile wizard is closed
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');
	});

	it('Close mobile wizard by context wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#Character');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Open context wizard by right click on document
		mobileHelper.longPressOnDocument(40, 40);
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('Paste');

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

