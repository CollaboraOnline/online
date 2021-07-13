/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe('Apply font changes.', function() {
	var testFileName = 'apply_font.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		writerHelper.selectAllTextOfDoc();

		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function applyStyle(styleName) {
		writerHelper.selectAllTextOfDoc();

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
		mobileHelper.selectListBoxItem('#fontnamecombobox .ui-header', 'Linux Libertine G');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		mobileHelper.selectListBoxItem('#fontsizecombobox', '36');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 36pt');
	});

	it('Apply bold font.', function() {
		helper.clickOnIdle('#Bold');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		helper.clickOnIdle('#Italic');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		helper.clickOnIdle('#Underline');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		helper.clickOnIdle('#Strikeout');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply shadowed.', function() {
		helper.clickOnIdle('#Shadowed');

		writerHelper.selectAllTextOfDoc();

		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#FontColor .ui-header');

		mobileHelper.selectFromColorPalette(0, 5, 5, 2);

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#6aa84f');
	});

	it('Apply automatic font color.', function() {
		helper.clickOnIdle('#FontColor .ui-header');

		mobileHelper.selectFromColorPalette(0, 2);

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#ff0000');

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#FontColor .ui-header');

		helper.clickOnIdle('.colors-container-auto-color-row:visible');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#000000');
	});

	it('Apply highlight color.', function() {
		helper.clickOnIdle('#BackColor .ui-header');

		mobileHelper.selectFromColorPalette(1, 5, 6, 4);

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #93c47d');
	});

	it('Apply superscript.', function() {
		helper.clickOnIdle('#SuperScript');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p sup')
			.should('exist');
	});

	it('Apply subscript.', function() {
		helper.clickOnIdle('#SubScript');

		writerHelper.selectAllTextOfDoc();

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

	it('Apply style.', {retries : 0}, function() {
		mobileHelper.closeMobileWizard();

		// Apply Title style
		applyStyle('Title');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');
		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');

		// Clear formatting
		applyStyle('Clear formatting');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'line-height: 100%; margin-bottom: 0in');
	});

	it.skip('New style and update style items are hidden.', function() {
		cy.get('#applystyle')
			.should('exist');

		cy.get('#StyleUpdateByExample')
			.should('not.exist');

		cy.get('#StyleNewByExample')
			.should('not.exist');
	});
});

