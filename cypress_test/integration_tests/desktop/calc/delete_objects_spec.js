/* global describe it cy require beforeEach expect Cypress*/
var helper = require('../../common/helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/delete_objects.ods');
		desktopHelper.switchUIToCompact();
	});

	it('Delete Text', function() {
		helper.setDummyClipboardForCopy();

		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.copy();
		helper.expectTextForClipboard('text');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		desktopHelper.getCompactIconArrow('DefaultNumbering').click();

		desktopHelper.getCompactIcon('BasicShapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();

		cy.cGet('#test-div-shapeHandlesSection')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('#test-div-shapeHandlesSection')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		desktopHelper.getCompactIconArrow('DefaultNumbering').click();

		//insert
		desktopHelper.getCompactIcon('InsertObjectChart').click();
		cy.cGet('.ui-pushbutton.jsdialog.button-primary').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		cy.cGet('.jsdialog-overlay').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');
		cy.wait(300);
		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});
});
