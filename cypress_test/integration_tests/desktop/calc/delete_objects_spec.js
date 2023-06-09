/* global describe it cy require afterEach beforeEach expect Cypress*/
var helper = require('../../common/helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {
	var origTestFileName = 'delete_objects.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		desktopHelper.switchUIToCompact();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Delete Text', function() {

		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.expectTextForClipboard('text');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();

		cy.cGet('#tb_editbar_item_insertshapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertobjectchart').click();
		cy.cGet('.ui-pushbutton.jsdialog.button-primary').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('exist');
		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('not.exist');
	});
});
