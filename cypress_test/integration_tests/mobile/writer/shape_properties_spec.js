/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Change shape properties via mobile wizard.', function() {
	var defaultGeometry = 'M 1965,4863 L 7957,10855 1965,10855 1965,4863 1965,4863 Z';
	var testFileName = 'shape_properties.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		helper.moveCursor('end');

		helper.moveCursor('home');

		if (Cypress.env('INTEGRATION') === 'php-proxy') {
			cy.wait(1000);
		}

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
			.should('have.attr', 'd', defaultGeometry);
		// Fill color
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'fill', 'rgb(114,159,207)');
	});

	it('Change shape width.', function() {

		openPosSizePanel();

		cy.get('#selectwidth .spinfield')
			.clear()
			.type('4.2')
			.type('{enter}');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', defaultGeometry);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 1965,4863 L 12635,10855 1965,10855 1965,4863 1965,4863 Z');
	});

	it('Change shape height.', function() {

		openPosSizePanel();

		cy.get('#selectheight .spinfield')
			.clear()
			.type('5.2')
			.type('{enter}');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', defaultGeometry);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 1965,4863 L 7957,18073 1965,18073 1965,4863 1965,4863 Z');
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
			.should('not.have.attr', 'd', defaultGeometry);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 1965,4863 L 15175,18073 1965,18073 1965,4863 1965,4863 Z');
	});

	it('Vertical mirroring', function() {
		openPosSizePanel();

		helper.clickOnIdle('#FlipVertical');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', defaultGeometry);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 1965,10853 L 7957,4861 1965,4861 1965,10853 1965,10853 Z');
	});

	it('Horizontal mirroring', function() {
		openPosSizePanel();

		helper.clickOnIdle('#FlipHorizontal');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('not.have.attr', 'd', defaultGeometry);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 8010,4863 L 1963,10855 8010,10855 8010,4863 8010,4863 Z');
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

		helper.clickOnIdle('#linestyle');

		helper.clickOnIdle('.ui-combobox-text', 'Ultrafine Dashed');

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

		cy.get('#linetransparency .spinfield')
			.clear()
			.type('20')
			.type('{enter}');

		cy.get('#linetransparency .spinfield')
			.should('have.attr', 'value', '20');

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

		helper.clickOnIdle('#fillstylearea');

		helper.clickOnIdle('.ui-combobox-text', 'Gradient');

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Gradient');

		// Select type
		cy.get('#gradientstyle .ui-header-left')
			.should('have.text', 'Linear');

		helper.clickOnIdle('#gradientstyle');

		helper.clickOnIdle('.ui-combobox-text', 'Square');

		cy.get('#gradientstyle .ui-header-left')
			.should('have.text', 'Square');

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

		helper.clickOnIdle('#fillstylearea');

		helper.clickOnIdle('.ui-combobox-text', 'Hatching');

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Hatching');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Black 0 Degrees');

		helper.clickOnIdle('#fillattrhb');

		helper.clickOnIdle('.ui-combobox-text', 'Black 45 Degrees');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Black 45 Degrees');

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

		helper.clickOnIdle('#fillstylearea');

		helper.clickOnIdle('.ui-combobox-text', 'Bitmap');

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Bitmap');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Painted White');

		helper.clickOnIdle('#fillattrhb');

		helper.clickOnIdle('.ui-combobox-text', 'Paper Graph');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', 'Paper Graph');

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

		helper.clickOnIdle('#fillstylearea');

		helper.clickOnIdle('.ui-combobox-text', 'Pattern');

		cy.get('#fillstylearea .ui-header-left')
			.should('have.text', 'Pattern');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', '5 Percent');

		helper.clickOnIdle('#fillattrhb');

		helper.clickOnIdle('.ui-combobox-text', '20 Percent');

		cy.get('#fillattrhb .ui-header-left')
			.should('have.text', '20 Percent');

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

		helper.clickOnIdle('#transtype');

		helper.clickOnIdle('.ui-combobox-text', 'Linear');

		cy.get('#transtype .ui-header-left')
			.should('have.text', 'Linear');

		cy.get('#settransparency .spinfield')
			.should('not.be.visible');

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
