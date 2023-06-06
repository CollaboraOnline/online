/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage } = require('../../common/desktop_helper');

describe.skip(['tagdesktop'], 'Navigator tests.', function () {
	var origTestFileName = 'navigator.ods';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		cy.cGet('#menu-view').click();
		cy.cGet('#menu-navigator').click();
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Jump to element. Navigator -> Document', function() {
		// Doubleclick several items, and check if the view is jumed to there
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Comment1').dblclick();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'O81');
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 3 of 24');

		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Sheet22').dblclick();
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 22 of 24');

		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'rName1').dblclick();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'rName1');
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 2 of 24');

		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'dRange').dblclick();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'S21:T22');
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 3 of 24');
	});

	// Clicking Document item does not select Navigator entry, not even in desktop app, so no need to test

	it('Rename sheet -> updated in Navigator', function () {
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').rightclick();
		cy.cGet('body').contains('.context-menu-link', 'Rename Sheet...').click();
		cy.cGet('#modal-dialog-rename-calc-sheet').should('exist');
		cy.cGet('#input-modal-input').clear().type('renameSheet');
		cy.cGet('#response-ok').click();
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'renameSheet');
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'renameSheet').should('exist');
	});

	it('create items -> updated in Navigator', function () {
		// Create a new Range name
		cy.cGet('#menu-data').click();
		cy.cGet('#menu-data').contains('.has-submenu', 'Named Ranges and Expressions').parent().click();
		cy.cGet('#menu-data').contains('Define...').parent().click();
		cy.cGet('#DefineNameDialog').find('#edit').clear().type('rName2');
		cy.cGet('#DefineNameDialog').find('#range').clear().type('$Sheet5.$C$55:$C$56');
		cy.cGet('#DefineNameDialog').find('#add').click();

		// Check if it exist in Navigator
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'rName2').should('exist');

		// Check if clicking on it will move cursor there
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'rName2').dblclick();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'rName2');
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 5 of 24');

		// Insert a comment
		cy.cGet('#menu-insert').click();
		cy.cGet('#menu-insertcomment').click();
		cy.cGet('#comment-container-new').type('commentNew');
		// We should click Save, but i could not check its name because clickin in ispector remove the dialog-rename-calc-sheet
		// But any cind of click will result the same
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'rName2').dblclick();
		// Check if the commentNew is in the Navigator
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'commentNew').should('exist');

		// Insert an image
		insertImage('calc');
		// Check if it exist in Navigator
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Image 1').should('exist');
		// Delete the image, and check that is not in the Navigator
		deleteImage();
		cy.cGet('#contentbox').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Image 1').should('not.exist');
	});
});
