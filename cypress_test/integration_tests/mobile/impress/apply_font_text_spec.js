/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe('Apply font on selected text.', function() {
	var origTestFileName = 'apply_font_text.odp';
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

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply bold on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Bold');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply italic on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Italic');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply underline on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Underline');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply strikeout on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Strikeout');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply shadowed on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Shadowed');

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Change font name of selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		mobileHelper.selectListBoxItem('#fontnamecombobox', 'Linux Libertine G');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Change font size of selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		mobileHelper.selectListBoxItem('#fontsizecombobox', '24');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Grow font size of selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#Grow');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '705px');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Shrink font size of selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#Shrink');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '564px');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply text color on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Color');

		mobileHelper.selectFromColorPalette(0, 5, 2);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply highlight on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#CharBackColor');

		mobileHelper.selectFromColorPalette(1, 2, 2);

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		cy.wait(400);
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply superscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#SuperScript');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3285');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	// FIXME temporarily disabled, does not work with CanvasTileLayer
	it.skip('Apply subscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#SubScript');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});
});
