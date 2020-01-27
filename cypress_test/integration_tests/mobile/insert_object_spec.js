/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Insert objects via insertion wizard.', function() {
	beforeEach(function() {
		helper.loadTestDoc('empty.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		cy.get('.closemobile').click();
		cy.wait(200); // wait some time to actually release the document
	});

	it('Insert local image.', function() {
		// We check whether the entry is there
		cy.get('.menu-entry-with-icon')
			.contains('Local Image...');
		// We not not test the insertion, it might depend on the system.
	});

	it('Insert comment.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Comment')
			.click();

		// Comment insertion dialog is opened
		cy.get('.loleaflet-annotation-table')
			.should('exist');

		// Push cancel to close the dialog
		cy.get('.vex-dialog-button-secondary.vex-dialog-button.vex-last')
			.click();
	});

	it('Insert table.', function() {
		// Open Table submenu
		cy.get('.sub-menu-title')
			.contains('Table')
			.click();
		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Scroll to the bottom
		cy.get('#mobile-wizard-content').scrollTo(0, 1000);

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist')
			.should('have.length', 3);
		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('exist')
			.should('have.length', 2);
	});

	it('Insert field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();
		cy.get('.menu-entry-with-icon')
			.contains('Page Number')
			.click();

		// Do a selection to see something is inserted
		cy.get('body').type('{shift}{leftarrow}');
		cy.get('.leaflet-marker-icon')
			.should('exist')
			.should('have.length', 2);
	});

	it('Insert header.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigLeft = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1) ;
				cursorOrigLeft = cursor[0].getBoundingClientRect().left;
			});

		// Open header/footer submenu
		cy.get('.sub-menu-title')
			.contains('Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open header submenu
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget .sub-menu-title')
			.contains('Header')
			.click();

		// Insert header for All
		cy.get('.menu-entry-no-icon')
			.contains('All')
			.click();

		cy.wait(100);

		// Check that the cursor was moved
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				expect(cursor[0].getBoundingClientRect().left).to.be.lessThan(cursorOrigLeft);
			});
	});

	it('Insert footnote.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigTop = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				cursorOrigTop = cursor[0].getBoundingClientRect().top;
			});

		// Insert footnote
		cy.get('.menu-entry-with-icon')
			.contains('Footnote')
			.click();

		cy.wait(100);

		// Check that the cursor was moved down
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				expect(cursor[0].getBoundingClientRect().top).to.be.greaterThan(cursorOrigTop);
			});
	});

	it('Insert endnote.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigTop = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				cursorOrigTop = cursor[0].getBoundingClientRect().top;
			});

		// Insert endnote
		cy.get('.menu-entry-with-icon')
			.contains('Endnote')
			.click();

		cy.wait(100);

		// Check that the cursor was moved down
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				expect(cursor[0].getBoundingClientRect().top).to.be.greaterThan(cursorOrigTop);
			});
	});

	it('Insert page break.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigTop = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				cursorOrigTop = cursor[0].getBoundingClientRect().top;
			});

		// Insert endnote
		cy.get('.menu-entry-with-icon')
			.contains('Page Break')
			.click();

		cy.wait(100);

		// Check that the cursor was moved down
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				expect(cursor[0].getBoundingClientRect().top).to.be.greaterThan(cursorOrigTop);
			});
	});

	it('Insert column break.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigTop = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				cursorOrigTop = cursor[0].getBoundingClientRect().top;
			});

		// Do insertion
		cy.get('.menu-entry-with-icon')
			.contains('Column Break')
			.click();

		cy.wait(100);

		// Check that the cursor was moved down
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1);
				expect(cursor[0].getBoundingClientRect().top).to.be.greaterThan(cursorOrigTop);
			});
	});

	it('Insert hyperlink.', function() {
		// Open hyperlink dialog
		cy.get('.menu-entry-with-icon')
			.contains('Hyperlink...')
			.click();

		// Dialog is opened
		cy.get('.vex-content.hyperlink-dialog')
			.should('exist');

		// Push cancel to close the dialog
		cy.get('.vex-dialog-button-secondary.vex-dialog-button.vex-last')
			.click();
	});

	it('Insert shape.', function() {
		// Do insertion
		cy.get('.menu-entry-with-icon')
			.contains('Shape')
			.click();

		cy.get('.col.w2ui-icon.basicshapes_rectangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg).to.have.lengthOf(1);
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});

	it('Insert formatting mark.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Non-breaking space')
			.should('be.visible')
			.click();

		// Do a selection to see something is inserted
		cy.get('body').type('{shift}{leftarrow}');
		cy.get('.leaflet-marker-icon')
			.should('exist')
			.should('have.length', 2);
	});
});
