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

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

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
		// Change font name
		helper.clickOnIdle('#fontnamecombobox');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', 'Linux Libertine G');

		cy.get('.level-1[title="Font Name"] .mobile-wizard.ui-combobox-text.selected')
			.should('have.text', 'Linux Libertine G');

		helper.clickOnIdle('#mobile-wizard-back');

		// Combobox entry contains the selected font name
		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		// Change font size
		helper.clickOnIdle('#fontsizecombobox');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', '14');

		if (helper.getLOVersion() === 'master')
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '14 pt');
		else
			cy.get('.level-1[title="Font Size"] .mobile-wizard.ui-combobox-text.selected')
				.should('have.text', '14');

		helper.clickOnIdle('#mobile-wizard-back');

		// Combobox entry contains the selected font name
		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '14');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'size', '4');
	});

	it('Apply grow.', function() {
		helper.clickOnIdle('#Grow');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'size', '3');
	});

	it('Apply shrink.', function() {
		helper.clickOnIdle('#Shrink');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'size', '1');
	});

	it('Apply font color.', function() {
		helper.clickOnIdle('#Color');

		mobileHelper.selectFromColorPalette(0, 5);

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#00FF00');
	});
});
