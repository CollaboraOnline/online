/* global describe it cy require beforeEach expect Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/delete_objects.odp');
		desktopHelper.switchUIToCompact();
	});

	it('Delete Text', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#document-container').dblclick('center');
		cy.cGet('#document-container svg g').should('exist');
		cy.wait(500);
		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.copy();
		helper.expectTextForClipboard('text');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Delete Text From Second Page', function() {
		// Insert second page.
		cy.cGet('#insertpage-button').click();

		// Check / wait for the inserted page.
		cy.cGet('#preview-img-part-1').should('exist');

		// Activate the inserted page.
		cy.cGet('#preview-img-part-1').click();

		// Click on canvas to activate the document.
		cy.cGet('#document-canvas').click(100, 100);

		// Press delete button. If the document is correctly activated, the second page shouldn't be deleted.
		helper.typeIntoDocument('{del}');

		// Wait until server has processed the delete command.
		cy.getFrameWindow().then((win) => {
			helper.processToIdle(win);
		});

		// Check if the second page still exists.
		cy.cGet('#preview-img-part-1').should('exist');
	});

	it('Delete Shapes', function() {
		//insert
		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		desktopHelper.getCompactIconArrow('BasicShapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');

		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});

	it('Delete Chart' , function() {
		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		//insert
		desktopHelper.getCompactIcon('InsertObjectChart').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');
		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});

	it('Delete Table',function() {
		desktopHelper.selectZoomLevel('50', false);

		cy.cGet('#menu-table').click();
		cy.cGet('body').contains('Insert Table...').click();
		cy.cGet('.lokdialog_canvas').click();

		helper.typeIntoDocument('{shift}{enter}');

		// Table is inserted with the markers shown
		cy.cGet('.table-column-resize-marker').should('exist');
		cy.cGet('#test-div-shapeHandlesSection').then(function(element) {
			const x = element[0].getBoundingClientRect().left;
			const y = element[0].getBoundingClientRect().top;

			cy.cGet('body').rightclick(x + 20, y + 20);
		});

		cy.cGet('body').contains('.context-menu-item', 'Delete').click();
		cy.cGet('.table-column-resize-marker').should('not.exist');
	});

	it('Delete Fontwork', function() {
		cy.cGet('#menu-insert').click();
		cy.cGet('body').contains('a','Fontwork...').click();
		cy.cGet('#ok').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});
});
