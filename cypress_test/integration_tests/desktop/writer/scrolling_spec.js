/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/scrolling.odt');
		desktopHelper.switchUIToCompact();

		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#sidebar').click({force: true});
	});

	it('Check if we jump the view on new page insertion', function() {
		desktopHelper.assertScrollbarPosition('vertical', 0, 10);
		helper.typeIntoDocument('{ctrl+enter}');
		helper.typeIntoDocument('{ctrl+enter}');

		cy.wait(500);
		desktopHelper.assertVisiblePage(2, 3, 6);

		desktopHelper.assertScrollbarPosition('vertical', 140, 160);
	});

	it('Scrolling to bottom/top', function() {
		desktopHelper.selectZoomLevel('40');
		helper.typeIntoDocument('{ctrl}{home}');
		//scroll to bottom
		desktopHelper.assertVisiblePage(1, 1, 4);
		desktopHelper.pressKey(1, 'pagedown');
		desktopHelper.assertVisiblePage(2, 2, 4);
		desktopHelper.pressKey(1, 'pagedown');
		desktopHelper.assertVisiblePage(3, 3, 4);
		desktopHelper.pressKey(1, 'pagedown');
		desktopHelper.assertVisiblePage(4, 4, 4);
		//scroll to top
		desktopHelper.pressKey(1, 'pageup');
		desktopHelper.assertVisiblePage(3, 3, 4);
		desktopHelper.pressKey(1, 'pageup');
		desktopHelper.assertVisiblePage(2, 2, 4);
		desktopHelper.pressKey(2, 'pageup');
		desktopHelper.assertVisiblePage(1, 1, 4);
	});

	it('Scrolling to left/right', function() {
		cy.cGet('#toolbar-down').click();
		desktopHelper.selectZoomLevel('200');
		//show horizontal scrollbar
		cy.cGet('.leaflet-layer').click('bottom');
		cy.wait(1000);
		helper.typeIntoDocument('{home}{end}{home}');
		cy.wait(1000);
		cy.cGet('#test-div-horizontal-scrollbar').should('have.text', '0');
		helper.typeIntoDocument('{end}{home}{end}');
		desktopHelper.assertScrollbarPosition('horizontal', 430, 653);
	});

	it('Check if we jump the view on change of formatting mark', function() {
		desktopHelper.switchUIToNotebookbar();

		desktopHelper.selectZoomLevel('40');
		helper.typeIntoDocument('{ctrl}{home}');
		desktopHelper.pressKey(2, 'pagedown');
		desktopHelper.pressKey(1, 'pagedown');
		desktopHelper.assertScrollbarPosition('vertical', 220, 240);

		// cursor on the bottom, scroll to top
		desktopHelper.scrollWriterDocumentToTop();
		desktopHelper.assertScrollbarPosition('vertical', 0, 10);

		cy.cGet('.notebookbar #View-tab-label').click();
		cy.cGet('.notebookbar #View-container .unoControlCodes').click();

		cy.cGet('.notebookbar #View-container .unoControlCodes').should('have.class', 'selected');
		desktopHelper.assertScrollbarPosition('vertical', 0, 10);
	});
});
