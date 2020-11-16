/* global describe it cy require afterEach expect */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');
var calcMobileHelper = require('./calc_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		helper.beforeAll(testFileName, 'calc');

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
			.should('contain', 'download');
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
			.should('contain', 'download');
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
			.should('contain', 'download');
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
			.should('contain', 'download');
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
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Search for some word
		helper.inputOnIdle('#searchterm', 'a');

		cy.get('#search')
			.should('not.have.attr', 'disabled');

		helper.clickOnIdle('#search');

		// First cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');
	});

	it('Sheet: insert row before.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Rows')
			.click();

		cy.contains('.menu-entry-with-icon', 'Rows Above')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 3);

		cy.get('#copy-paste-container table tr td:nth-of-type(1)')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(3);
				expect(cells[0]).to.have.text('');
				expect(cells[1]).to.have.text('1');
				expect(cells[2]).to.have.text('3');
			});
	});

	it('Sheet: insert row after.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Rows')
			.click();

		cy.contains('.menu-entry-with-icon', 'Rows Below')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 3);

		cy.get('#copy-paste-container table tr td:nth-of-type(1)')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(3);
				expect(cells[0]).to.have.text('1');
				expect(cells[1]).to.have.text('');
				expect(cells[2]).to.have.text('3');
			});
	});

	it('Sheet: insert column before.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Columns')
			.click();

		cy.contains('.menu-entry-with-icon', 'Columns Before')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 2);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(3);
				expect(cells[0]).to.have.text('');
				expect(cells[1]).to.have.text('1');
				expect(cells[2]).to.have.text('2');
			});
	});

	it('Sheet: insert column after.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Columns')
			.click();

		cy.contains('.menu-entry-with-icon', 'Columns After')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 2);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(3);
				expect(cells[0]).to.have.text('1');
				expect(cells[1]).to.have.text('');
				expect(cells[2]).to.have.text('2');
			});
	});

	it('Sheet: delete rows.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Delete Rows')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 1);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(2);
				expect(cells[0]).to.have.text('3');
			});
	});

	it('Sheet: delete columns.', function() {
		before('hamburger_menu_sheet.ods');

		calcHelper.clickOnFirstCell();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Delete Columns')
			.click();

		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table tr')
			.should('have.length', 2);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(1);
				expect(cells[0]).to.have.text('2');
			});
	});

	it('Sheet: insert / delete row break.', function() {
		before('hamburger_menu_sheet.ods');

		// Select B2 cell
		calcHelper.clickOnFirstCell();

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(77px, 11px, 0px); z-index: 11;\']')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(1);
				var XPos = marker[0].getBoundingClientRect().right + 2;
				var YPos = marker[0].getBoundingClientRect().bottom + 2;
				cy.get('body')
					.click(XPos, YPos);

				cy.get('input#addressInput')
					.should('have.prop', 'value', 'B2');
			});

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Page Break')
			.click();

		cy.contains('.menu-entry-with-icon', 'Row Break')
			.click();

		// TODO: no visual indicator here
		cy.wait(500);

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Delete Page Break')
			.click();

		cy.contains('[title=\'Delete Page Break\'] .menu-entry-with-icon', 'Row Break')
			.click();

		// TODO: no visual indicator here
		cy.wait(500);
	});

	it('Sheet: insert / delete column break.', function() {
		before('hamburger_menu_sheet.ods');

		// Select B2 cell
		calcHelper.clickOnFirstCell();

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(77px, 11px, 0px); z-index: 11;\']')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(1);
				var XPos = marker[0].getBoundingClientRect().right + 2;
				var YPos = marker[0].getBoundingClientRect().bottom + 2;
				cy.get('body')
					.click(XPos, YPos);

				cy.get('input#addressInput')
					.should('have.prop', 'value', 'B2');
			});

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Insert Page Break')
			.click();

		cy.contains('.menu-entry-with-icon', 'Column Break')
			.click();

		// TODO: no visual indicator here
		cy.wait(500);

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Sheet')
			.click();

		cy.contains('.menu-entry-with-icon', 'Delete Page Break')
			.click();

		cy.contains('[title=\'Delete Page Break\'] .menu-entry-with-icon', 'Column Break')
			.click();

		// TODO: no visual indicator here
		cy.wait(500);
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

	it('Data: grouping / ungrouping.', function() {
		before('hamburger_menu.ods');

		// Use columns header height as indicator
		helper.initAliasToNegative('origHeaderHeight');

		cy.get('.spreadsheet-header-columns')
			.invoke('height')
			.as('origHeaderHeight');

		cy.get('@origHeaderHeight')
			.should('be.greaterThan', 0);

		// Group first
		calcMobileHelper.selectFirstColumn();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group...')
			.click();

		cy.get('@origHeaderHeight')
			.then(function(origHeaderHeight) {
				cy.get('.spreadsheet-header-columns')
					.should(function(header) {
						expect(header.height()).to.be.greaterThan(origHeaderHeight);
					});
			});

		// Then ungroup
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Ungroup...')
			.click();

		cy.get('@origHeaderHeight')
			.then(function(origHeaderHeight) {
				cy.get('.spreadsheet-header-columns')
					.should(function(header) {
						expect(header.height()).to.be.at.most(origHeaderHeight);
					});
			});
	});

	it('Data: remove grouping outline.', function() {
		before('hamburger_menu.ods');

		// Use columns header height as indicator
		helper.initAliasToNegative('origHeaderHeight');

		cy.get('.spreadsheet-header-columns')
			.invoke('height')
			.as('origHeaderHeight');

		cy.get('@origHeaderHeight')
			.should('be.greaterThan', 0);

		// Group first
		calcMobileHelper.selectFirstColumn();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group...')
			.click();

		cy.get('@origHeaderHeight')
			.then(function(origHeaderHeight) {
				cy.get('.spreadsheet-header-columns')
					.should(function(header) {
						expect(header.height()).to.be.greaterThan(origHeaderHeight);
					});
			});

		// Then remove outline
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Remove Outline')
			.click();

		cy.get('@origHeaderHeight')
			.then(function(origHeaderHeight) {
				cy.get('.spreadsheet-header-columns')
					.should(function(header) {
						expect(header.height()).to.be.at.most(origHeaderHeight);
					});
			});
	});

	it('Data: show / hide grouping details.', function() {
		before('hamburger_menu.ods');

		// Use columns header height as indicator
		helper.initAliasToNegative('origHeaderHeight');

		cy.get('.spreadsheet-header-columns')
			.invoke('height')
			.as('origHeaderHeight');

		cy.get('@origHeaderHeight')
			.should('be.greaterThan', 0);

		// Group first
		calcMobileHelper.selectFirstColumn();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group...')
			.click();

		cy.get('@origHeaderHeight')
			.then(function(origHeaderHeight) {
				cy.get('.spreadsheet-header-columns')
					.should(function(header) {
						expect(header.height()).to.be.greaterThan(origHeaderHeight);
					});
			});

		// Use selected content as indicator
		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table')
			.should('exist');

		// Hide details
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Hide Details')
			.click();

		// Frist column is hidden -> no content
		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table')
			.should('not.exist');

		// Show details
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Data')
			.click();

		cy.contains('.menu-entry-with-icon', 'Group and Outline')
			.click();

		cy.contains('.menu-entry-with-icon', 'Show Details')
			.click();

		// Frist column is visible again -> we have content again
		calcMobileHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table')
			.should('exist');
	});

	it('Automatic spell checking.', function() {
		before('hamburger_menu.ods');

		// Make everything white on tile
		calcMobileHelper.selectAllMobile(false);

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScCellAppearancePropertyPanel');

		cy.contains('.menu-entry-with-icon', 'Background Color')
			.should('be.visible');

		helper.clickOnIdle('#border-12');

		helper.clickOnIdle('#FrameLineColor');

		mobileHelper.selectFromColorPalette(2, 0, 7);

		mobileHelper.closeMobileWizard();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Color');

		mobileHelper.selectFromColorPalette(0, 0, 7);

		var firstTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 0px; top: 5px;\']';
		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 5px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);
		helper.imageShouldBeFullWhiteOrNot(firstTile, false);

		// Disable automatic spell checking
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Automatic Spell Checking')
			.click();

		helper.imageShouldBeFullWhiteOrNot(firstTile, true);

		// Enable automatic spell checking again
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Automatic Spell Checking')
			.click();

		helper.imageShouldBeFullWhiteOrNot(firstTile, false);
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
