/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Impress insertion wizard.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('insertion_wizard.odp', 'impress');

		mobileHelper.enableEditingMobile();

		mobileHelper.openInsertionWizard();
	});

	afterEach(function() {
		helper.afterAll('insertion_wizard.odp');
	});

	it('Check existence of image insertion items.', function() {
		cy.contains('.menu-entry-with-icon', 'Local Image...')
			.should('be.visible');

		cy.contains('.menu-entry-with-icon', 'Image...')
			.should('be.visible');
	});

	it('Insert comment.', function() {
		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		// Comment insertion dialog is opened
		cy.get('.loleaflet-annotation-table')
			.should('exist');

		// Add some comment
		cy.get('.loleaflet-annotation-textarea')
			.type('some text');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation-content.loleaflet-dont-break')
			.should('have.text', 'some text');
	});

	it('Insert default table.', function() {
		// Open Table submenu
		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
			.click();

		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// We have two columns
		cy.get('.table-column-resize-marker')
			.should('have.length', 2);

		// and two rows
		cy.get('.table-row-resize-marker')
			.should('have.length', 2);
	});

	it('Insert custom table.', function() {
		// Open Table submenu
		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
			.click();
		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Change rows and columns
		cy.get('.inserttablecontrols #rows .spinfieldcontrols .plus')
			.click();
		cy.get('.inserttablecontrols #cols .spinfieldcontrols .plus')
			.click();

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		// We have three columns
		cy.get('.table-column-resize-marker')
			.should('have.length', 3);

		// and three rows
		cy.get('.table-row-resize-marker')
			.should('have.length',3);
	});

	it('Insert hyperlink.', function() {
		// Open hyperlink dialog
		cy.contains('.menu-entry-with-icon', 'Hyperlink...')
			.click();

		// Dialog is opened
		cy.get('.vex-content.hyperlink-dialog')
			.should('exist');

		// Type text and link
		cy.get('.vex-content.hyperlink-dialog input[name="text"]')
			.type('some text');
		cy.get('.vex-content.hyperlink-dialog input[name="link"]')
			.type('www.something.com');

		// Insert
		cy.get('.vex-content.hyperlink-dialog .vex-dialog-button-primary')
			.click();

		// TODO: we have some wierd shape here instead of a text shape with the link
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g path.leaflet-interactive')
			.should('exist');
	});

	it('Insert shape.', function() {
		cy.contains('.menu-entry-with-icon', 'Shape')
			.click();

		cy.get('.col.w2ui-icon.basicshapes_rectangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.should(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});
});
