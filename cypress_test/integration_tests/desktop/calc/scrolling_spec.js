/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/scrolling.ods');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#sidebar').click({force: true});
	});

	it('Scrolling to bottom/top', function() {
		desktopHelper.assertScrollbarPosition('vertical', 19, 21);
		desktopHelper.pressKey(3,'pagedown');
		desktopHelper.assertScrollbarPosition('vertical', 170, 200);
		desktopHelper.pressKey(3,'pageup');
		desktopHelper.assertScrollbarPosition('vertical', 19, 21);
	});

	it('Scrolling to left/right', function() {
		desktopHelper.selectZoomLevel('200');
		helper.typeIntoDocument('{home}');
		desktopHelper.assertScrollbarPosition('horizontal', 48, 60);
		helper.typeIntoDocument('{end}');
		cy.wait(500);
		desktopHelper.assertScrollbarPosition('horizontal', 250, 320);
	});
});
