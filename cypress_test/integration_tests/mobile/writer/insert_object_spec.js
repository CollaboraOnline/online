/* global describe it cy beforeEach require expect afterEach Cypress*/

var helper = require('../../common/helper');
var writerHelper = require('./writer_helper');

describe('Insert objects via insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('insert_object.odt', 'writer');

		// Click on edit button
		helper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll('insert_object.odt');
	});

	it('Insert local image.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// We check whether the entry is there
		cy.get('.menu-entry-with-icon')
			.contains('Local Image...');
		// We not not test the insertion, it might depend on the system.
	});

	it('Insert comment.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		cy.get('.menu-entry-with-icon')
			.contains('Comment')
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
		// TODO: Select all does not work with core/master
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open Table submenu
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget')
			.contains('Table')
			.click();
		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		writerHelper.copyTableToClipboard();

		// Two rows
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		// Four cells
		cy.get('#copy-paste-container td')
			.should('have.length', 4);
	});

	it('Insert custom table.', function() {
		// TODO: Select all does not work with core/master
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open Table submenu
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget')
			.contains('Table')
			.click();
		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Change rows and columns
		cy.get('.inserttablecontrols #rows .sinfieldcontrols .plus')
			.click();
		cy.get('.inserttablecontrols #cols .sinfieldcontrols .plus')
			.click();

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		writerHelper.copyTableToClipboard();

		// Three rows
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		// Nine cells
		cy.get('#copy-paste-container td')
			.should('have.length', 9);
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

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open header/footer submenu
		cy.get('.menu-entry-with-icon')
			.contains('Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open header submenu
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.contains('Header')
			.click();

		// Insert header for All
		cy.get('.menu-entry-no-icon')
			.contains('All')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().left < cursorOrigLeft;
				});
		});
	});

	it('Insert footer.', function() {
		// Get the blinking cursor pos
		cy.get('#document-container').type('xxxx');
		var cursorOrigTop = 0;
		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1) ;
				cursorOrigTop = cursor[0].getBoundingClientRect().top;
			});

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open header/footer submenu
		cy.get('.menu-entry-with-icon')
			.contains('Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open footer submenu
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.contains('Footer')
			.click();

		// Insert footer for All
		cy.get('.ui-content.level-1.mobile-wizard[title~="Footer"] .ui-header.level-2.mobile-wizard.ui-widget .menu-entry-no-icon')
			.contains('All')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().top > cursorOrigTop;
				});
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

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Insert footnote
		cy.get('.menu-entry-with-icon')
			.contains('Footnote')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().top > cursorOrigTop;
				});
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

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Insert endnote
		cy.get('.menu-entry-with-icon')
			.contains('Endnote')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().top > cursorOrigTop;
				});
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

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Insert endnote
		cy.get('.menu-entry-with-icon')
			.contains('Page Break')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().top > cursorOrigTop;
				});
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

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Do insertion
		cy.get('.menu-entry-with-icon')
			.contains('Column Break')
			.click();

		// Check that the cursor was moved
		cy.waitUntil(function() {
			return cy.get('.blinking-cursor')
				.then(function(cursor) {
					expect(cursor).to.have.lengthOf(1);
					return cursor[0].getBoundingClientRect().top > cursorOrigTop;
				});
		});
	});

	it('Insert hyperlink.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open hyperlink dialog
		cy.get('.menu-entry-with-icon')
			.contains('Hyperlink...')
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

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.contains('some text');

		cy.get('#copy-paste-container p a')
			.should('have.attr', 'href', 'http://www.something.com/');
	});

	it('Insert shape.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

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
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});
});
