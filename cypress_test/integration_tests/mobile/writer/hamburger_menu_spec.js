/* global describe it cy Cypress beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');
var repairHelper = require('../../common/repair_document_helper');

describe('Trigger hamburger menu options.', function() {
	var origTestFileName = 'hamburger_menu.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function hideText() {
		// Change text color to white to hide text.
		writerHelper.selectAllTextOfDoc();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#FontColor .ui-header');

		mobileHelper.selectFromColorPicker('#FontColor', 0, 7);

		// End remove spell checking red lines
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);

		// Remove any selections.
		helper.moveCursor('left');
	}

	function openPageWizard() {
		mobileHelper.selectHamburgerMenuItem(['Page Setup']);

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
	}

	function closePageWizard() {
		cy.get('#mobile-wizard-back')
			.should('have.class', 'close-button');

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#mobile-wizard')
			.should('not.be.visible');
	}

	it('Save', function() {
		// Change the document content and save it
		writerHelper.selectAllTextOfDoc();

		cy.wait(1000);

		helper.typeIntoDocument('new');

		writerHelper.selectAllTextOfDoc();

		cy.wait(1000);

		helper.expectTextForClipboard('new');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		//reset get to original function
		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			return originalFn(selector, options);
		});

		// Reopen the document and check content.
		helper.reload(testFileName, 'writer', true);

		mobileHelper.enableEditingMobile();

		writerHelper.selectAllTextOfDoc();

		helper.expectTextForClipboard('new');
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		helper.getCoolFrameWindow()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		mobileHelper.selectHamburgerMenuItem(['File', 'Print']);

		helper.getCoolFrameWindow()
			.then(function(win) {
				cy.wrap(win).its('open').should('be.called');
			});
	});

	it('Download as PDF', function() {
		mobileHelper.selectHamburgerMenuItem(['Download as', 'PDF Document (.pdf)']);
		mobileHelper.pressPushButtonOfDialog('Export');

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
		mobileHelper.pressPushButtonOfDialog('OK');

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Undo/redo.', function() {
		// Type a new character
		helper.typeIntoDocument('q');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'q');

		// Undo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('not.contain.text', 'q');

		// Redo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Redo']);

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'q');
	});


	it('Repair Document', function() {
		helper.typeIntoDocument('Hello World');

		repairHelper.rollbackPastChange('Typing: “World”', undefined, true);

		helper.selectAllText();

		helper.expectTextForClipboard('Hello \n');
	});

	it('Cut.', function() {
		writerHelper.selectAllTextOfDoc();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Cut']);

		cy.get('#copy_paste_warning').should('exist');
	});

	it('Copy.', function() {
		writerHelper.selectAllTextOfDoc();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Copy']);

		cy.get('#copy_paste_warning').should('exist');
	});

	it('Paste.', function() {
		writerHelper.selectAllTextOfDoc();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Paste']);

		cy.get('#copy_paste_warning').should('exist');
	});

	it('Select all.', function() {
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Select All']);

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('contain.text', 'xxxxxx');
	});

	it('Enable track changes recording.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Insert some text and check whether it's tracked.
		helper.typeIntoDocument('q');

		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		helper.textSelectionShouldExist();

		// We should have 'q' selected.
		helper.expectTextForClipboard('q');

		// Then disable recording.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		helper.typeIntoDocument('{rightArrow}w');

		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		helper.textSelectionShouldExist();

		// We should have 'q' selected.
		helper.expectTextForClipboard('q');
	});

	it('Show track changes.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// By default track changed are shown.
		writerHelper.selectAllTextOfDoc();

		// No actual text sent from core because of the removal.
		helper.expectTextForClipboard('\n\n');

		// We have a multiline selection
		cy.get('.leaflet-selection-marker-start')
			.then(function(firstMarker) {
				cy.get('.leaflet-selection-marker-end')
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
		cy.get('.leaflet-selection-marker-start')
			.then(function(firstMarker) {
				cy.get('.leaflet-selection-marker-end')
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
		helper.textSelectionShouldNotExist();
	});

	it('Reject all changes.', function() {
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Record']);

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		writerHelper.selectAllTextOfDoc();

		// We don't have actual text content.
		helper.expectTextForClipboard('\n\n');

		// Reject removal.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Reject All']);

		writerHelper.selectAllTextOfDoc();

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

		helper.expectTextForClipboard('w');

		// Find first change using prev.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Previous']);

		helper.expectTextForClipboard('q');

		// Find second change using next.
		mobileHelper.selectHamburgerMenuItem(['Track Changes', 'Next']);

		helper.expectTextForClipboard('w');
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
		helper.textSelectionShouldExist();

		helper.expectTextForClipboard('a');

		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});

	it('Check word counts.', function() {
		writerHelper.selectAllTextOfDoc();

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
		// For now, we don't/can't actually check if the size of the document is updated or not.
		// That can be checked with a unit test.

		openPageWizard();

		mobileHelper.selectListBoxItem2('#papersize', 'A3');

		closePageWizard();

		// Check that the page wizard shows the right value after reopen.
		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'A3');
	});

	it('Page setup: change paper width.', function() {
		// For now, we don't/can't actually check if the size of the document is updated or not.
		// That can be checked with a unit test.

		openPageWizard();

		helper.inputOnIdle('#paperwidth .spinfield', '12');

		closePageWizard();

		// Check that the page wizard shows the right value after reopen.
		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperwidth .spinfield')
			.should('have.value', '12');
	});

	it('Page setup: change paper height.', function() {
		// For now, we don't/can't actually check if the size of the document is updated or not.
		// That can be checked with a unit test.

		openPageWizard();

		helper.inputOnIdle('#paperheight .spinfield', '3.0');

		closePageWizard();

		// Check that the page wizard shows the right value after reopen.
		openPageWizard();

		cy.get('#papersize .ui-header-left')
			.should('have.text', 'User');

		cy.get('#paperheight .spinfield')
			.should('have.value', '3');
	});

	it('Page setup: change orientation.', function() {
		// For now, we don't/can't actually check if the size of the document is updated or not.
		// That can be checked with a unit test.

		openPageWizard();

		mobileHelper.selectListBoxItem2('#paperorientation', 'Landscape');

		closePageWizard();

		// Check that the page wizard shows the right value after reopen.
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

		mobileHelper.selectListBoxItem2('#marginLB', 'None');

		closePageWizard();

		// Text is moved leftward by margin removal.
		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.lessThan(cursorOrigLeft);
					});
			});

		// Check that the page wizard shows the right value after reopen.
		openPageWizard();

		cy.get('#marginLB .ui-header-left')
			.should('have.text', 'None');
	});

	it('Show formatting marks.', function() {
		// Hide text so the document is full white.
		hideText();

		var canvas = '.leaflet-canvas-container canvas';
		helper.canvasShouldBeFullWhite(canvas);

		// Enable it first -> spaces will be visible.
		mobileHelper.selectHamburgerMenuItem(['View', 'Formatting Marks']);

		helper.canvasShouldNotBeFullWhite(canvas);

		// Then disable it again.
		mobileHelper.selectHamburgerMenuItem(['View', 'Formatting Marks']);

		helper.typeIntoDocument('{home}{end}');

		helper.canvasShouldBeFullWhite(canvas);
	});

	it('Automatic spell checking.', function() {
		// Hide text so the document is full white.
		hideText();

		var canvas = '.leaflet-canvas-container canvas';
		helper.canvasShouldBeFullWhite(canvas);

		// Enable it first.
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);

		helper.canvasShouldNotBeFullWhite(canvas);

		// Then disable it again.
		mobileHelper.selectHamburgerMenuItem(['View', 'Automatic Spell Checking']);

		helper.typeIntoDocument('{home}{end}');

		helper.canvasShouldBeFullWhite(canvas);
	});

	it('Check version information.', function() {
		mobileHelper.selectHamburgerMenuItem(['About']);

		cy.get('#mobile-wizard-content')
			.should('exist');

		// Check the version
		cy.contains('#lokit-version', 'Collabora Office').should('exist');

		// Close about dialog
		cy.get('div.mobile-wizard.jsdialog-overlay.cancellable').click({force : true});
	});
});
