/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagmultiuser'], 'Check following the other views', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/following.ods',true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Stop following on click', function() {
		// second view follow the first one
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#userListHeader').click();
		cy.cGet('.user-list-item').eq(1).click();
		cy.cGet('.jsdialog-overlay').should('not.exist');

		// second view clicks on the cell
		cy.cGet('#followingChip').should('be.visible');
		calcHelper.clickOnFirstCell();

		// following is off
		cy.cGet('#followingChip').should('not.be.visible');
	});
});
