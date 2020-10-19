/* global describe it cy beforeEach require expect afterEach */

require('cypress-file-upload');

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Insert objects via insertion wizard.', function() {
	var testFileName = 'insert_object.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert local image.', function() {
		mobileHelper.openInsertionWizard();

		// We can't use the menu item directly, because it would open file picker.
		cy.contains('.menu-entry-with-icon', 'Local Image...')
			.should('be.visible');

		cy.get('#insertgraphic[type=file]')
			.attachFile('/mobile/writer/image_to_insert.png');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Insert comment.', function() {
		mobileHelper.openInsertionWizard();

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
		mobileHelper.openInsertionWizard();

		// Open Table submenu
		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
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

		writerMobileHelper.selectAllMobile();

		// Two rows
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		// Four cells
		cy.get('#copy-paste-container td')
			.should('have.length', 4);
	});

	it('Insert custom table.', function() {
		mobileHelper.openInsertionWizard();

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

		writerMobileHelper.selectAllMobile();

		// Three rows
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		// Nine cells
		cy.get('#copy-paste-container td')
			.should('have.length', 9);
	});

	it('Insert header.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xx{enter}');

		helper.typeText('body', 'xxxx', 500);

		helper.getCursorPos('left', 'cursorOrigLeft');

		mobileHelper.openInsertionWizard();

		// Open header/footer submenu
		cy.contains('.menu-entry-with-icon', 'Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open header submenu
		cy.contains('.ui-header.level-1.mobile-wizard.ui-widget', 'Header')
			.click();

		// Insert header for All
		cy.contains('.menu-entry-no-icon', 'All')
			.click();

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.lessThan(cursorOrigLeft);
					});
			});
	});

	it('Insert footer.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xxxx');

		helper.getCursorPos('top', 'cursorOrigTop');

		mobileHelper.openInsertionWizard();

		// Open header/footer submenu
		cy.contains('.menu-entry-with-icon', 'Header and Footer')
			.click();
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget')
			.should('be.visible');

		// Open footer submenu
		cy.contains('.ui-header.level-1.mobile-wizard.ui-widget', 'Footer')
			.click();

		// Insert footer for All
		cy.contains('.ui-content.level-1.mobile-wizard[title~="Footer"] .ui-header.level-2.mobile-wizard.ui-widget .menu-entry-no-icon', 'All')
			.click();

		// Check that the cursor was moved
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});
	});

	it('Insert footnote.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xxxx');

		helper.getCursorPos('top', 'cursorOrigTop');

		mobileHelper.openInsertionWizard();

		// Insert footnote
		cy.contains('.menu-entry-with-icon', 'Footnote')
			.click();

		// Check that the cursor was moved
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});
	});

	it('Insert endnote.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xxxx');

		helper.getCursorPos('top', 'cursorOrigTop');

		mobileHelper.openInsertionWizard();

		// Insert endnote
		cy.contains('.menu-entry-with-icon', 'Endnote')
			.click();

		// Check that the cursor was moved
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});
	});

	it('Insert page break.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xxxx');

		helper.getCursorPos('top', 'cursorOrigTop');

		mobileHelper.openInsertionWizard();

		// Insert page break
		cy.contains('.menu-entry-with-icon', 'Page Break')
			.click();

		// Check that the cursor was moved
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});
	});

	it('Insert column break.', function() {
		// Get the blinking cursor pos
		helper.typeIntoDocument('xxxx');

		helper.getCursorPos('top', 'cursorOrigTop');

		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.contains('.menu-entry-with-icon', 'Column Break')
			.click();

		// Check that the cursor was moved
		cy.get('@cursorOrigTop')
			.then(function(cursorOrigTop) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.greaterThan(cursorOrigTop);
					});
			});
	});

	it('Insert hyperlink.', function() {
		mobileHelper.openInsertionWizard();

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

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nsome text');

		cy.get('#copy-paste-container p a')
			.should('have.attr', 'href', 'http://www.something.com/');
	});

	it('Insert shape.', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.contains('.menu-entry-with-icon', 'Shape')
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
