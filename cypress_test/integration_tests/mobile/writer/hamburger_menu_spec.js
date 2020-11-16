/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = 'hamburger_menu.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function hideText() {
		// Change text color to white to hide text.
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#FontColor');

		mobileHelper.selectFromColorPalette(0, 0, 7);

		// End remove spell checking red lines
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Automatic Spell Checking')
			.click();
	}

	function openPageWizard() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Page Setup')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
	}

	function closePageWizard() {
		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#mobile-wizard')
			.should('not.be.visible');
	}

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
			.should('contain', 'download');
	});

	it('Download as ODT', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'ODF text document (.odt)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as DOC', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'Word 2003 Document (.doc)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as DOCX', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'Word Document (.docx)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as RTF', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'Rich Text (.rtf)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as EPUB', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'EPUB (.epub)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Undo/redo.', function() {
		// Type a new character
		helper.typeIntoDocument('q');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'q');

		// Undo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Undo')
			.click();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'q');

		// Redo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Redo')
			.click();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'q');
	});

	it('Repair.', function() {
		// First change
		helper.typeIntoDocument('q');

		// Second change
		helper.typeIntoDocument('w');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'qw');

		// Undo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Undo')
			.click();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'w');

		// Revert one undo step via Repair
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Repair')
			.click();

		cy.get('.leaflet-popup-content')
			.should('be.visible');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.should('contain.text', 'Redo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(3)')
			.should('contain.text', 'Undo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.click();

		cy.get('.leaflet-popup-content input[value=\'Jump to state\']')
			.click();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'qw');

		// Revert to the initial state via Repair
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Repair')
			.click();

		cy.get('.leaflet-popup-content')
			.should('be.visible');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.should('contain.text', 'Undo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(3)')
			.should('contain.text', 'Undo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(3)')
			.click();

		cy.get('.leaflet-popup-content input[value=\'Jump to state\']')
			.click();

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'q');

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'w');
	});

	it('Cut.', function() {
		writerMobileHelper.selectAllMobile();

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
		writerMobileHelper.selectAllMobile();

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
		writerMobileHelper.selectAllMobile();

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
		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'xxxxxx');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Select All')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		cy.get('#copy-paste-container p')
			.should('contain.text', 'xxxxxx');
	});

	it('Enable track changes recording.', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Insert some text and check whether it's tracked.
		helper.typeIntoDocument('q');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Then disable recording.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		helper.typeIntoDocument('{rightArrow}w');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');
	});

	it('Show track changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// By default track changed are shown.
		writerMobileHelper.selectAllMobile();

		// We have selection markers.
		cy.get('.leaflet-marker-icon')
			.should('exist');

		// No actual text sent from core because of the removal.
		cy.get('#copy-paste-container p')
			.should('have.text', '\n\n\n');

		// We have a multiline selection
		cy.get('.leaflet-marker-icon:nth-of-type(1)')
			.then(function(firstMarker) {
				cy.get('.leaflet-marker-icon:nth-of-type(2)')
					.then(function(secondMarker) {
						expect(firstMarker.offset().top).to.be.lessThan(secondMarker.offset().top);
						expect(firstMarker.offset().left).to.be.lessThan(secondMarker.offset().left);
					});
			});

		// Remove text selection.
		helper.typeIntoDocument('{leftArrow}');

		// Hide track changes.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Show')
			.click();

		// Trigger select all
		helper.typeIntoDocument('{ctrl}a');

		// Both selection markers should be in the same line
		cy.get('.leaflet-marker-icon:nth-of-type(1)')
			.then(function(firstMarker) {
				cy.get('.leaflet-marker-icon:nth-of-type(2)')
					.then(function(secondMarker) {
						expect(firstMarker.offset().top).to.be.equal(secondMarker.offset().top);
						expect(firstMarker.offset().left).to.be.lessThan(secondMarker.offset().left);
					});
			});
	});

	it('Accept all changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// Accept removal.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Accept All')
			.click();

		// Check that we dont have the removed content
		helper.typeIntoDocument('{ctrl}a');

		cy.wait(1000);

		// No selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Reject all changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		writerMobileHelper.selectAllMobile();

		// We dont have actual text content.
		cy.get('#copy-paste-container p')
			.should('have.text', '\n\n\n');

		// Reject removal.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Reject All')
			.click();

		writerMobileHelper.selectAllMobile();

		// We get back the content.
		cy.contains('#copy-paste-container p', 'xxxxxxx')
			.should('exist');
	});

	it('Go to next/prev change.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// First change
		helper.typeIntoDocument('q');

		// Second change
		helper.typeIntoDocument('{rightArrow}w');

		// Find second change using prev.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');

		// Find first change using prev.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Find second change using next.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Next')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');
	});

	it('Search some word.', function() {
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

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});

	it('Check word counts.', function() {
		writerMobileHelper.selectAllMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Word Count...')
			.click();

		// Selected counts
		cy.get('#selectwords')
			.should('have.text', '106');

		cy.get('#selectchars')
			.should('have.text', '1,174');

		cy.get('#selectcharsnospaces')
			.should('have.text', '1,069');

		cy.get('#selectcjkchars')
			.should('have.text', '0');

		// General counts
		cy.get('#docwords')
			.should('have.text', '106');

		cy.get('#docchars')
			.should('have.text', '1,174');

		cy.get('#doccharsnospaces')
			.should('have.text', '1,069');

		cy.get('#doccjkchars')
			.should('have.text', '0');
	});

	it('Page setup: change paper size.', function() {
		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 517px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		openPageWizard();

		helper.clickOnIdle('#papersize');

		helper.clickOnIdle('.ui-combobox-text', 'C6 Envelope');

		// Smaller paper size makes center tile to contain text too.
		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'C6 Envelope');
	});

	it('Page setup: change paper width.', function() {
		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 517px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		openPageWizard();

		helper.inputOnIdle('#paperwidth .spinfield', '5');

		// Smaller paper size makes center tile to contain text too.
		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperwidth .spinfield')
			.should('have.attr', 'value', '5');
	});

	it('Page setup: change paper height.', function() {
		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 517px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		openPageWizard();

		helper.inputOnIdle('#paperheight .spinfield', '3.0');

		// Smaller paper size makes center tile to contain the end of the page.
		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperheight .spinfield')
			.should('have.attr', 'value', '3');
	});

	it('Page setup: change orientation.', function() {
		cy.get('.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 1024px; top: 5px;\']')
			.should('not.exist');

		// Move the cursor to the right side of the document,
		// so the new tile will be visible and loaded.
		helper.typeIntoDocument('{end}');

		cy.get('.blinking-cursor')
			.should('be.visible');

		openPageWizard();

		helper.clickOnIdle('#paperorientation');

		helper.clickOnIdle('.ui-combobox-text', 'Landscape');

		// We got some extra tiles horizontally.
		cy.get('.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 1024px; top: 5px;\']')
			.should('exist');

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#paperorientation .ui-header-left')
			.should('have.text', 'Landscape');
	});

	it('Page setup: change margin.', function() {
		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 261px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		openPageWizard();

		helper.clickOnIdle('#marginLB');

		helper.clickOnIdle('.ui-combobox-text', 'None');

		// Text is moved up by margin removal, so the the center tile will be empty.
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#marginLB .ui-header-left')
			.should('have.text', 'None');
	});

	it('Show formatting marks.', function() {
		// Hide text so the center tile is full white.
		hideText();

		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 261px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		// Enable it first -> spaces will be visible.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Formatting Marks')
			.click();

		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		// Then disable it again.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Formatting Marks')
			.click();

		helper.imageShouldBeFullWhiteOrNot(centerTile, true);
	});

	it('Automatic spell checking.', function() {
		// Hide text so the center tile is full white.
		hideText();

		var centerTile = '.leaflet-tile-loaded[style=\'width: 256px; height: 256px; left: 256px; top: 261px;\']';
		helper.imageShouldBeFullWhiteOrNot(centerTile, true);

		// Enable it first.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Automatic Spell Checking')
			.click();

		helper.imageShouldBeFullWhiteOrNot(centerTile, false);

		// Then disable it again.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Automatic Spell Checking')
			.click();

		helper.imageShouldBeFullWhiteOrNot(centerTile, true);
	});

	it('Resolved comments.', function() {
		// Insert comment first
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.loleaflet-annotation-textarea')
			.type('some text');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.loleaflet-annotation')
			.should('have.attr', 'style')
			.should('not.contain', 'visibility: hidden');

		// Resolve comment
		cy.get('.loleaflet-annotation-menu')
			.click({force: true});

		cy.contains('.context-menu-item', 'Resolve')
			.click();

		cy.get('.loleaflet-annotation')
			.should('have.attr', 'style')
			.should('contain', 'visibility: hidden');

		// Show resolved comments
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Resolved Comments')
			.click();

		cy.get('.loleaflet-annotation')
			.should('have.attr', 'style')
			.should('not.contain', 'visibility: hidden');

		// Hide resolved comments
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'View')
			.click();

		cy.contains('.menu-entry-with-icon', 'Resolved Comments')
			.click();

		// TODO: can't hide resolved comments again.
		//cy.get('.loleaflet-annotation:nth-of-type(2)')
		//	.should('have.attr', 'style')
		//	.should('contain', 'visibility: hidden');
	});

	it('Check version information.', function() {
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

