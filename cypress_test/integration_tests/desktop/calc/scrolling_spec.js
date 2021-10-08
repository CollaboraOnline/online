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
		desktopHelper.assertScrollbarPosition('vertical', [29, 26]);

		desktopHelper.pressKey(3,'pagedown');

		desktopHelper.assertScrollbarPosition('vertical', [224, 201, 191]);

		desktopHelper.pressKey(3,'pageup');

		desktopHelper.assertScrollbarPosition('vertical', [29, 26]);
	});

	it('Scrolling to left/right', function() {
		desktopHelper.selectZoomLevel('150');

		helper.typeIntoDocument('{home}{end}{home}');

		desktopHelper.assertScrollbarPosition('horizontal', [62, 55]);

		helper.typeIntoDocument('{end}{home}{end}');

		desktopHelper.assertScrollbarPosition('horizontal', [79, 67, 68]);
	});

});
