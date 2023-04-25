/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font on selected shape.', function() {
	var origTestFileName = 'apply_font_shape.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		impressHelper.triggerNewSVGForShapeInTheCenter();
	}

	it('Apply bold on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Bold');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Italic');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Underline');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Strikeout');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Shadowed');

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#font').click();
		cy.cGet('#fontnamecombobox').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '24 pt').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});

	it('Apply text color on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Color .ui-header');

		mobileHelper.selectFromColorPicker('#Color', 5, 2);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('not.have.attr', 'font-color');

		helper.clickOnIdle('#CharBackColor');

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
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#SuperScript');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3285');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it.skip('Apply subscript on text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#SubScript');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it('Clear direct formatting of text shape.', function() {
		mobileHelper.openTextPropertiesPanel();

		// Change the font size first
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#SuperScript');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');

		// Remove direct formatting
		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#defaultattr .unoSetDefault');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');
	});
});
