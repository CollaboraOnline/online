/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font changes.', function() {
	var origTestFileName = 'apply_font.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		mobileHelper.enableEditingMobile();
		writerHelper.selectAllTextOfDoc();
		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply font name.', function() {
		cy.cGet('#fontnamecombobox').click();
		cy.cGet('#font').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p font').should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '36 pt').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p font').should('have.attr', 'style', 'font-size: 36pt');
	});

	it('Apply bold font.', function() {
		helper.clickOnIdle('#Bold');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p b').should('exist');
	});

	it('Apply italic font.', function() {
		helper.clickOnIdle('#Italic');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p i').should('exist');
	});

	it('Apply underline.', function() {
		helper.clickOnIdle('#Underline');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p u').should('exist');
	});

	it('Apply strikeout.', function() {
		helper.clickOnIdle('#Strikeout');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p strike').should('exist');
	});

	it('Apply shadowed.', function() {
		helper.clickOnIdle('#Shadowed');
		writerHelper.selectAllTextOfDoc();
		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#FontColor .ui-header');
		cy.cGet('[id$=-basic-color-5]').then(items => { items[0].click(); });
		//mobileHelper.selectFromColorPalette(0, 5, 5, 2);
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p font').should('have.attr', 'color', '#6aa84f');
	});

	it('Apply automatic font color.', function() {
		helper.clickOnIdle('#FontColor .ui-header');
		cy.cGet('[id$=-basic-color-2]').then(items => { items[0].click(); });
		mobileHelper.closeMobileWizard();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p font').should('have.attr', 'color', '#ff0000');
		mobileHelper.openMobileWizard();
		helper.clickOnIdle('#FontColor .ui-header');
		helper.clickOnIdle('.colors-container-auto-color-row:visible');
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p font').should('have.attr', 'color', '#000000');
	});

	it('Apply highlight color.', function() {
		helper.clickOnIdle('#BackColor .ui-header');
		cy.cGet('[id$=-basic-color-2]').then(items => { items[0].click(); });
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p font span').should('have.attr', 'style', 'background: #93c47d');
	});

	it('Apply superscript.', function() {
		helper.clickOnIdle('#SuperScript');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p sup').should('exist');
	});

	it('Apply subscript.', function() {
		helper.clickOnIdle('#SubScript');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p sub').should('exist');
	});

	it('Character spacing item is hidden.', function() {
		// Check that mobile wizard is opened
		cy.cGet('#SubScript').scrollIntoView().should('be.visible');
		// Character spacing item triggers the character dialog
		// So better to hide it.
		cy.cGet('#Spacing').should('not.exist');
	});

	it('Apply style.', {retries : 0}, function() {
		cy.cGet('#applystyle').click();
		cy.cGet('body').contains('#fontstyletoolbox', 'Title').click();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p font').should('have.attr', 'face', 'Liberation Sans, sans-serif');
		//cy.cGet('#copy-paste-container p font font').should('have.attr', 'style', 'font-size: 28pt');
		// Clear formatting
		mobileHelper.openMobileWizard();
		cy.cGet('#applystyle').click();
		cy.cGet('body').contains('#fontstyletoolbox', 'Clear formatting').click();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p').should('have.attr', 'style', 'line-height: 100%; margin-bottom: 0in');
	});

	it.skip('New style and update style items are hidden.', function() {
		cy.cGet('#applystyle').should('exist');
		cy.cGet('#StyleUpdateByExample').should('not.exist');
		cy.cGet('#StyleNewByExample').should('not.exist');
	});
});

