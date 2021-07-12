/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Sidebar visibility', function() {
	var testFileName = 'sidebar_visibility.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function testSidebarVisiblity(frameId1 ,frameId2) {
		// Visible by default
		cy.customGet('#sidebar-dock-wrapper', frameId1)
			.should('be.visible');

		desktopHelper.hideSidebar(frameId1);

		//sidebar should be visible of user-2
		cy.customGet('#sidebar-dock-wrapper', frameId2)
			.should('be.visible');

		// Show sidebar again
		desktopHelper.showSidebar(frameId1);

		cy.customGet('#sidebar-dock-wrapper', frameId2)
			.should('be.visible');
	}
	it('Show/hide sidebar:user-1', function() {
		testSidebarVisiblity('#iframe1', '#iframe2');
	});

	it('Show/hide sidebar:user-2', function() {
		testSidebarVisiblity('#iframe2', '#iframe1');
	});

});
