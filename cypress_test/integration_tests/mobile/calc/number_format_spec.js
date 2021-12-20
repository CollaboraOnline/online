/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Apply number formatting.', function() {
	var testFileName = 'number_format.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScNumberFormatPropertyPanel');

		cy.get('#numberformatcombobox > .ui-header')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectFormatting(formattingString) {
		// Select formatting list
		mobileHelper.selectListBoxItem2('#numberformatcombobox > .ui-header', formattingString);
	}

	it('Select percent format from list.', function() {
		selectFormatting('Percent');

		cy.get('.unoNumberFormatPercent img')
			.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;0.00%$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '100000.00%');
	});

	it('Push percent button.', function() {
		helper.clickOnIdle('#NumberFormatPercent');

		cy.get('.unoNumberFormatPercent img')
			.should('have.class', 'selected');

		cy.get('#numberformatcombobox .ui-header-left')
			.should('have.text', 'Percent');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;0.00%$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '100000.00%');
	});

	it('Select currency format from list.', function() {
		selectFormatting('Currency');

		cy.get('.unoNumberFormatCurrency img')
			.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';\\[\\$\\$-409]#,##0.00;\\[RED]-\\[\\$\\$-409]#,##0.00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');
	});

	it('Push currency button.', function() {
		helper.clickOnIdle('#NumberFormatCurrency');

		cy.get('.unoNumberFormatCurrency img')
			.should('have.class', 'selected');

		cy.get('#numberformatcombobox .ui-header-left')
			.should('have.text', 'Currency');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';\\[\\$\\$-409]#,##0.00;\\[RED]-\\[\\$\\$-409]#,##0.00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');
	});

	it('Push number button.', function() {
		// Change to currency first
		helper.clickOnIdle('#NumberFormatCurrency');

		cy.get('.unoNumberFormatCurrency img')
			.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';\\[\\$\\$-409]#,##0.00;\\[RED]-\\[\\$\\$-409]#,##0.00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');

		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScNumberFormatPropertyPanel');

		cy.get('.unoNumberFormatDecimal')
			.should('be.visible');

		// Change to number formatting
		helper.clickOnIdle('.unoNumberFormatDecimal');

		cy.get('.unoNumberFormatDecimal img')
			.should('have.class', 'selected');

		cy.get('#numberformatcombobox .ui-header-left')
			.should('have.text', 'Number');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.text', '1,000.00');
	});

	it('Select date format from list.', function() {
		helper.clickOnIdle('#numberformatcombobox > .ui-header');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', 'Date');

		// Combobox entry contains the selected format
		cy.get('#numberformatcombobox .ui-header-left')
			.should('have.text', 'Date ');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';MM/DD/YY$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdval', '1000');

		cy.get('#copy-paste-container table td')
			.should('have.text', '09/26/02');
	});

	it('Select time format from list.', function() {
		selectFormatting('Time');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';HH:MM:SS AM/PM$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdval', '1000');

		cy.get('#copy-paste-container table td')
			.should('have.text', '12:00:00 AM');
	});

	it('Select scientific format from list.', function() {
		selectFormatting('Scientific');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0\\.00E\\+00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1.00E+03');
	});

	it.skip('Select fraction format from list.', function() {
		selectFormatting('Fraction');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '1');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';# \\?/\\?$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000    ');
	});

	it('Select boolean format from list.', function() {
		selectFormatting('Boolean Value');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';BOOLEAN$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', 'TRUE');
	});

	it('Select text format from list.', function() {
		selectFormatting('Text');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';@$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000');
	});

	it('Change decimal places.', function() {
		// Check default value
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		// Type in a new value
		helper.typeIntoInputField('#decimalplaces input', '2', true, false);

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0\\.00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000.00');
	});

	it('Change leading zeros.', function() {
		// Check default value
		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		// Type in a new value
		helper.typeIntoInputField('#leadingzeroes input', '6', true, false);

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';000000$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '001000');
	});

	it('Apply red color for negative numbers.', function() {
		// Check default value
		cy.get('#negativenumbersred input')
			.should('not.have.prop', 'checked', true);

		// Change the option
		helper.clickOnIdle('#negativenumbersred input');

		cy.get('#negativenumbersred input')
			.should('have.prop', 'checked', true);

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;\\[RED]-0$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000');
	});

	it('Add thousands separator.', function() {
		// Check default value
		cy.get('#thousandseparator input')
			.should('not.have.prop', 'checked', true);

		// Change the option
		helper.clickOnIdle('#thousandseparator input');

		cy.get('#thousandseparator input')
			.should('have.prop', 'checked', true);

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';#,##0$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		cy.get('#copy-paste-container table td')
			.should('have.text', '1,000');
	});
});
