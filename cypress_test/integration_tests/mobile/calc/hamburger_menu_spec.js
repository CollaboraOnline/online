/* global describe it cy require afterEach expect */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');
var calcMobileHelper = require('./calc_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		mobileHelper.beforeAllMobile(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Save', function() {
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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
		before('hamburger_menu.ods');

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

	it('Search some word.', function() {
		before('hamburger_menu_search.ods');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Search')
			.click();

		// Search bar become visible
		cy.get('#toolbar-search')
			.should('be.visible');

		// Search for some word
		cy.get('#search-input')
			.type('a');

		cy.get('.w2ui-tb-image.w2ui-icon.next')
			.click();

		// First cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		// Go for the second match
		cy.get('.w2ui-tb-image.w2ui-icon.next')
			.click();

		//Second cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1');

		// Go back to the first match
		cy.get('.w2ui-tb-image.w2ui-icon.prev')
			.click();

		// First cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		// Remove search word
		cy.get('#search-input')
			.should('have.prop', 'value', 'a');

		cy.get('#tb_searchbar_item_cancelsearch')
			.click();

		cy.get('#search-input')
			.should('have.prop', 'value', '');

		// Close search toolbar
		cy.get('.w2ui-tb-image.w2ui-icon.unfold')
			.click();

		cy.get('#toolbar-search')
			.should('not.be.visible');
	});

	it('Data: sort ascending.', function() {
		before('hamburger_menu_sort.ods');

		// Sort the first column's data
		calcMobileHelper.selectFirstColumn();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Sort Ascending')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 4);

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				expect(cells[0]).to.have.text('1');
				expect(cells[1]).to.have.text('2');
				expect(cells[2]).to.have.text('3');
				expect(cells[3]).to.have.text('4');
			});
	});

	it('Data: sort descending.', function() {
		before('hamburger_menu_sort.ods');

		// Sort the first column's data
		calcMobileHelper.selectFirstColumn();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Sort Descending')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 4);

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				expect(cells[0]).to.have.text('4');
				expect(cells[1]).to.have.text('3');
				expect(cells[2]).to.have.text('2');
				expect(cells[3]).to.have.text('1');
			});
	});

	it('Check version information.', function() {
		before('hamburger_menu.ods');

		mobileHelper.openHamburgerMenu();

		// Open about dialog
		cy.contains('.menu-entry-with-icon', 'About')
			.click();

		cy.get('.vex-content')
			.should('exist');

		// Check the version
		if (helper.getLOVersion() === 'master') {
			cy.contains('#lokit-version', 'LibreOffice')
				.should('exist');
		} else if (helper.getLOVersion() === 'cp-6-2' ||
				   helper.getLOVersion() === 'cp-6-4')
		{
			cy.contains('#lokit-version', 'Collabora Office')
				.should('exist');
		}

		// Close about dialog
		cy.get('.vex-close')
			.click({force : true});

		cy.get('.vex-content')
			.should('not.exist');
	});
});
