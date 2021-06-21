/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Apply font changes.', function() {
	var testFileName = 'apply_font.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.clickOnFirstCell();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply font name',function() {

		cy.get('#tb_editbar_item_fonts').click();

		cy.contains('.select2-results__option','Linux Libertine G')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		cy.get('#tb_editbar_item_fontsizes').click();

		cy.contains('.select2-results__option','14')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'size', '4');
	});

	it('Apply bold font', function() {
		helper.clickOnIdle('#tb_editbar_item_bold');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		helper.clickOnIdle('#tb_editbar_item_italic');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td i')
			.should('exist');
	});

	it('Apply underline.', function() {
		helper.clickOnIdle('#tb_editbar_item_underline');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		helper.clickOnIdle('#tb_editbar_item_strikeout');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td s')
			.should('exist');
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#tb_editbar_item_fontcolor');

		cy.get('.color[name="FF011B"]')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#FF011B');
	});

	it('Apply highlight color', function() {
		helper.clickOnIdle('#tb_editbar_item_backgroundcolor');

		cy.get('.color[name="FF011B"]')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#FF011B');
	});
});
