/* global describe it cy require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var mobileHelper = require('../../common/mobile_helper');
var repairHelper = require('../../common/repair_document_helper');

describe.skip(['tagmobile'], 'Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = helper.beforeAll(testFile, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Save', { defaultCommandTimeout: 60000 }, function() {
		before('hamburger_menu.odp');

		// Change the document content and save it
		impressHelper.selectTextShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new text
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('new');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xnew');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		// Reopen the document and check content.
		helper.reload(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
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
		mobileHelper.pressPushButtonOfDialog('Export');

		cy.cGet('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as ODP', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'ODF presentation (.odp)']);

		cy.cGet('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as PPT', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'PowerPoint 2003 Presentation (.ppt)']);

		cy.cGet('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Download as PPTX', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Download as', 'PowerPoint Presentation (.pptx)']);

		cy.cGet('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'download');
	});

	it('Undo/redo.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		// Undo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Undo']);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Redo
		mobileHelper.selectHamburgerMenuItem(['Edit', 'Redo']);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');
	});

	it('Repair.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		impressHelper.dblclickOnSelectedShape();

		helper.typeIntoDocument('q');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		repairHelper.rollbackPastChange('Undo', undefined, true);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');
	});

	it('Cut.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Cut']);

		cy.cGet('#mobile-wizard-content-modal-dialog-copy_paste_warning-box').should('exist');
	});

	it('Copy.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Copy']);

		cy.cGet('#mobile-wizard-content-modal-dialog-copy_paste_warning-box').should('exist');
	});

	it('Paste.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Paste']);

		cy.cGet('#mobile-wizard-content-modal-dialog-copy_paste_warning-box').should('exist');
	});

	it('Select all.', function() {
		before('hamburger_menu.odp');

		impressHelper.selectTextShapeInTheCenter();

		impressHelper.dblclickOnSelectedShape();

		cy.cGet('#copy-paste-container pre')
			.should('not.exist');

		mobileHelper.selectHamburgerMenuItem(['Edit', 'Select All']);

		helper.textSelectionShouldExist();

		helper.expectTextForClipboard('X');
	});

	it.skip('Search some word.', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['Search']);

		// Search bar become visible
		cy.cGet('#mobile-wizard-content')
			.should('not.be.empty');

		// Search for some word
		helper.inputOnIdle('#searchterm', 'X');

		cy.cGet('#search')
			.should('not.have.attr', 'disabled');

		helper.clickOnIdle('#search');

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start')
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

		cy.cGet('#mobile-wizard-content-modal-dialog-deleteslide-modal').should('exist');
		cy.cGet('#deleteslide-modal-response').click();
		cy.cGet('#mobile-wizard-content-modal-dialog-deleteslide-modal').should('not.exist');

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

		cy.cGet('iframe.leaflet-slideshow')
			.should('not.exist');

		mobileHelper.selectHamburgerMenuItem(['Fullscreen presentation']);

		cy.cGet('iframe.leaflet-slideshow')
			.should('exist');
	});

	it('Check version information.', function() {
		before('hamburger_menu.odp');

		mobileHelper.selectHamburgerMenuItem(['About']);

		cy.cGet('#mobile-wizard-content')
			.should('exist');

		// Check the version
		cy.cGet('body').contains('#lokit-version', 'Collabora Office')
			.should('exist');

		// Close about dialog
		cy.cGet('div.mobile-wizard.jsdialog-overlay.cancellable').click({force : true});
	});
});
