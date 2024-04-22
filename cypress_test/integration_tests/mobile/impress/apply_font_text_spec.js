/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font on selected text.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_font_text.odp');
		mobileHelper.enableEditingMobile();
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		impressHelper.triggerNewSVGForShapeInTheCenter();
	}

	it('Apply bold on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#mobile-wizard .unoBold').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#mobile-wizard .unoItalic').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#mobile-wizard .unoUnderline').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#mobile-wizard .unoStrikeout').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#mobile-wizard .unoShadowed').click();

		triggerNewSVG();

		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#font').click();
		cy.cGet('#fontnamecombobox').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '24 pt').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-size', '847px');
	});

	it('Apply text color on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'fill', 'rgb(0,0,0)');

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#Color .ui-header').click();

		mobileHelper.selectFromColorPicker('#Color', 5, 2);

		triggerNewSVG();
		// Not sure why this extra svg trigger is needed
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#CharBackColor .ui-header').click();

		mobileHelper.selectFromColorPicker('#CharBackColor', 2, 2);

		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '3495');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '635px');

		cy.cGet('#mobile-wizard .unoSuperScript').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',3250);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',3325);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '368px');
	});

	it('Apply subscript on selected text.', function() {
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();

		mobileHelper.openTextPropertiesPanel();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '3495');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '635px');

		cy.cGet('#mobile-wizard .unoSubScript').click();

		triggerNewSVG();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',3500);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',3575);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '368px');
	});
});
