/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Apply/modify styles.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('simple.odt', 'writer');

		// Click on edit button
		cy.get('#mobile-edit-button').click();
	});

	afterEach(function() {
		helper.afterAll();
	});

	function applyStyle(styleName) {
		// Do a new selection
		helper.selectAllMobile();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Change font name
		cy.get('#applystyle')
			.click();

		cy.wait(200);

		cy.get('#mobile-wizard-back')
			.should('be.visible');

		cy.get('.mobile-wizard.ui-combobox-text')
			.contains(styleName)
			.scrollIntoView();

		cy.wait(200);

		cy.get('.mobile-wizard.ui-combobox-text')
			.contains(styleName)
			.click();

		// Combobox entry contains the selected font name
		if (styleName !== 'Clear formatting') {
			cy.get('#applystyle .ui-header-right .entry-value')
				.contains(styleName);
		}

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
	}

	it('Apply new style.', function() {
		// Apply Title style
		applyStyle('Title');

		helper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');
		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Clear style.', function() {
		// Apply Title style
		applyStyle('Title');

		helper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');
		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');

		// Clear formatting
		applyStyle('Clear formatting');

		helper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'margin-bottom: 0in; line-height: 100%');
	});

	it('New style item is hidden.', function() {
		// New style item opens a tunneled dialog
		// what we try to avoid.

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		cy.get('#StyleUpdateByExample')
			.should('not.exist');

		cy.get('#StyleNewByExample')
			.should('not.exist');
	});
});
