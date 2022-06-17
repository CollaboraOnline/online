/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Scroll through document', function() {
	var testFileName = 'scrolling.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_sidebar')
			.click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Scrolling to bottom/top', function() {
		desktopHelper.assertScrollbarPosition('vertical', 26, 29);

		desktopHelper.pressKey(3,'pagedown');

		desktopHelper.assertScrollbarPosition('vertical', 191, 224);

		desktopHelper.pressKey(3,'pageup');

		desktopHelper.assertScrollbarPosition('vertical', 26, 29);
	});

	it('Scrolling to left/right', function() {
		desktopHelper.selectZoomLevel('200');

		helper.typeIntoDocument('{home}');

		desktopHelper.assertScrollbarPosition('horizontal', 55, 68);

		helper.typeIntoDocument('{end}');

		cy.wait(500);

		desktopHelper.assertScrollbarPosition('horizontal', 129, 155);
	});
});
