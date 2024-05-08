/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font on selected shape.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_font_shape.odp');

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		impressHelper.triggerNewSVGForShapeInTheCenter();
	}

	it('Apply bold on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Bold').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Italic').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Underline').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Strikeout').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Shadowed').click();

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#font').click();
		cy.cGet('#fontnamecombobox').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '24 pt').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '847px');
	});

	it('Apply text color on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Color .ui-header').click();

		mobileHelper.selectFromColorPicker('#Color', 5, 2);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('not.have.attr', 'font-color');

		cy.cGet('#CharBackColor').click();

		mobileHelper.selectFromColorPicker('#CharBackColor', 2, 2);

		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '635px');

		cy.cGet('#SuperScript').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3286');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '368px');
	});

	it.skip('Apply subscript on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '635px');

		cy.cGet('#SubScript').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '368px');
	});

	it('Clear direct formatting of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		// Change the font size first
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '635px');

		cy.cGet('#SuperScript').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '368px');

		// Remove direct formatting
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#defaultattr .unoSetDefault').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'font-size', '635px');
	});
});
