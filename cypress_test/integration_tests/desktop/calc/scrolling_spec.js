/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {
	var testFileName = 'scrolling.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_sidebar').click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
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
		desktopHelper.assertScrollbarPosition('horizontal', 250, 270);
	});
});
