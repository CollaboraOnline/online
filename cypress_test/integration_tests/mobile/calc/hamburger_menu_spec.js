/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');
var calcMobileHelper = require('./calc_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = 'hamburger_menu.ods';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Save', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'Save')
			.click();

		// TODO: we have no visual indicator of save was done
		// So just trigger saving to catch any exception / console error
		cy.wait(500);
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'Print')
			.click();

		cy.window().its('open').should('be.called');
	});

	it('Download as PDF', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'PDF Document (.pdf)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.pdf');
	});

	it('Download as ODS', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'ODF spreadsheet (.ods)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.ods');
	});

	it('Download as XLS', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'Excel 2003 Spreadsheet (.xls)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.xls');
	});

	it('Download as XLSX', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'Excel Spreadsheet (.xlsx)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.xlsx');
	});

	it('Undo/redo.', function() {
		// Type a new character
		calcHelper.clickOnFirstCell(true, true);

		cy.get('textarea.clipboard')
			.type('{q}');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('contain.text', 'q');

		// Undo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Undo')
			.click();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('not.contain.text', 'q');

		// Redo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Redo')
			.click();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('contain.text', 'q');
	});

	it('Repair.', function() {
		// Type a new character
		calcHelper.clickOnFirstCell(true, true);
		cy.get('textarea.clipboard')
			.type('{q}');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('contain.text', 'q');

		// Revert one undo step via Repair
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Repair')
			.click();

		cy.get('.leaflet-popup-content')
			.should('be.visible');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.should('contain.text', 'Undo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.click();

		cy.get('.leaflet-popup-content input[value=\'Jump to state\']')
			.click();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('not.contain.text', 'q');
	});

	it('Cut.', function() {
		calcMobileHelper.selectAllMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Cut')
			.click();

		// TODO: cypress does not support clipboard operations
		// so we get a warning dialog here.
		cy.get('.vex-dialog-form')
			.should('be.visible');

		cy.get('.vex-dialog-message')
			.should('have.text', 'Please use the copy/paste buttons on your on-screen keyboard.');

		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();

		cy.get('.vex-dialog-form')
			.should('not.be.visible');
	});

	it('Copy.', function() {
		calcMobileHelper.selectAllMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Copy')
			.click();

		// TODO: cypress does not support clipboard operations
		// so we get a warning dialog here.
		cy.get('.vex-dialog-form')
			.should('be.visible');

		cy.get('.vex-dialog-message')
			.should('have.text', 'Please use the copy/paste buttons on your on-screen keyboard.');

		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();

		cy.get('.vex-dialog-form')
			.should('not.be.visible');
	});

	it('Paste.', function() {
		calcMobileHelper.selectAllMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Paste')
			.click();

		// TODO: cypress does not support clipboard operations
		// so we get a warning dialog here.
		cy.get('.vex-dialog-form')
			.should('be.visible');

		cy.get('.vex-dialog-message')
			.should('have.text', 'Please use the copy/paste buttons on your on-screen keyboard.');

		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();

		cy.get('.vex-dialog-form')
			.should('not.be.visible');
	});

	it('Select all.', function() {
		cy.get('#copy-paste-container table td')
			.should('not.contain.text', 'Text');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Select All')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		cy.get('#copy-paste-container table td')
			.should('contain.text', 'Text');
	});
});
