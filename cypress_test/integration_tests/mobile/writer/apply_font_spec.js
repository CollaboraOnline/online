/* global describe it cy beforeEach require afterEach Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Apply font changes.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('apply_font.odt', 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a new selection
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll('apply_font.odt');
	});

	function applyStyle(styleName) {
		// Do a new selection
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Change font name
		cy.get('#applystyle')
			.click();

		cy.get('#mobile-wizard-back')
			.should('be.visible');

		cy.contains('.mobile-wizard.ui-combobox-text', styleName)
			.click();

		// Combobox entry contains the selected font name
		if (styleName !== 'Clear formatting') {
			cy.get('#applystyle .ui-header-right .entry-value')
				.should('have.text', styleName);
		}

		mobileHelper.closeMobileWizard();
	}

	it('Apply font name.', function() {
		// Change font name
		cy.get('#fontnamecombobox')
			.click();

		cy.contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G')
			.click();

		cy.get('.level-1[title="Font Name"] .mobile-wizard.ui-combobox-text.selected')
			.should('have.text', 'Linux Libertine G');

		cy.get('#mobile-wizard-back')
			.click();

		// Combobox entry contains the selected font name
		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		// Change font size
		cy.get('#fontsizecombobox')
			.click();

		cy.contains('.mobile-wizard.ui-combobox-text', '36')
			.click();

		if (Cypress.env('LO_CORE_VERSION') === 'master')
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '36 pt');
		else
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '36');

		cy.get('#mobile-wizard-back')
			.click();

		// Combobox entry contains the selected font name
		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '36');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 36pt');
	});

	it('Apply bold font.', function() {
		// Apply bold
		cy.get('#Bold')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		// Apply italic
		cy.get('#Italic')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		// Change underline
		cy.get('#Underlineimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		// Change strikeout
		cy.get('#Strikeoutimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply shadowed.', function() {
		// Apply shadowed
		cy.get('#Shadowedimg')
			.click();

		writerHelper.copyTextToClipboard();

		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply grow.', function() {
		// Push grow
		cy.get('#Growimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 42pt');
	});

	it('Apply shrink.', function() {
		// Push shrink
		cy.get('#Shrinkimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 38pt');
	});

	it('Apply font color.', function() {
		// Change font color
		cy.get('#FontColor')
			.click();

		cy.get('#color-picker-0-basic-color-5')
			.click();

		cy.get('#color-picker-0-tint-2')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#6aa84f');
	});

	it('Apply highlight color.', function() {
		// Change highlight color
		cy.get('#BackColor')
			.click();

		cy.get('#color-picker-1-basic-color-5')
			.click();

		cy.get('#color-picker-1-tint-4')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #93c47d');
	});

	it('Apply superscript.', function() {
		// Apply superscript
		cy.get('#SuperScriptimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p sup')
			.should('exist');
	});

	it('Apply subscript.', function() {
		// Apply superscript
		cy.get('#SubScriptimg')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p sub')
			.should('exist');
	});

	it('Character spacing item is hidden.', function() {
		// Check that mobile wizard is opened
		cy.get('#SubScript')
			.scrollIntoView()
			.should('be.visible');

		// Character spacing item triggers the character dialog
		// So better to hide it.
		cy.get('#Spacing')
			.should('not.exist');
	});

	it('Apply style.', function() {
		// Apply Title style
		applyStyle('Title');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');
		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');

		// Clear formatting
		applyStyle('Clear formatting');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'margin-bottom: 0in; line-height: 100%');
	});

	it('New style and update style items are hidden.', function() {
		cy.get('#applystyle')
			.should('exist');

		cy.get('#StyleUpdateByExample')
			.should('not.exist');

		cy.get('#StyleNewByExample')
			.should('not.exist');
	});
});

