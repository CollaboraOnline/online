/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagmultiuser'], 'Check cell cursor and view behavior', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/cell_cursor_jump.ods',true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Jump on modification above in the sheet', function() {
		// second view follow the first one
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#userListHeader').click();
		cy.cGet('.user-list-item').eq(1).click();
		cy.cGet('.jsdialog-overlay').should('not.exist');

		// first view goes somewhere in the middle of a sheet: A400
		cy.cSetActiveFrame('#iframe1');

		cy.cGet(helper.addressInputSelector).type('{selectAll}A400{enter}');
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);
		cy.cGet('#sc_input_window .ui-custom-textarea-text-layer').click();
		cy.cGet('#sc_input_window .ui-custom-textarea-text-layer').type('some text{enter}');

		// turn off following in the second view
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#followingChip').click();

		// verify that second view is scrolled to the: A400
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);

		// second view should still have cursor at the end: A588
		cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A588');

		// now insert row in the first view
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#home-insert-rows-before img').click({force: true});

		// verify that second view is still at the: A400
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);

		// second view should still have cursor at the previous cell: A588+1
		cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A589');
	});

	it('Jump to the other sheet', function() {
		// second view follow the first one
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#userListHeader').click();
		cy.cGet('.user-list-item').eq(1).click();
		cy.cGet('.jsdialog-overlay').should('not.exist');

		// first view goes somewhere in the middle of a sheet
		cy.cSetActiveFrame('#iframe1');

		cy.cGet(helper.addressInputSelector).type('{selectAll}A400{enter}');
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);
		calcHelper.clickOnFirstCell(true, false, false);
		cy.cGet('#map').type('abc{enter}');

		// second view should jump there
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);

		// first view inserts sheet before current one
		cy.cSetActiveFrame('#iframe1');
		calcHelper.selectOptionFromContextMenu('Insert sheet before this');
		cy.cGet('#map').focus();

		// we should see A1
		cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A1');
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);

		// verify that second view followed the first one
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);

		// first goes to second sheet and we should see A388
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#spreadsheet-tab1').click();
		desktopHelper.assertScrollbarPosition('vertical', 185, 240);
	});
});
