/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');

describe('Apply font changes.', function() {
	var testFileName = 'apply_font.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply font name', function() {
		writerHelper.selectAllTextOfDoc();

		cy.get('#tb_editbar_item_fonts').click();

		cy.contains('.select2-results__option','Linux Libertine G')
			.click();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Linux Libertine G, sans-serif');
	});

	it('Apply font size.', function() {
		writerHelper.selectAllTextOfDoc();
		cy.get('#tb_editbar_item_fontsizes').click();

		cy.contains('.select2-results__option','36')
			.click();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 36pt');
	});

	it('Apply bold font', function() {
		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_bold');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_italic');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_underline');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_strikeout');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#tb_editbar_item_fontcolor');

		writerHelper.selectAllTextOfDoc();

		cy.get('.color[name="FF011B"]')
			.click();

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#ff011b');
	});

	it('Apply highlight color.', function() {
		helper.clickOnIdle('#tb_editbar_item_backcolor');

		writerHelper.selectAllTextOfDoc();

		cy.get('.color[name="FF011B"]')
			.click();

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #ff011b');
	});

	it('Apply Style', function() {
		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'margin-bottom: 0in; font-style: normal; font-weight: normal; line-height: 100%');

		cy.get('#tb_editbar_item_styles').click();

		cy.contains('.select2-results__option','Title')
			.click();

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Liberation Sans, sans-serif');

		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Apply superscript.', function() {
		writerHelper.selectAllTextOfDoc();

		helper.typeIntoDocument('{ctrl}{shift}p');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p sup')
			.should('exist');
	});

	it('Apply subscript.', function() {
		writerHelper.selectAllTextOfDoc();

		helper.typeIntoDocument('{ctrl}{shift}b');

		cy.get('.leaflet-layer').click('center');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p sub')
			.should('exist');
	});
});
