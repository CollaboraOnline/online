/* global describe it cy beforeEach require Cypress expect */

var helper = require('../../common/helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagredline', 'tagnextcloud', 'tagproxy'], 'Track Changes as comments', function() {

	beforeEach(function () {
		cy.viewport(1400, 600);
		helper.setupAndLoadDocument('writer/track_changes.odt');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up [id^="sidebar"] button:visible').click();
		desktopHelper.selectZoomLevel('50', false);
	})
})
