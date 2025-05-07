/* global describe it cy beforeEach require */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Sidebar tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/sidebar.odt');
	});

	it('Sidebar visual test', function() {
		cy.wait(500); // wait to make fully rendered
		cy.cGet('#sidebar-dock-wrapper').scrollTo(0,0,{ ensureScrollable: false });
		cy.wait(500); // wait for animations
		cy.cGet('#sidebar-dock-wrapper').compareSnapshot('sidebar_writer', 0.065);
	});
});
