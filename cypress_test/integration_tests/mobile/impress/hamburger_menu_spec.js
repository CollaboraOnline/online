/* global describe it cy require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function dblclickOnShape() {
		cy.get('.transform-handler--rotate')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = items[0].getBoundingClientRect().bottom + 50;
				cy.get('body')
					.dblclick(XPos, YPos);
			});
	}

	it('Save', function() {
		before('hamburger_menu.odp');

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
		before('hamburger_menu.odp');

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
		before('hamburger_menu.odp');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'PDF Document (.pdf)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.pdf');
	});

	it('Download as ODP', function() {
		before('hamburger_menu.odp');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'ODF presentation (.odp)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.odp');
	});

	it('Download as PPT', function() {
		before('hamburger_menu.odp');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'PowerPoint 2003 Presentation (.ppt)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.ppt');
	});

	it('Download as PPTX', function() {
		before('hamburger_menu.odp');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Download as')
			.click();

		cy.contains('.menu-entry-with-icon', 'PowerPoint Presentation (.pptx)')
			.click();

		cy.get('iframe')
			.should('have.attr', 'data-src')
			.should('contain', 'document.pptx');
	});

	it('Undo/redo.', function() {
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Type a new character
		dblclickOnShape();

		cy.get('textarea.clipboard')
			.type('q');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

		// Undo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Undo')
			.click();

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');

		// Redo
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Redo')
			.click();

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
		dblclickOnShape();

		cy.get('textarea.clipboard')
			.type('q');

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'Xq');

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

		impressMobileHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.text', 'X');
	});

	it('Cut.', function() {
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		impressMobileHelper.selectTextOfShape();

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
		before('hamburger_menu.odp');

		impressMobileHelper.selectTextShapeInTheCenter();
		dblclickOnShape();

		cy.get('#copy-paste-container pre')
			.should('not.exist');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Edit')
			.click();

		cy.contains('.menu-entry-with-icon', 'Select All')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		helper.expectTextForClipboard('X');
	});

	it('Search some word.', function() {
		before('hamburger_menu.odp');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Search')
			.click();

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
});
