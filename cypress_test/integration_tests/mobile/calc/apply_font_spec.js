/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Apply font changes.', function() {
	var testFileName = 'apply_font.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		// Open character properties
		mobileHelper.openTextPropertiesPanel();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply bold.', function() {
		helper.clickOnIdle('#Bold');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Apply italic.', function() {
		helper.clickOnIdle('#Italic');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td i')
			.should('exist');
	});

	it('Apply underline.', function() {
		helper.clickOnIdle('#Underline');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		helper.clickOnIdle('#Strikeout');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td s')
			.should('exist');
	});

	it('Apply shadowed.', function() {
		helper.clickOnIdle('#Shadowed');

		calcHelper.selectEntireSheet();

		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply font name.', function() {
		mobileHelper.selectListBoxItem('#fontnamecombobox', 'Linux Libertine G');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		mobileHelper.selectListBoxItem('#fontsizecombobox', '14');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'size', '4');
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#Color .ui-header');

		mobileHelper.selectFromColorPalette(2, 5);

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#00FF00');
	});
});
