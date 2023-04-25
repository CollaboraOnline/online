/* global describe it cy beforeEach require afterEach Cypress expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Change shape properties via mobile wizard.', function() {
	const defaultStartPoint = [1953, 4796];
	const defaultBase = 5992;
	const defaultAltitude = 5992;
	const unitScale = 2540.37;

	var origTestFileName = 'shape_properties.odt';
	var testFileName;

	class TriangleCoordinatesMatcher {
		/**
		 * @param {number} start
		 * @param {number} base
		 * @param {number} altitude
		 * @param {boolean} horizontalMirrored
		 * @param {boolean} verticalMirrored
		 */
		constructor(start, base, altitude, horizontalMirrored, verticalMirrored, delta) {
			// FIXME: This is probably a bug in core side. On flipping horizontally the base length changes.
			base = horizontalMirrored ? base + 54 : base;

			this.xStart = start[0] + (horizontalMirrored ? base : 0);
			this.xEnd = start[0] + (horizontalMirrored ? 0 : base);
			this.yStart = start[1] + (verticalMirrored ? altitude : 0);
			this.yEnd = start[1] + (verticalMirrored ? 0 : altitude);
			this.delta = delta || 30;
		}

		/**
		 * Checks the correctness of triangle svg path based on coordinates.
		 * @param {string} pathCommandStr is the value of the attribute 'd' of the triangle shape's svg path.
		 */
		match(pathCommandStr) {
			// M 1953,10839 L 7945,4847 1953,4847 1953,10839 1953,10839 Z
			const pathCmdSplit = pathCommandStr.split(' ');
			expect(pathCmdSplit).to.have.length(8);
			TriangleCoordinatesMatcher.pointMatch(pathCmdSplit[1], this.xStart, this.yStart, this.delta, 'top of hypotenuse');
			TriangleCoordinatesMatcher.pointMatch(pathCmdSplit[3], this.xEnd, this.yEnd, this.delta, 'bottom of hypotenuse');
			TriangleCoordinatesMatcher.pointMatch(pathCmdSplit[4], this.xStart, this.yEnd, this.delta, 'left end of base');
		}

		/**
		 * Does approximate matching of a point with the given expected values and error margin.
		 * @param {string} pointStr
		 * @param {number} expectedX
		 * @param {number} expectedY
		 * @param {number} delta
		 * @param {string} contextString
		 */
		static pointMatch(pointStr, expectedX, expectedY, delta, contextString) {
			const pointParts = pointStr.split(',');
			expect(pointParts).to.have.length(2);
			const x = parseInt(pointParts[0]);
			const y = parseInt(pointParts[1]);
			expect(x).to.be.closeTo(expectedX, delta, contextString + ' x ');
			expect(y).to.be.closeTo(expectedY, delta, contextString + ' y ');
		}
	}

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		mobileHelper.enableEditingMobile();
		helper.moveCursor('end');
		helper.moveCursor('home');
		mobileHelper.openInsertionWizard();
		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Shape').click();
		cy.cGet('.basicshapes_right-triangle').click();
		// Check that the shape is there
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 }).should('have.class', 'com.sun.star.drawing.CustomShape');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		cy.wait(1000);
		// Change width
		openPosSizePanel();
		cy.cGet('#selectwidth .plus').should('be.visible');
		helper.clickOnIdle('#selectwidth .plus');
		helper.clickOnIdle('#selectwidth .plus');
		mobileHelper.closeMobileWizard();
	}

	function openPosSizePanel() {
		mobileHelper.openMobileWizard();
		helper.clickOnIdle('#PosSizePropertyPanel');
		cy.cGet('#selectwidth').should('be.visible');
	}

	function openLinePropertyPanel() {
		mobileHelper.openMobileWizard();
		helper.clickOnIdle('#LinePropertyPanel');
		cy.cGet('#linestyle').should('be.visible');
	}

	function openAreaPanel() {
		mobileHelper.openMobileWizard();
		helper.clickOnIdle('#AreaPropertyPanel');
		cy.cGet('#fillstylearea').should('be.visible');
	}

	it('Check default shape geometry.', function() {
		// Geometry
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, defaultBase, defaultAltitude);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
		// Fill color
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').should('have.attr', 'fill', 'rgb(114,159,207)');
	});

	it('Change shape width.', function() {
		openPosSizePanel();
		helper.typeIntoInputField('#selectwidth .spinfield', '4.2', true, false);
		cy.wait(1000);
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, Math.floor(4.2 * unitScale) /* new base */, defaultAltitude);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
	});

	it('Change shape height.', function() {
		openPosSizePanel();
		helper.typeIntoInputField('#selectheight .spinfield', '5.2', true, false);
		cy.wait(1000);
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, defaultBase, Math.ceil(5.2 * unitScale) /* new altitude */);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
	});

	it('Change size with keep ratio enabled.', function() {
		openPosSizePanel();
		// Enable keep ratio
		helper.clickOnIdle('#ratio #ratio');
		cy.cGet('#ratio #ratio').should('have.prop', 'checked', true);
		// Change height
		helper.inputOnIdle('#selectheight .spinfield', '5.2');
		cy.wait(1000);
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, Math.floor(5.2 * unitScale), Math.ceil(5.2 * unitScale));
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
	});

	it('Vertical mirroring', function() {
		openPosSizePanel();
		helper.clickOnIdle('.unoFlipVertical');
		cy.wait(1000);
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, defaultBase, defaultAltitude, false /* horiz mirroring */, true /* vert mirroring */);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
	});

	it('Horizontal mirroring', function() {
		openPosSizePanel();
		helper.clickOnIdle('.unoFlipHorizontal');
		triggerNewSVG();
		cy.wait(1000);
		const matcher = new TriangleCoordinatesMatcher(defaultStartPoint, defaultBase, defaultAltitude, true /* horiz mirroring */, false /* vert mirroring */);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path').invoke('attr', 'd').should(matcher.match.bind(matcher));
	});

	it('Trigger moving backward / forward', function() {
		openPosSizePanel();
		// We can't test the result, so we just trigger
		// the events to catch crashes, consoler errors.
		helper.clickOnIdle('.unoBringToFront');
		cy.wait(300);
		helper.clickOnIdle('.unoObjectForwardOne');
		cy.wait(300);
		helper.clickOnIdle('.unoObjectBackOne');
		cy.wait(300);
		helper.clickOnIdle('.unoSendToBack');
		cy.wait(300);
	});

	it.skip('Change line color', function() {
		openLinePropertyPanel();
		helper.clickOnIdle('.unoXLineColor');
		helper.clickOnIdle('.ui-content[title="Line Color"] .color-sample-small[style="background-color: rgb(152, 0, 0);"]');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]').should('have.attr', 'stroke', 'rgb(152,0,0)');
	});

	it.skip('Change line style', function() {
		openLinePropertyPanel();
		mobileHelper.selectListBoxItem2('#linestyle', 'Ultrafine Dashed');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]').should('have.length.greaterThan', 12);
	});

	it.skip('Change line width', function() {
		openLinePropertyPanel();
		cy.cGet('#linewidth .spinfield').should('have.attr', 'readonly', 'readonly');
		helper.clickOnIdle('#linewidth .plus');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]').should('have.attr', 'stroke-width', '141');
		openLinePropertyPanel();
		helper.clickOnIdle('#linewidth .minus');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]').should('have.attr', 'stroke-width', '88');
	});

	it.skip('Change line transparency', function() {
		openLinePropertyPanel();
		helper.typeIntoInputField('#linetransparency .spinfield', '20', true, false);
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g g g defs mask linearGradient').should('exist');
	});

	it.skip('Arrow style items are hidden.', function() {
		openLinePropertyPanel();
		cy.cGet('#linestyle').should('be.visible');
		cy.cGet('#beginarrowstyle').should('not.exist');
		cy.cGet('#endarrowstyle').should('not.exist');

	});

	it.skip('Apply gradient fill', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern').should('not.exist');
		openAreaPanel();
		cy.cGet('#fillstylearea .ui-header-left').should('have.text', 'Color');
		mobileHelper.selectListBoxItem2('#fillstylearea', 'Gradient');
		// Select type
		cy.cGet('#gradientstyle .ui-header-left').should('have.text', 'Linear');
		mobileHelper.selectListBoxItem2('#gradientstyle', 'Square');
		// Select From color
		helper.clickOnIdle('#fillgrad1');
		mobileHelper.selectFromColorPalette(0, 2);
		// Set gradient angle
		helper.inputOnIdle('#gradangle .spinfield', '100');
		cy.cGet('#gradangle .spinfield').should('have.value', '100');
		// Select To color
		helper.clickOnIdle('#fillgrad2');
		mobileHelper.selectFromColorPalette(1, 7);
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern').should('exist');
	});

	it.skip('Apply hatching fill', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern').should('not.exist');
		openAreaPanel();
		cy.cGet('#fillstylearea .ui-header-left').should('have.text', 'Color');
		mobileHelper.selectListBoxItem2('#fillstylearea', 'Hatching');
		cy.cGet('#fillattrhb .ui-header-left').should('have.text', 'Black 0 Degrees');
		mobileHelper.selectListBoxItem2('#fillattrhb', 'Black 45 Degrees');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs pattern').should('exist');
	});

	it.skip('Apply bitmap fill', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath').should('not.exist');
		openAreaPanel();
		cy.cGet('#fillstylearea .ui-header-left').should('have.text', 'Color');
		mobileHelper.selectListBoxItem2('#fillstylearea', 'Bitmap');
		cy.cGet('#fillattrhb .ui-header-left').should('have.text', 'Painted White');
		mobileHelper.selectListBoxItem2('#fillattrhb', 'Paper Graph');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath').should('exist');
	});

	it.skip('Apply pattern fill', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath').should('not.exist');
		openAreaPanel();
		cy.cGet('#fillstylearea .ui-header-left').should('have.text', 'Color');
		mobileHelper.selectListBoxItem2('#fillstylearea', 'Pattern');
		cy.cGet('#fillattrhb .ui-header-left').should('have.text', '5 Percent');
		mobileHelper.selectListBoxItem2('#fillattrhb', '20 Percent');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 defs clipPath').should('exist');
	});

	it.skip('Change fill color', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)').should('have.attr', 'fill', 'rgb(114,159,207)');
		openAreaPanel();
		cy.cGet('#FillColor .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(114, 159, 207);');
		helper.clickOnIdle('.unoFillColor');
		mobileHelper.selectFromColorPalette(0, 2, 0, 2);
		cy.cGet('#FillColor .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)').should('have.attr', 'fill', 'rgb(204,0,0)');
	});

	it.skip('Change fill transparency type', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 linearGradient').should('not.exist');
		openAreaPanel();
		cy.cGet('#transtype .ui-header-left').should('have.text', 'None');
		mobileHelper.selectListBoxItem2('#transtype', 'Linear');
		// TODO: implement show/hide
		//cy.get('#settransparency .spinfield')
		//	.should('not.exist');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 linearGradient').should('exist');
	});

	it.skip('Change fill transparency', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)').should('not.have.attr', 'fill-opacity');
		openAreaPanel();
		cy.cGet('#transtype .ui-header-left').should('have.text', 'None');
		helper.inputOnIdle('#settransparency .spinfield', '50');
		cy.cGet('#settransparency .spinfield').should('have.value', '50');
		cy.cGet('#transtype .ui-header-left').should('have.text', 'Solid');
		triggerNewSVG();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g svg g.Page g g#id1 path:nth-of-type(1)').should('have.attr', 'fill-opacity', '0.502');
	});
});
