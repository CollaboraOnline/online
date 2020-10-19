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
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);
	}

	function openPageWizard() {
		mobileHelper.selectHamburgerMenuItem(['Page Setup']);

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
		// Change the document content and save it
		writerMobileHelper.selectAllMobile();

		helper.typeIntoDocument('new');

		writerMobileHelper.selectAllMobile();

		helper.expectTextForClipboard('\nnew');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		// Reopen the document and check content.
		helper.beforeAll(testFileName, 'writer', true);

		mobileHelper.enableEditingMobile();

		writerMobileHelper.selectAllMobile();

		helper.expectTextForClipboard('\nnew');
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		mobileHelper.selectHamburgerMenuItem(['File', 'Print']);

		cy.window().its('open').should('be.called');
	});

	it('Download as PDF', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'PDF Document (.pdf)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as ODT', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'ODF text document (.odt)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as DOC', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'Word 2003 Document (.doc)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as DOCX', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'Word Document (.docx)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as RTF', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'Rich Text (.rtf)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as EPUB', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'EPUB (.epub)']);

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
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'q');

		// Redo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Redo']);

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
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'w');

		// Revert one undo step via Repair
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);

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
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);

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

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Cut']);

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

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Copy']);

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

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Paste']);

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

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Select All']);

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		cy.get('#copy-paste-container p')
			.should('contain.text', 'xxxxxx');
	});

	it('Enable track changes recording.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Insert some text and check whether it's tracked.
		helper.typeIntoDocument('q');

		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Then disable recording.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		helper.typeIntoDocument('{rightArrow}w');

		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');
	});

	it('Show track changes.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

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
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Show']);

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
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// Accept removal.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Accept All']);

		// Check that we don't have the removed content
		helper.typeIntoDocument('{ctrl}a');

		cy.wait(1000);

		// No selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Reject all changes.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		writerMobileHelper.selectAllMobile();

		// We don't have actual text content.
		cy.get('#copy-paste-container p')
			.should('have.text', '\n\n\n');

		// Reject removal.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Reject All']);

		writerMobileHelper.selectAllMobile();

		// We get back the content.
		cy.contains('#copy-paste-container p', 'xxxxxxx')
			.should('exist');
	});

	it('Go to next/prev change.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// First change
		helper.typeIntoDocument('q');

		// Second change
		helper.typeIntoDocument('{rightArrow}w');

		// Find second change using prev.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');

		// Find first change using prev.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Find second change using next.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Next']);

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');
	});

	it('Search some word.', function() {
		mobileHelper.selectHamburgerMenuItem(['Search']);

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

		mobileHelper.selectHamburgerMenuItem(['Word Count...']);

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
		// We use the cursor horizontal position as indicator of document width change.
		helper.moveCursor('end');

		helper.getCursorPos('left', 'cursorOrigLeft');

		openPageWizard();

		helper.clickOnIdle('#papersize');

		helper.clickOnIdle('.ui-combobox-text', 'A3');

		// Cursor postion changes because of the bigger document width.
		helper.moveCursor('end');

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'A3');
	});

	it('Page setup: change paper width.', function() {
		// We use the cursor horizontal position as indicator of document width change.
		helper.moveCursor('end');

		helper.getCursorPos('left', 'cursorOrigLeft');

		openPageWizard();

		helper.inputOnIdle('#paperwidth .spinfield', '12');

		// Cursor postion changes because of the bigger document width.
		helper.moveCursor('end');

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperwidth .spinfield')
			.should('have.attr', 'value', '12');
	});

	it('Page setup: change paper height.', function() {
		// We use the cursor vertical position as indicator of document size change.
		helper.moveCursor('ctrl-end');

		helper.getCursorPos('top', 'cursorOrigTop');

		openPageWizard();

		helper.inputOnIdle('#paperheight .spinfield', '3.0');

		// Cursor postion changes because of having more pages (page gap).
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperheight .spinfield')
			.should('have.attr', 'value', '3');
	});

	it('Page setup: change orientation.', function() {
		// We use the cursor horizontal position as indicator of document width change.
		helper.moveCursor('end');

		helper.getCursorPos('left', 'cursorOrigLeft');

		openPageWizard();

		helper.clickOnIdle('#paperorientation');

		helper.clickOnIdle('.ui-combobox-text', 'Landscape');

		// We got some extra tiles horizontally.
		// TODO: issue here, view is not moved with the cursor
		helper.moveCursor('end', false);

		// Cursor postion changes because of the bigger document width.
		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#paperorientation .ui-header-left')
			.should('have.text', 'Landscape');
	});

	it('Page setup: change margin.', function() {
		// We use the cursor horizontal position as indicator of margin change.
		helper.typeIntoDocument('{home}');

		cy.get('.blinking-cursor')
			.should('be.visible');

		helper.getCursorPos('left', 'cursorOrigLeft');

		openPageWizard();

		helper.clickOnIdle('#marginLB');

		helper.clickOnIdle('.ui-combobox-text', 'None');

		// Text is moved leftward by margin removal.
		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.lessThan(cursorOrigLeft);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		closePageWizard();

		openPageWizard();

		cy.get('#marginLB .ui-header-left')
			.should('have.text', 'None');
	});

	it('Show formatting marks.', function() {
		// Hide text so the center tile is full white.
		hideText();

		var canvas = '.leaflet-canvas-container canvas';
		helper.canvasShouldBeFullWhiteOrNot(canvas, true);

		// Enable it first -> spaces will be visible.
		mobileHelper.selectHamburgerMenuItem(['View', 'Formatting Marks']);

		helper.canvasShouldBeFullWhiteOrNot(canvas, false);

		// Then disable it again.
		mobileHelper.selectHamburgerMenuItem(['View', 'Formatting Marks']);

		helper.canvasShouldBeFullWhiteOrNot(canvas, true);
	});

	it('Automatic spell checking.', function() {
		// Hide text so the center tile is full white.
		hideText();

		var canvas = '.leaflet-canvas-container canvas';
		helper.canvasShouldBeFullWhiteOrNot(canvas, true);

		// Enable it first.
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);

		helper.canvasShouldBeFullWhiteOrNot(canvas, false);

		// Then disable it again.
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);

		helper.canvasShouldBeFullWhiteOrNot(canvas, true);
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

		cy.get('.loleaflet-annotation:nth-of-type(2)')
			.should('have.attr', 'style')
			.should('not.contain', 'visibility: hidden');

		// Resolve comment
		mobileHelper.selectAnnotationMenuItem('Resolve');

		cy.get('.loleaflet-annotation:nth-of-type(2)')
			.should('have.attr', 'style')
			.should('contain', 'visibility: hidden');

		// Show resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);

		cy.get('.loleaflet-annotation:nth-of-type(2)')
			.should('have.attr', 'style')
			.should('not.contain', 'visibility: hidden');

		// Hide resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);

		// TODO: can't hide resolved comments again.
		//cy.get('.loleaflet-annotation:nth-of-type(2)')
		//	.should('have.attr', 'style')
		//	.should('contain', 'visibility: hidden');
	});

	it('Check version information.', function() {
		mobileHelper.selectHamburgerMenuItem(['About']);

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

