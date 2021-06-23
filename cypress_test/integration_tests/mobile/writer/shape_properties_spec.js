/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Change shape properties via mobile wizard.', function() {
	const defaultStartPoint = [1953, 4875];
	const defaultBase = 5992;
	const defaultAltitude = 5992;
	const unitScale = 2540.37;

	var testFileName = 'shape_properties.odt';

	function computeRightTrianglePath(start, base, altitude, horizontalMirrored, verticalMirrored) {
		// FIXME: This is probably a bug in core side. On flipping horizontally the base length changes.
		base = horizontalMirrored ? base + 54 : base;

		const xStart = start[0] + (horizontalMirrored ? base : 0);
		const xEnd = start[0] + (horizontalMirrored ? 0 : base);
		const yStart = start[1] + (verticalMirrored ? altitude : 0);
		const yEnd = start[1] + (verticalMirrored ? 0 : altitude);

		var pathString = `M ${xStart},${yStart}`;
		pathString += ` L ${xEnd},${yEnd}`;      // Hypotenuse
		pathString += ` ${xStart},${yEnd}`;      // Base
		pathString += ` ${xStart},${yStart}`;    // Altitude
		pathString += ` ${xStart},${yStart} Z`;  // Close the polygon
		return pathString;
	}

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		helper.moveCursor('end');

		helper.moveCursor('home');

		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.contains('.menu-entry-with-icon', 'Shape')
			.click();

		cy.get('.basicshapes_right-triangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
			.should('have.class', 'com.sun.star.drawing.CustomShape');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();

		// Change width
		openPosSizePanel();

		cy.get('#selectwidth .plus')
			.should('be.visible');

		helper.clickOnIdle('#selectwidth .plus');

		mobileHelper.closeMobileWizard();
	}

	function openPosSizePanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#PosSizePropertyPanel');

		cy.get('#selectwidth')
			.should('be.visible');
	}

	function openLinePropertyPanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#LinePropertyPanel');

		cy.get('#linestyle')
			.should('be.visible');
	}

	function openAreaPanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#AreaPropertyPanel');

		cy.get('#fillstylearea')
			.should('be.visible');
	}

	it('Check default shape geometry.', function() {
		// Geometry
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));
		// Fill color
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'fill', 'rgb(114,159,207)');
	});

	it('Change shape width.', function() {

		openPosSizePanel();

		helper.typeIntoInputField('#selectwidth .spinfield', '4.2', true, false);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd',
				computeRightTrianglePath(defaultStartPoint, Math.floor(4.2 * unitScale) /* new base */, defaultAltitude));
	});

	it('Change shape height.', function() {

		openPosSizePanel();

		helper.typeIntoInputField('#selectheight .spinfield', '5.2', true, false);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd',
				computeRightTrianglePath(defaultStartPoint, defaultBase, Math.ceil(5.2 * unitScale) /* new altitude */));
	});

	it('Change size with keep ratio enabled.', function() {
		openPosSizePanel();

		// Enable keep ratio
		helper.clickOnIdle('#ratio #ratio');

		cy.get('#ratio #ratio')
			.should('have.prop', 'checked', true);

		// Change height
		helper.inputOnIdle('#selectheight .spinfield', '5.2');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd',
				computeRightTrianglePath(defaultStartPoint, Math.floor(5.2 * unitScale), Math.ceil(5.2 * unitScale)));
	});

	it('Vertical mirroring', function() {
		openPosSizePanel();

		helper.clickOnIdle('#FlipVertical');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));

		// Probably due to some rounding in core, we get an offset of 1 pixel in y.
		const startPoint = [defaultStartPoint[0], defaultStartPoint[1] - 1];
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd',
				computeRightTrianglePath(startPoint, defaultBase, defaultAltitude, false /* horiz mirroring */, true /* vert mirroring */));
	});

	it('Horizontal mirroring', function() {
		openPosSizePanel();

		helper.clickOnIdle('#FlipHorizontal');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', computeRightTrianglePath(defaultStartPoint, defaultBase, defaultAltitude));

		const startPoint = [defaultStartPoint[0] - 2, defaultStartPoint[1]];
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd',
				computeRightTrianglePath(startPoint, defaultBase, defaultAltitude, true /* horiz mirroring */, false /* vert mirroring */));
	});

	it('Trigger moving backward / forward', function() {
		openPosSizePanel();

		// We can't test the result, so we just trigger
		// the events to catch crashes, consoler errors.
		helper.clickOnIdle('#BringToFront');
		cy.wait(300);

		helper.clickOnIdle('#ObjectForwardOne');
		cy.wait(300);

		helper.clickOnIdle('#ObjectBackOne');
		cy.wait(300);

		helper.clickOnIdle('#SendToBack');
		cy.wait(300);
	});

	it('Change line color', function() {
		openLinePropertyPanel();

		helper.clickOnIdle('#XLineColor');

		helper.clickOnIdle('.ui-content[title="Line Color"] .color-sample-small[style="background-color: rgb(152, 0, 0);"]');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke', 'rgb(152,0,0)');
	});

	it('Change line style', function() {
		openLinePropertyPanel();

		mobileHelper.selectListBoxItem2('#linestyle', 'Ultrafine Dashed');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.length.greaterThan', 12);
	});

	it('Change line width', function() {
		openLinePropertyPanel();

		cy.get('#linewidth .spinfield')
			.should('have.attr', 'readonly', 'readonly');

		helper.clickOnIdle('#linewidth .plus');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke-width', '141');

		openLinePropertyPanel();

		helper.clickOnIdle('#linewidth .minus');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke-width', '88');
	});

	it('Change line transparency', function() {
		openLinePropertyPanel();

		helper.typeIntoInputField('#linetransparency .spinfield', '20', true, false);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g defs mask linearGradient')
			.should('exist');
	});

	it('Arrow style items are hidden.', function() {
		openLinePropertyPanel();

		cy.get('#linestyle')
			.should('be.visible');

		cy.get('#beginarrowstyle')
			.should('not.exist');

		cy.get('#endarrowstyle')
			.should('not.exist');

	});

	it('Apply gradient fill', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern')
			.should('not.exist');

		openAreaPanel();

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Color');

		mobileHelper.selectListBoxItem2('#fillstylearea', 'Gradient');

		// Select type
		cy.get('#gradientstyle .ui-header-left')
			.should('have.text', 'Linear');

		mobileHelper.selectListBoxItem2('#gradientstyle', 'Square');

		// Select From color
		helper.clickOnIdle('#fillgrad1');

		mobileHelper.selectFromColorPalette(0, 2);

		// Set gradient angle
		helper.inputOnIdle('#gradangle .spinfield', '100');

		cy.get('#gradangle .spinfield')
			.should('have.attr', 'value', '100');

		// Select To color
		helper.clickOnIdle('#fillgrad2');

		mobileHelper.selectFromColorPalette(1, 7);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern')
			.should('exist');
	});

	it('Apply hatching fill', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern')
			.should('not.exist');

		openAreaPanel();

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Color');

		mobileHelper.selectListBoxItem2('#fillstylearea', 'Hatching');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Black 0 Degrees');

		mobileHelper.selectListBoxItem2('#fillattrhb', 'Black 45 Degrees');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern')
			.should('exist');
	});

	it('Apply bitmap fill', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath')
			.should('not.exist');

		openAreaPanel();

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Color');

		mobileHelper.selectListBoxItem2('#fillstylearea', 'Bitmap');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Painted White');

		mobileHelper.selectListBoxItem2('#fillattrhb', 'Paper Graph');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath')
			.should('exist');
	});

	it('Apply pattern fill', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath')
			.should('not.exist');

		openAreaPanel();

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Color');

		mobileHelper.selectListBoxItem2('#fillstylearea', 'Pattern');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', '5 Percent');

		mobileHelper.selectListBoxItem2('#fillattrhb', '20 Percent');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath')
			.should('exist');
	});

	it('Change fill color', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)')
			.should('have.attr', 'fill', 'rgb(114,159,207)');

		openAreaPanel();

		cy.get('#FillColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(114, 159, 207);');

		helper.clickOnIdle('#FillColor');

		mobileHelper.selectFromColorPalette(0, 2 ,2);

		cy.get('#FillColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)')
			.should('have.attr', 'fill', 'rgb(204,0,0)');
	});

	it('Change fill transparency type', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 linearGradient')
			.should('not.exist');

		openAreaPanel();

		cy.get('#transtype .ui-header-left')
			.should('have.text', 'None');

		mobileHelper.selectListBoxItem2('#transtype', 'Linear');

		cy.get('#settransparency .spinfield')
			.should('not.exist');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 linearGradient')
			.should('exist');
	});

	it('Change fill transparency', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)')
			.should('not.have.attr', 'fill-opacity');

		openAreaPanel();

		cy.get('#transtype .ui-header-left')
			.should('have.text', 'None');

		helper.inputOnIdle('#settransparency .spinfield', '50');

		cy.get('#settransparency .spinfield')
			.should('have.attr', 'value', '50');

		cy.get('#transtype .ui-header-left')
			.should('have.text', 'Solid');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)')
			.should('have.attr', 'fill-opacity', '0.502');
	});
});
