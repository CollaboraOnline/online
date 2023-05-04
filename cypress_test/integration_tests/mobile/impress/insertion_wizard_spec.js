/* global describe it cy beforeEach require expect afterEach Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud'], 'Impress insertion wizard.', function() {
	var origTestFileName = 'insertion_wizard.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectionShouldBeTextShape(checkShape) {
		// Check that the shape is there
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg')
			.should(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});

		if (checkShape) {
			cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Page g')
				.should('be.visible');
		}

		// Check also that the shape is fully visible
		// TODO: shapes are hungs out of the slide after insertion
		/*cy.get('svg g .leaflet-interactive')
			.should(function(items) {
				expect(items.offset().top).to.be.greaterThan(0);
				expect(items.offset().left).to.be.greaterThan(0);
			});*/
	}

	function stepIntoTextShapeEditing() {
		// Click on the center of the slide to step into text edit mode
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.cGet('body').dblclick(XPos, YPos);
			});

		cy.cGet('.leaflet-cursor.blinking-cursor')
			.should('exist');
	}

	it('Insert local image.', function() {
		mobileHelper.openInsertionWizard();

		// We can't use the menu item directly, because it would open file picker.
		cy.cGet('body').contains('.menu-entry-with-icon', 'Local Image...').should('be.visible');
		cy.cGet('#insertgraphic[type=file]').attachFile('/mobile/impress/image_to_insert.png');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
	});

	it('Insert comment.', function() {
		mobileHelper.openInsertionWizard();

		cy.cGet('body').contains('.menu-entry-with-icon', 'Comment').click();

		// Comment insertion dialog is opened
		cy.cGet('#mobile-wizard-content-modal-dialog-new-annotation-dialog').should('exist');
		cy.cGet('#input-modal-input').type('some text');
		cy.cGet('#response-ok').click();
		cy.cGet('#comment-container-1').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
	});

	it('Insert default table.', function() {
		mobileHelper.openInsertionWizard();

		// Open Table submenu
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table').click();
		cy.cGet('.mobile-wizard.ui-text').should('be.visible');
		cy.cGet('.inserttablecontrols button').should('be.visible').click();

		// We have two columns
		cy.cGet('.table-column-resize-marker').should('have.length', 2);

		// and two rows
		cy.cGet('.table-row-resize-marker').should('have.length', 2);
	});

	it('Insert custom table.', function() {
		mobileHelper.openInsertionWizard();

		// Open Table submenu
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table').click();
		cy.cGet('.mobile-wizard.ui-text').should('be.visible');

		// Change rows and columns
		cy.cGet('.inserttablecontrols #rows .spinfieldcontrols .plus').click();
		cy.cGet('.inserttablecontrols #cols .spinfieldcontrols .plus').click();

		// Push insert table button
		cy.cGet('.inserttablecontrols button').should('be.visible').click();

		// Table is inserted with the markers shown
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('exist');

		// We have three columns
		cy.cGet('.table-column-resize-marker').should('have.length', 3);

		// and three rows
		cy.cGet('.table-row-resize-marker').should('have.length',3);
	});

	it('Insert hyperlink.', function() {
		mobileHelper.openInsertionWizard();
		// Open hyperlink dialog
		cy.cGet('body').contains('.menu-entry-with-icon', 'Hyperlink...').click();
		// Dialog is opened
		cy.cGet('#hyperlink-link-box').should('exist');
		// Type text and link
		cy.cGet('#hyperlink-text-box').type('some text');
		cy.cGet('#hyperlink-link-box').type('www.something.com');
		// Insert
		cy.cGet('#response-ok').click();
		// TODO: we have some wierd shape here instead of a text shape with the link
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g path.leaflet-interactive').should('exist');
	});

	it('Insert shape.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Shape').click();
		cy.cGet('.col.w2ui-icon.basicshapes_rectangle').click();
		// Check that the shape is there
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg')
			.should(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});

	it('Insert text box.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Text Box').click();
		// Check that the shape is there
		selectionShouldBeTextShape();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('Tap to edit text');
	});

	it('Insert date field (fixed).', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date (fixed)').click();
		// Check that the shape is there
		selectionShouldBeTextShape(false);
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a date in MM/DD/YY format
		var regex = /\d{1,2}[/]\d{1,2}[/]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert date field (variable).', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date (variable)').click();
		// Check that the shape is there
		selectionShouldBeTextShape(false);
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a date in MM/DD/YY format
		var regex = /\d{1,2}[/]\d{1,2}[/]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert time field (fixed).', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time (fixed)').click();
		// Check that the shape is there
		selectionShouldBeTextShape(false);
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a time in HH/MM/SS format
		var regex = /\d{1,2}[:]\d{1,2}[:]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert time field (variable).', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time (variable)').click();
		// Check that the shape is there
		selectionShouldBeTextShape(false);
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a time in HH/MM/SS format
		var regex = /\d{1,2}[:]\d{1,2}[:]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert slide number.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Number').click();
		// Check that the shape is there
		selectionShouldBeTextShape();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('1');
	});

	it('Insert slide title.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Title').click();
		// Check that the shape is there
		selectionShouldBeTextShape();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('Slide 1');
	});

	it('Insert slide count.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Count').click();
		// Check that the shape is there
		selectionShouldBeTextShape();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('1');
	});

	it('Insert hyperlink inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		// Open hyperlink dialog
		cy.cGet('body').contains('.menu-entry-with-icon', 'Hyperlink...').click();
		// Dialog is opened
		cy.cGet('#hyperlink-link-box').should('exist');
		// Type text and link
		cy.cGet('#hyperlink-text-box').type('some text');
		cy.cGet('#hyperlink-link-box').type('www.something.com');
		// Insert
		cy.cGet('#response-ok').click();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('some text');
		cy.cGet('.leaflet-popup-content a').should('have.text', 'http://www.something.com');
	});

	it('Insert date field (fixed) inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date (fixed)').click();
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a date in MM/DD/YY format
		var regex = /\d{1,2}[/]\d{1,2}[/]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert date field (variable) inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date (variable)').click();
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a date in MM/DD/YY format
		var regex = /\d{1,2}[/]\d{1,2}[/]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert time field (fixed) inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time (fixed)').click();
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a time in HH/MM/SS format
		var regex = /\d{1,2}[:]\d{1,2}[:]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert time field (variable) inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time (variable)').click();
		// Check the text
		impressHelper.selectTextOfShape();
		// Check that we have a time in HH/MM/SS format
		var regex = /\d{1,2}[:]\d{1,2}[:]\d{1,2}/;
		helper.matchClipboardText(regex);
	});

	it('Insert slide number inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Number').click();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('1');
	});

	it('Insert slide title inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Title').click();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('Slide 1');
	});

	it('Insert slide count inside existing text shape.', function() {
		stepIntoTextShapeEditing();
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'More Fields...').click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Slide Count').click();
		// Check the text
		impressHelper.selectTextOfShape();
		helper.expectTextForClipboard('1');
	});

	it('Insert new slide with plus button.', function() {
		impressHelper.assertNumberOfSlidePreviews(1);
		cy.cGet('body').contains('.leaflet-control-zoom-in', '+').should('be.visible');
		cy.cGet('body').contains('.leaflet-control-zoom-in', '+').click();
		impressHelper.assertNumberOfSlidePreviews(2);
		if (Cypress.env('INTEGRATION') !== 'nextcloud') {
			cy.cGet('#toolbar-mobile-back').click();
			cy.cGet('.leaflet-control-zoom-in').should('not.exist');
		}
	});
});
