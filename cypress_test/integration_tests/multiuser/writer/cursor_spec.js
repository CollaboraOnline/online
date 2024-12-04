/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var searchHelper = require('../../common/search_helper.js');

describe(['tagmultiuser'], 'Check cursor and view behavior', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/cursor_jump.odt', true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Do not center the view if cursor is already visible', function() {
		// second view follow the first one
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#userListHeader').click();
		cy.cGet('.user-list-item').eq(1).click();
		cy.cGet('.jsdialog-overlay').should('not.exist');
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);

		// first view goes somewhere down
		cy.cSetActiveFrame('#iframe1');
		searchHelper.typeIntoSearchField('P'); // avoid focus loss
		searchHelper.typeIntoSearchField('Pellentesque porttitor');
		desktopHelper.assertScrollbarPosition('vertical', 375, 385);

		// verify that second view is scrolled to the editor
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 375, 385);

		// now move cursor a bit in the first view
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#map').type('{downArrow}{downArrow}{downArrow}{downArrow}{downArrow}{downArrow}');

		// verify that second view is still at the same position (no jump)
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 375, 385);
	});
});
