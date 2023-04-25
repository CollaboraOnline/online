/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {
	var testFileName = 'scrolling.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_modifypage').click();
		desktopHelper.selectZoomLevel('200');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function clickOnTheCenter() {
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.cGet('body')
					.dblclick(XPos, YPos)
					.wait(500);
			});
	}
	it('Scrolling to bottom/top', function() {
		//show vertical scrollbar
		cy.cGet('.leaflet-layer').click('right');
		cy.wait(1000);
		clickOnTheCenter();
		desktopHelper.pressKey(9,'uparrow');
		cy.cGet('#test-div-vertical-scrollbar').should('have.text', '0');
		desktopHelper.pressKey(18,'downarrow');
		desktopHelper.assertScrollbarPosition('vertical', 306, 355);
	});

	it('Scrolling to left/right', function() {
		//show horizontal scrollbar
		cy.cGet('.leaflet-layer').click('bottom');
		cy.wait(500);
		clickOnTheCenter();
		cy.wait(500);
		helper.typeIntoDocument('{home}');
		cy.cGet('#test-div-horizontal-scrollbar').should('have.text', '0').wait(500);
		helper.typeIntoDocument('{end}');
		desktopHelper.assertScrollbarPosition('horizontal', 540, 660);
	});
});
