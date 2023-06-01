/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe.skip(['tagmultiuser'], 'Sidebar visibility', function() {
	var origTestFileName = 'sidebar_visibility.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function testSidebarVisiblity(frameId1 ,frameId2) {
		// Visible by default
		cy.cSetActiveFrame(frameId1);
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');
		desktopHelper.hideSidebar();

		//sidebar should be visible of user-2
		cy.cSetActiveFrame(frameId2);
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');

		// Show sidebar again
		cy.cSetActiveFrame(frameId1);
		desktopHelper.showSidebar();

		cy.cSetActiveFrame(frameId2);
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	}
	it('Show/hide sidebar:user-1', function() {
		testSidebarVisiblity('#iframe1', '#iframe2');
	});

	it('Show/hide sidebar:user-2', function() {
		testSidebarVisiblity('#iframe2', '#iframe1');
	});

});
