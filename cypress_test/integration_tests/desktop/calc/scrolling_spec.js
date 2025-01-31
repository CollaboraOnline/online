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
		desktopHelper.assertScrollbarPosition('vertical', 25, 40);
		desktopHelper.pressKey(3,'pagedown');
		desktopHelper.assertScrollbarPosition('vertical', 110, 130);
		desktopHelper.pressKey(3,'pageup');
		desktopHelper.assertScrollbarPosition('vertical', 50, 70);
		desktopHelper.pressKey(3,'downArrow');
		desktopHelper.assertScrollbarPosition('vertical', 25, 40);
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
		desktopHelper.assertScrollbarPosition('vertical', 25, 40);
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
		desktopHelper.assertScrollbarPosition('vertical', 230, 250);
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
		desktopHelper.assertScrollbarPosition('horizontal', 80, 110);
	});

	it('Scroll while selecting with mouse', function () {
		cy.cGet(helper.addressInputSelector).should('have.value', 'A2');

		// Click on the bottom left cell and hold
		cy.cGet('.leaflet-layer')
			.then(function (items) {
				expect(items).to.have.lengthOf(1);
				var yPos = items[0].getBoundingClientRect().height - 60;
				cy.cGet('.leaflet-layer').realMouseDown({ pointer: 'mouse', button: 'left', x: 30, y: yPos, scrollBehavior: false });
			});
		// Drag some cells to the right
		cy.cGet('.leaflet-layer').realMouseMove(-280, -60, { position: 'bottomRight', scrollBehavior: false });
		// Drag to the bottom edge
		cy.cGet('.leaflet-layer').realMouseMove(-280, 0, { position: 'bottomRight', scrollBehavior: false });
		// Wait for autoscroll and lift the button
		cy.wait(500);
		cy.cGet('.leaflet-layer').realMouseUp({ pointer: 'mouse', button: 'left' });

		// Without the fix, the selected range is of the form A17:A22, instead of A17:D22
		// It's better not to check the exact range because it can easily change in different executions
		cy.cGet(helper.addressInputSelector).invoke('val').should('contain', 'D');
	});
});
