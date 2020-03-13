/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');

describe('Focus tests', function() {
	beforeEach(function() {
		helper.beforeAllMobile('focus.odt', 'writer');
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Basic document focus.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled');

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
		cy.get('#mobile-edit-button').click();

		// Open comment insertion dialog
		cy.get('#tb_actionbar_item_insertcomment')
			.should('not.have.class', 'disabled')
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
		cy.get('#mobile-edit-button').click();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Body should have the focus (no focus on document)
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus inside mobile wizard.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.0')
			.click();

		// The spinfield should have the focus now.
		cy.document().its('activeElement.className')
			.should('be.eq', 'spinfield');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus after insertion.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
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
		cy.get('#mobile-edit-button').click();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
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
					.dblclick(posX, posY);
			});

		// Document grabs the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	});

	it('Focus with hamburger menu.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		// Open hamburger menu
		cy.get('#toolbar-hamburger')
			.click();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Close hamburger menu
		cy.get('#toolbar-hamburger')
			.click();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});

	it('Focus after applying font change.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Click in the document
		cy.get('#document-container')
			.click();

		// Clipboard has the focus -> can type in the document
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

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

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('not.have.class', 'checked');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});
});
