/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {
	var testFileName = 'scrolling.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
		desktopHelper.switchUIToCompact();

		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_sidebar').click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Scrolling to bottom/top', function() {
		desktopHelper.selectZoomLevel('40');
		helper.typeIntoDocument('{ctrl}{home}');
		//scroll to bottom
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 4');
		desktopHelper.pressKey(2, 'pagedown');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 4');
		desktopHelper.pressKey(1, 'pagedown');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 3 of 4');
		desktopHelper.pressKey(1, 'pagedown');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 4 of 4');
		//scroll to top
		desktopHelper.pressKey(1, 'pageup');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 3 of 4');
		desktopHelper.pressKey(1, 'pageup');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 4');
		desktopHelper.pressKey(2, 'pageup');
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 4');
	});

	it('Scrolling to left/right', function() {
		cy.cGet('#toolbar-down').click();
		desktopHelper.selectZoomLevel('200');
		//show horizontal scrollbar
		cy.cGet('.leaflet-layer').click('bottom');
		cy.wait(500);
		helper.typeIntoDocument('{home}{end}{home}');
		cy.cGet('#test-div-horizontal-scrollbar').should('have.text', '0');
		helper.typeIntoDocument('{end}{home}{end}');
		desktopHelper.assertScrollbarPosition('horizontal', 570, 653);
	});
});
