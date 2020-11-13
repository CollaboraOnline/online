/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Apply font changes.', function() {
	var testFileName = 'apply_font.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a new selection
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function applyStyle(styleName) {
		// Do a new selection
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#applystyle');

		cy.get('#mobile-wizard-back')
			.should('be.visible');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', styleName);

		// Combobox entry contains the selected font name
		if (styleName !== 'Clear formatting') {
			cy.get('#applystyle .ui-header-right .entry-value')
				.should('have.text', styleName);
		}

		mobileHelper.closeMobileWizard();
	}

	it('Apply font name.', function() {
		helper.clickOnIdle('#fontnamecombobox');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', 'Linux Libertine G');

		cy.get('.level-1[title="Font Name"] .mobile-wizard.ui-combobox-text.selected')
			.should('have.text', 'Linux Libertine G');

		helper.clickOnIdle('#mobile-wizard-back');

		// Combobox entry contains the selected font name
		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		// Change font size
		helper.clickOnIdle('#fontsizecombobox');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', '36');

		if (helper.getLOVersion() === 'master')
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '36 pt');
		else
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '36');

		helper.clickOnIdle('#mobile-wizard-back');

		// Combobox entry contains the selected font name
		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '36');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 36pt');
	});

	it('Apply bold font.', function() {
		helper.clickOnIdle('#Bold');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		helper.clickOnIdle('#Italic');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		helper.clickOnIdle('#Underline');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		helper.clickOnIdle('#Strikeout');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply shadowed.', function() {
		helper.clickOnIdle('#Shadowed');

		writerMobileHelper.selectAllMobile();

		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply grow.', function() {
		helper.clickOnIdle('#Grow');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 42pt');
	});

	it('Apply shrink.', function() {
		helper.clickOnIdle('#Shrink');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 38pt');
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#FontColor');

		mobileHelper.selectFromColorPalette(0, 5, 2);

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#6aa84f');
	});

	it('Apply automatic font color.', function() {
		helper.clickOnIdle('#FontColor');

		mobileHelper.selectFromColorPalette(0, 2);

		mobileHelper.closeMobileWizard();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#ff0000');

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#FontColor');

		helper.clickOnIdle('.colors-container-auto-color-row');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#000000');
	});

	it('Apply highlight color.', function() {
		helper.clickOnIdle('#BackColor');

		mobileHelper.selectFromColorPalette(1, 5, 4);

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #93c47d');
	});

	it('Apply superscript.', function() {
		helper.clickOnIdle('#SuperScript');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p sup')
			.should('exist');
	});

	it('Apply subscript.', function() {
		helper.clickOnIdle('#SubScript');

		writerMobileHelper.selectAllMobile();

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

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');
		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');

		// Clear formatting
		applyStyle('Clear formatting');

		writerMobileHelper.selectAllMobile();

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

