/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Focus tests', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('focus.odt', 'writer');
	});

	afterEach(function() {
		helper.afterAll('focus.odt');
	});

	it('Basic document focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	});

	it('Focus with a vex dialog.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Open comment insertion dialog
		cy.get('#tb_actionbar_item_insertcomment')
			.click();

		cy.get('.loleaflet-annotation-table')
			.should('be.visible');

		// The dialog grabs the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'loleaflet-annotation-textarea');

		// Close the dialog
		cy.contains('Cancel').click();
		cy.get('.loleaflet-annotation-table').should('be.not.visible');

		// Body should have the focus again (no focus on document)
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus with opened mobile wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		mobileHelper.openMobileWizard();

		// Body should have the focus (no focus on document)
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		mobileHelper.closeMobileWizard();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus inside mobile wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.0')
			.click();

		// The spinfield should have the focus now.
		cy.document().its('activeElement.className')
			.should('be.eq', 'spinfield');

		mobileHelper.closeMobileWizard();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus after insertion.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Select More Fields
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget')
			.contains('More Fields...')
			.parent().click();

		// Insert a field
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('Page Number').click();

		cy.get('#mobile-wizard')
			.should('not.be.visible');

		// After insertion the document gets the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	});

	it('Shape related focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Do insertion
		cy.get('.menu-entry-with-icon')
			.contains('Shape')
			.click();

		cy.get('.col.w2ui-icon.basicshapes_rectangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		// One tap on the shape
		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
				var posX = svg[0].getBBox().x + svg[0].getBBox().width / 2;
				var posY = svg[0].getBBox().y + svg[0].getBBox().height / 2;
				cy.get('#document-container')
					.click(posX, posY);
			});

		// No focus on the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Double tap on the shape
		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
				var posX = svg[0].getBBox().x + svg[0].getBBox().width / 2;
				var posY = svg[0].getBBox().y + svg[0].getBBox().height / 2;
				cy.get('#document-container')
					.dblclick(posX, posY).wait(100);
			});

		// Document still has the focus
		// TODO: Focus is inconsistent here.
		//cy.document().its('activeElement.className')
		//	.should('be.eq', 'clipboard');

		// This is unstable too
		//cy.window().then(win => {
		//	expect(win.canAcceptKeyboardInput(), 'Should accept input').to.equal(true);
		//});
	});

	it('Focus with hamburger menu.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		// Open hamburger menu
		mobileHelper.openHamburgerMenu();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Close hamburger menu
		mobileHelper.closeHamburgerMenu();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus after applying font change.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		mobileHelper.openMobileWizard();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Apply bold
		cy.get('#Bold')
			.click();

		cy.get('#Boldimg')
			.should('have.class', 'selected');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		mobileHelper.closeMobileWizard();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Apply bold, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Grab focus to the document
		cy.get('#document-container')
			.type('x');

		helper.selectAllText();

		cy.get('#tb_editbar_item_bold div table')
			.should('not.have.class', 'checked');

		cy.window().then(win => {
			win.lastInputState = win.canAcceptKeyboardInput();
		});

		cy.get('#tb_editbar_item_bold')
			.click();

		cy.get('#tb_editbar_item_bold div table')
			.should('have.class', 'checked');

		cy.window().then(win => {
			var acceptInput = win.canAcceptKeyboardInput();
			expect(acceptInput, 'Should accept input').to.equal(win.lastInputState);
		});
	});

	it('Apply italic, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Grab focus to the document
		cy.get('#document-container')
			.type('x');

		helper.selectAllText();

		cy.get('#tb_editbar_item_italic div table')
			.should('not.have.class', 'checked');

		cy.window().then(win => {
			win.lastInputState = win.canAcceptKeyboardInput();
		});

		cy.get('#tb_editbar_item_italic')
			.click();

		cy.get('#tb_editbar_item_italic div table')
			.should('have.class', 'checked');

		cy.window().then(win => {
			var acceptInput = win.canAcceptKeyboardInput();
			expect(acceptInput, 'Should accept input').to.equal(win.lastInputState);
		});
	});

	it('Apply underline, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Grab focus to the document
		cy.get('#document-container')
			.type('x');

		helper.selectAllText();

		cy.get('#tb_editbar_item_underline div table')
			.should('not.have.class', 'checked');

		cy.window().then(win => {
			win.lastInputState = win.canAcceptKeyboardInput();
		});

		cy.get('#tb_editbar_item_underline')
			.click();

		cy.get('#tb_editbar_item_underline div table')
			.should('have.class', 'checked');

		cy.window().then(win => {
			var acceptInput = win.canAcceptKeyboardInput();
			expect(acceptInput, 'Should accept input').to.equal(win.lastInputState);
		});
	});
});
