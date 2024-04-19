/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font changes.', function() {
	var origTestFileName = 'apply_font.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		// Open character properties
		mobileHelper.openTextPropertiesPanel();
	});

	it('Apply bold.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#Bold').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td b').should('exist');
	});

	it('Apply italic.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#Italic').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td i').should('exist');
	});

	it('Apply underline.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#Underline').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#Strikeout').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td s')
			.should('exist');
	});

	it('Apply shadowed.', function() {
		cy.cGet('#Shadowed').click();

		calcHelper.selectEntireSheet();

		// TODO: Shadowed is not in the clipboard content.
	});

	it('Apply font name.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#TextPropertyPanel').click();
		cy.cGet('#fontnamecombobox').click();
		cy.cGet('#fontnamecombobox').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});

	it('Apply font size.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#TextPropertyPanel').click();
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '14 pt').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td font')
			.should('have.attr', 'size', '4');
	});

	it('Apply font color.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#Color .ui-header').click();

		mobileHelper.selectFromColorPicker('#Color', 5);

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td font')
			.should('have.attr', 'color', '#00FF00');
	});
});
