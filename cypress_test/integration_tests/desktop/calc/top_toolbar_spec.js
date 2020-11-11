/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.clickOnFirstCell();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});
	
	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply italic.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td i')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td s')
			.should('exist');
	});
	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backgroundcolor')
			.click();

		cy.get('.w2ui-color [name="8E7CC3"]')
			.click();
		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#8E7CC3');
	});

	it('Apply font color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		cy.get('.w2ui-color [name="FFF2CC"]')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#FFF2CC');
	});

	it('Apply left/right alignment', function() {
		// Set right aligment first
		cy.get('#tb_editbar_item_textalign .w2ui-tb-down')
			.click();

		cy.contains('.menu-text', 'Align Right')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		cy.get('#tb_editbar_item_textalign .w2ui-tb-down')
			.click();

		cy.contains('.menu-text', 'Align Left')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});
});
