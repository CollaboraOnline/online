/* global describe it cy beforeEach require afterEach Cypress*/

var helper = require('../../common/helper');
var calcHelper = require('./calc_helper');

describe('Apply number formatting.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('number_format.ods', 'calc');

		// Click on edit button
		helper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Open character properties
		cy.get('#ScNumberFormatPropertyPanel')
			.click();

		cy.get('#category')
			.should('be.visible')
			.wait(100);
	});

	afterEach(function() {
		helper.afterAll('number_format.ods');
	});

	function selectFormatting(formattingString) {
		// Select formatting list
		cy.get('#category')
			.click();

		cy.get('.mobile-wizard.ui-combobox-text')
			.contains(formattingString)
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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;[$$-409]#,##0.00;[RED]-[$$-409]#,##0.00');

		cy.get('#copy-paste-container table td')
			.should('have.text', '$1,000.00');

		calcHelper.clickOnFirstCell();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Open character properties
		cy.get('#ScNumberFormatPropertyPanel')
			.click();

		cy.get('#NumberFormatDecimal')
			.should('be.visible')
			.wait(100);

		// Change to number formatting
		cy.get('#NumberFormatDecimal')
			.click();

		// TODO: this state is missing here
		//cy.get('#NumberFormatDecimalimg')
		//	.should('have.class', 'selected');

		// TODO: combobox entry is not updated
		//cy.get('#category .ui-header-left')
		//	.should('have.text', 'Number');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.text', '1,000.00');
	});

	it('Select date format from list.', function() {
		// Change to date
		cy.get('#category')
			.click();

		cy.get('.mobile-wizard.ui-combobox-text')
			.contains('Date')
			.click();

		// Combobox entry contains the selected format
		cy.get('#category .ui-header-left')
			.should('have.text', 'Date ');

		// Decimal and leading zeros are changed.
		cy.get('#decimalplaces input')
			.should('have.attr', 'value', '0');

		cy.get('#leadingzeroes input')
			.should('have.attr', 'value', '0');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum', '1033;0;@');

		cy.get('#copy-paste-container table td')
			.should('have.text', '1000');
	});
});