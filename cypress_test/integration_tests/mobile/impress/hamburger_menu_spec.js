/* global describe it cy require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var mobileHelper = require('../../common/mobile_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		helper.beforeAll(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Save', function() {
		before('hamburger_menu.odp');

		// Change the document content and save it
		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new text
		impressMobileHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('new');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xnew');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		// Reopen the document and check content.
		helper.beforeAll(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xnew');
	});

	it('Print', function() {
		before('hamburger_menu.odp');

		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		mobileHelper.selectHamburgerMenuItem(['File', 'Print']);

		cy.window().its('open').should('be.called');
	});

	it('Download as PDF', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'PDF Document (.pdf)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as ODP', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'ODF presentation (.odp)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as PPT', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'PowerPoint 2003 Presentation (.ppt)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as PPTX', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'PowerPoint Presentation (.pptx)']);

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Undo/redo.', function() {
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressMobileHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		// Undo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Redo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Redo']);

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');
	});

	it('Repair.', function() {
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressMobileHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		// Revert one undo step via Repair
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);

		cy.get('.leaflet-popup-content')
			.should('be.visible');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.should('contain.text', 'Undo');

		cy.get('.leaflet-popup-content table tr:nth-of-type(2)')
			.click();

		cy.get('.leaflet-popup-content input[value=\'Jump to state\']')
			.click();

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');
	});

	it('Cut.', function() {
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();

		impressMobileHelper.dblclickOnSelectedShape();

		cy.get('#copy-paste-container pre')
			.should('not.exist');

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Select All']);

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		helper.expectTextForClipboard('X');
	});

	it('Search some word.', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Search']);

		// Search bar become visible
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Search for some word
		helper.inputOnIdle('#searchterm', 'X');

		cy.get('#search')
			.should('not.have.attr', 'disabled');

		helper.clickOnIdle('#search');

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');
	});

	it('Slide: New Slide.', function() {
		before('hamburger_menu.odp');

		impressHelper.assertNumberOfSlidePreviews(1);

		mobileHelper.selectHamburgerMenuItem(['Slide', 'New Slide']);

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Slide: Duplicate Slide.', function() {
		before('hamburger_menu.odp');

		impressHelper.assertNumberOfSlidePreviews(1);

		mobileHelper.selectHamburgerMenuItem(['Slide', 'Duplicate Slide']);

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Slide: Delete Slide.', function() {
		before('hamburger_menu.odp');

		impressHelper.assertNumberOfSlidePreviews(1);

		mobileHelper.selectHamburgerMenuItem(['Slide', 'New Slide']);

		impressHelper.assertNumberOfSlidePreviews(2);

		mobileHelper.selectHamburgerMenuItem(['Slide', 'Delete Slide']);

		cy.get('.vex-content')
			.should('exist');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.vex-content')
			.should('not.exist');

		impressHelper.assertNumberOfSlidePreviews(1);
	});

	it('Full Screen.', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Full Screen']);

		// TODO: We can't hit the actual full screen from cypress
		cy.wait(500);
	});

	it.skip('Automatic spell checking.', function() {
		before('hamburger_menu.odp');

		// Add a spelling error to the shape
		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressMobileHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('qqqqqq');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xqqqqqq');

		// Make everything white on tile
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Color');

		mobileHelper.selectFromColorPalette(0, 0, 7);

		mobileHelper.closeMobileWizard();

		impressMobileHelper.removeShapeSelection();

		var preiew = '.preview-frame:nth-of-type(2) img';
		helper.imageShouldBeFullWhiteOrNot(preiew, false);

		// Disable automatic spell checking
		mobileHelper.selectHamburgerMenuItem(['Automatic Spell Checking']);

		helper.imageShouldBeFullWhiteOrNot(preiew, true);
	});

	it('Fullscreen presentation.', function() {
		before('hamburger_menu.odp');

		cy.get('iframe.leaflet-slideshow')
			.should('not.exist');

		mobileHelper.selectHamburgerMenuItem(['Fullscreen presentation']);

		cy.get('iframe.leaflet-slideshow')
			.should('exist');
	});

	it('Check version information.', function() {
		before('hamburger_menu.odp');

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
