/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Apply font on selected text.', function() {
	var testFileName = 'apply_font_text.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		impressHelper.triggerNewSVGForShapeInTheCenter();
	}

	it('Apply bold on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Bold');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Italic');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Underline');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Strikeout');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#Shadowed');

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#fontnamecombobox');

		helper.clickOnIdle('.ui-combobox-text', 'Linux Libertine G');

		helper.clickOnIdle('#mobile-wizard-back');

		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#fontsizecombobox');

		helper.clickOnIdle('.mobile-wizard.ui-combobox-text', '24');

		helper.clickOnIdle('#mobile-wizard-back');

		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '24');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});

	it('Grow font size of selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#Grow');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '705px');
	});

	it('Shrink font size of selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.clickOnIdle('#Shrink');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '564px');
	});

	it('Apply text color on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('not.have.attr', 'font-color');

		helper.clickOnIdle('#Color');

		mobileHelper.selectFromColorPalette(0, 5, 2);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		helper.clickOnIdle('#CharBackColor');

		mobileHelper.selectFromColorPalette(1, 2, 2);

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		cy.wait(400);
		impressMobileHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

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

	it('Apply subscript on selected text.', function() {
		impressMobileHelper.selectTextOfShape();

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
