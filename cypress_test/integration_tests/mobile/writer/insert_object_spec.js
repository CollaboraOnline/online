/* global describe it cy beforeEach require expect afterEach Cypress*/

import 'cypress-wait-until';

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Insert objects via insertion wizard.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('insert_object.odt', 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Local Image...')
			.should('be.visible');
		// We not not test the insertion, it might depend on the system.
	});

	it('Insert comment.', function() {
		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		helper.selectItemByContent('.menu-entry-with-icon', 'Comment')
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
		helper.selectItemByContent('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
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
		helper.selectItemByContent('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open header submenu
		helper.selectItemByContent('.ui-header.level-1.mobile-wizard.ui-widget', 'Header')
			.click();

		// Insert header for All
		helper.selectItemByContent('.menu-entry-no-icon', 'All')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open footer submenu
		helper.selectItemByContent('.ui-header.level-1.mobile-wizard.ui-widget', 'Footer')
			.click();

		// Insert footer for All
		helper.selectItemByContent('.ui-content.level-1.mobile-wizard[title~="Footer"] .ui-header.level-2.mobile-wizard.ui-widget .menu-entry-no-icon', 'All')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Footnote')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Endnote')
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

		// Insert page break
		helper.selectItemByContent('.menu-entry-with-icon', 'Page Break')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Column Break')
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
		helper.selectItemByContent('.menu-entry-with-icon', 'Hyperlink...')
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
			.should('have.text', '\nsome text');

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
		helper.selectItemByContent('.menu-entry-with-icon', 'Shape')
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
