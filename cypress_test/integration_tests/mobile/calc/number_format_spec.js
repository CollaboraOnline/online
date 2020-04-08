/* global describe it cy beforeEach require afterEach Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('./calc_helper');

describe('Apply number formatting.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('number_format.ods', 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		mobileHelper.openMobileWizard();

		// Open character properties
		cy.get('#ScNumberFormatPropertyPanel')
			.click();

		cy.get('#category')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll('number_format.ods');
	});

	function selectFormatting(formattingString) {
		// Select formatting list
		cy.get('#category')
			.click();

		helper.selectItemByContent('.mobile-wizard.ui-combobox-text', formattingString)
			.click();

		// Combobox entry contains the selected format
		cy.get('#category .ui-header-left')
			.should('have.text', formattingString);
	}

	it('Select percent format from list.', function() {
		selectFormatting('Percent');

		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') !== 'master')
			cy.get('#NumberFormatPercentimg')
				.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;0.00%');

		cy.get('#copy-paste-container table td')
			.should('have.text', '100000.00%');
	});

	it('Push percent button.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Change to percent
		cy.get('#NumberFormatPercent')
			.click();

		cy.get('#NumberFormatPercentimg')
			.should('have.class', 'selected');

		// TODO: combobox entry is not updated
		//cy.get('#category .ui-header-left')
		//	.should('have.text', 'Percent');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;0.00%');

		cy.get('#copy-paste-container table td')
			.should('have.text', '100000.00%');
	});

	it('Select currency format from list.', function() {
		selectFormatting('Currency');

		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') !== 'master')
			cy.get('#NumberFormatCurrencyimg')
				.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;[$$-409]#,##0.00;[RED]-[$$-409]#,##0.00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');
	});

	it('Push currency button.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Change to currency
		cy.get('#NumberFormatCurrency')
			.click();

		cy.get('#NumberFormatCurrencyimg')
			.should('have.class', 'selected');

		// TODO: combobox entry is not updated
		//cy.get('#category .ui-header-left')
		//	.should('have.text', 'Currency');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;[$$-409]#,##0.00;[RED]-[$$-409]#,##0.00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');
	});

	it('Push number button.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Change to currency first
		cy.get('#NumberFormatCurrency')
			.click();

		cy.get('#NumberFormatCurrencyimg')
			.should('have.class', 'selected');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;[$$-409]#,##0.00;[RED]-[$$-409]#,##0.00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');

		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		// Open character properties
		cy.get('#ScNumberFormatPropertyPanel')
			.click();

		cy.get('#NumberFormatDecimal')
			.should('be.visible');

		// Change to number formatting
		cy.get('#NumberFormatDecimal')
			.click();

		// TODO: this state is missing here
		//cy.get('#NumberFormatDecimalimg')
		//	.should('have.class', 'selected');

		// TODO: combobox entry is not updated
		//cy.get('#category .ui-header-left')
		//	.should('have.text', 'Number');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.text', '1,000.00');
	});

	it('Select date format from list.', function() {
		// Change to date
		cy.get('#category')
			.click();

		helper.selectItemByContent('.mobile-wizard.ui-combobox-text', 'Date')
			.click();

		// Combobox entry contains the selected format
		cy.get('#category .ui-header-left')
			.should('have.text', 'Date ');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;MM/DD/YY');

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

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;HH:MM:SS AM/PM');

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

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;0.00E+00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1.00E+03');
	});

	it('Select fraction format from list.', function() {
		selectFormatting('Fraction');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '1');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;# ?/?');

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

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;BOOLEAN');

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

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;@');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000');
	});

	it('Change decimal places.', function() {
		// Check default value
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		// Type in a new value
		cy.get('#decimalplaces input')
			.clear()
			.type('2{enter}');

		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '2');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;0.00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000.00');
	});

	it('Change leading zeros.', function() {
		// Check default value
		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '1');

		// Type in a new value
		cy.get('#leadingzeroes input')
			.clear()
			.type('6{enter}');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '6');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;000000');

		cy.get('#copy-paste-container table td')
			.should('have.text', '001000');
	});

	it('Apply red color for negative numbers.', function() {
		// Check default value
		cy.get('#negativenumbersred input')
			.should('not.have.attr', 'checked', 'checked');

		// Change the option
		cy.get('#negativenumbersred input')
			.click();

		cy.get('#negativenumbersred input')
			.should('have.attr', 'checked', 'checked');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;0;[RED]-0');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000');
	});

	it('Add thousands separator.', function() {
		// Check default value
		cy.get('#thousandseparator input')
			.should('not.have.attr', 'checked', 'checked');

		// Change the option
		cy.get('#thousandseparator input')
			.click();

		cy.get('#thousandseparator input')
			.should('have.attr', 'checked', 'checked');

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;#,##0');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1,000');
	});
});
