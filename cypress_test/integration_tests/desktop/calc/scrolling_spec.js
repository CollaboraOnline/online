/* global describe it cy beforeEach expect require */

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
		desktopHelper.assertScrollbarPosition('vertical', 200, 230);
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

	it('Scroll while selecting vertically', function() {
		desktopHelper.assertScrollbarPosition('vertical', 19, 21);
		desktopHelper.assertScrollbarPosition('horizontal', 48, 50);

		// Click on a cell near the edge of the view
		cy.cGet('#map')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right - 280;
			var YPos = items[0].getBoundingClientRect().bottom - 60;
			cy.cGet('body').click(XPos, YPos);
		});

		// Select cells downwards with shift + arrow
		for (let i = 0; i < 10; ++i) {
			helper.typeIntoDocument('{shift}{downArrow}');
		}

		// Document should scroll
		desktopHelper.assertScrollbarPosition('vertical', 50, 60);
		// Document should not scroll horizontally
		desktopHelper.assertScrollbarPosition('horizontal', 48, 50);
	});

	it('Scroll while selecting horizontally', function() {
		desktopHelper.assertScrollbarPosition('horizontal', 48, 60);

		// Click on a cell near the edge of the view
		cy.cGet('#map')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right - 280;
			var YPos = items[0].getBoundingClientRect().bottom - 60;
			cy.cGet('body').click(XPos, YPos);
		});

		// Select cells to the right with shift + arrow
		for (let i = 0; i < 10; ++i) {
			helper.typeIntoDocument('{shift}{rightArrow}');
		}

		// Document should scroll
		desktopHelper.assertScrollbarPosition('horizontal', 160, 170);
	});
});
