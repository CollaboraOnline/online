/* global describe it cy beforeEach require afterEach Cypress*/

var helper = require('../../common/helper');

describe('Change shape properties via mobile wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('empty.odt', 'writer');

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();

		// Do insertion
		cy.get('.menu-entry-with-icon')
			.contains('Shape')
			.click();

		cy.get('.basicshapes_right-triangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g')
			.should('have.class', 'com.sun.star.drawing.CustomShape');
	});

	afterEach(function() {
		helper.afterAll();
	});

	function triggerNewSVG() {
		// Reopen mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Change width
		cy.get('#PosSizePropertyPanel')
			.click();

		cy.get('#selectwidth .plus')
			.should('be.visible')
			.click();
	}

	it('Check default shape geometry.', function() {
		// Geometry
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,10975 L 13792,16967 7800,16967 7800,10975 7800,10975 Z');
		// Fill color
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'fill', 'rgb(114,159,207)');
	});

	it('Change shape width.', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Entering a value inside the spinbutton has no effect on the shape.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change width
		cy.get('#PosSizePropertyPanel')
			.click();

		cy.get('#selectwidth .spinfield')
			.clear()
			.type('4.2')
			.type('{enter}');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,10975 L 18470,16967 7800,16967 7800,10975 7800,10975 Z');
	});

	it('Change shape height.', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Entering a value inside the spinbutton has no effect on the shape.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change width
		cy.get('#PosSizePropertyPanel')
			.click();

		cy.get('#selectheight .spinfield')
			.clear()
			.type('5.2')
			.type('{enter}');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,10975 L 13792,24185 7800,24185 7800,10975 7800,10975 Z');
	});

	it('Change size with keep ratio enabled.', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Entering a value inside the spinbutton has no effect on the shape.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		cy.get('#PosSizePropertyPanel')
			.click();

		// Enable keep ratio
		cy.get('#ratio #ratio')
			.click();

		cy.get('#ratio #ratio')
			.should('have.attr', 'checked', 'checked');

		// Change height
		cy.get('#selectheight .spinfield')
			.clear()
			.type('5.2')
			.type('{enter}');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,10975 L 21010,24185 7800,24185 7800,10975 7800,10975 Z');
	});

	it('Vertical mirroring', function() {
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Do mirroring
		cy.get('#PosSizePropertyPanel')
			.click();

		cy.get('#FlipVertical')
			.click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,16965 L 13792,10973 7800,10973 7800,16965 7800,16965 Z');
	});

	it('Horizontal mirroring', function() {
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Do mirroring
		cy.get('#PosSizePropertyPanel')
			.click();

		cy.get('#FlipHorizontal')
			.click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path')
			.should('have.attr', 'd', 'M 7800,10975 L 13792,16967 7800,16967 7800,10975 7800,10975 Z');
	});

	it('Trigger moving backward / forward', function() {
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		cy.get('#PosSizePropertyPanel')
			.click();

		// We can't test the result, so we just trigger
		// the events to catch crashes, consoler errors.
		cy.get('#BringToFront')
			.click();
		cy.wait(300);

		cy.get('#ObjectForwardOne')
			.click();
		cy.wait(300);

		cy.get('#ObjectBackOne')
			.click();
		cy.wait(300);

		cy.get('#SendToBack')
			.click();
	});

	it('Change line color', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Layout of the line properties panel is completely broken.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change line color
		cy.get('#LinePropertyPanel')
			.click();

		cy.get('#XLineColor')
			.click();

		cy.get('.ui-content[title="Line Color"] .color-sample-small[style="background-color: rgb(152, 0, 0);"]')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke', 'rgb(152,0,0)');
	});

	it('Change line style', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Layout of the line properties panel is completely broken.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change line color
		cy.get('#LinePropertyPanel')
			.click();

		cy.get('#linestyle')
			.click();

		cy.get('.ui-combobox-text')
			.contains('Fine Dotted')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.length.greaterThan', 20);
	});

	it('Change line width', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Layout of the line properties panel is completely broken.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change line width
		cy.get('#LinePropertyPanel')
			.click();

		cy.get('#linewidth .plus')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke-width', '141');

		// Reopen mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Change line width
		cy.get('#LinePropertyPanel')
			.click();

		cy.get('#linewidth .minus')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g path[fill="none"]')
			.should('have.attr', 'stroke-width', '141');
	});

	it('Change line transparency', function() {
		// TODO: Two issues are found here with core/master
		// 1) The mobile wizard keeps rerendering after it was already opened which leads
		// detached item error.
		// 2) Layout of the line properties panel is completely broken.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Change line color
		cy.get('#LinePropertyPanel')
			.click();

		cy.get('#linetransparency .spinfield')
			.clear()
			.type('20')
			.type('{enter}');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g svg g g g defs mask linearGradient')
			.should('exist');
	});
});
