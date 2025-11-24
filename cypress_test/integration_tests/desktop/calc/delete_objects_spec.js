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
		cy.cGet('#toolbar-up #overflow-button-other-toptoolbar .arrowbackground').click();

		cy.cGet('#insertshapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();

		cy.cGet('#test-div-shapeHandlesSection')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('#test-div-shapeHandlesSection')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		// Insert chart button not visible yet so click on the overflow button.
		cy.cGet('#toolbar-up #overflow-button-other-toptoolbar .arrowbackground').click();
		// Click on insert chart button.
		cy.cGet('#insertobjectchart').click();
		// Click on the ok button of chart jsdialog.
		cy.cGet('.ui-pushbutton.jsdialog.button-primary').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		// Close the overflow toolbar. Doing this before closing the chart jsdialog does not work.
		cy.cGet('.jsdialog-overlay').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');
		// delete
		helper.typeIntoDocument('{del}');
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});
});
