/* global describe it cy Cypress require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		helper.beforeAll(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Save', function() {
		before('hamburger_menu.odp');

		// Change the document content and save it
		impressHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new text
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('new');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xnew');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		//reset get to original function
		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			return originalFn(selector, options);
		});

		// Reopen the document and check content.
		helper.beforeAll(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xnew');
	});

	it('Print', function() {
		before('hamburger_menu.odp');

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

		impressHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		// Undo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Redo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Redo']);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');
	});

	it('Repair.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressHelper.triggerNewSVGForShapeInTheCenter();

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

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');
	});

	it('Cut.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

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
			.should('not.exist');
	});

	it('Copy.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

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
			.should('not.exist');
	});

	it('Paste.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

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
			.should('not.exist');
	});

	it('Select all.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();

		impressHelper.dblclickOnSelectedShape();

		cy.get('#copy-paste-container pre')
			.should('not.exist');

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Select All']);

		helper.textSelectionShouldExist();

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
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
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
		cy.contains('#lokit-version', 'Collabora Office')
			.should('exist');

		// Close about dialog
		cy.get('.vex-close')
			.click({force : true});

		cy.get('.vex-content')
			.should('not.exist');
	});
});
