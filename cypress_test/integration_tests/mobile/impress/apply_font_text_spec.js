/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply font on selected text.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_font_text.odp');
		mobileHelper.enableEditingMobile();
	});

	function selectText() {
		// Select the text in the shape by double
		// clicking in the center of the shape,
		// which is in the center of the slide,
		// which is in the center of the document
		cy.cGet('#document-container').dblclick('center');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldExist();
	}

	it('Apply bold on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoBold').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoItalic').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoUnderline').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoStrikeout').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoShadowed').click();
		mobileHelper.closeMobileWizard();

		// Shadowed property is not in the SVG
		// Check mobile wizard state instead

		// Reselect text
		impressHelper.removeShapeSelection();
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoShadowed').should('have.class','selected');
	});

	it('Change font name of selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#font').click();
		cy.cGet('#fontnamecombobox').contains('.mobile-wizard.ui-combobox-text', 'Linux Libertine G').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#fontsizecombobox').click();
		cy.cGet('#fontsizecombobox').contains('.mobile-wizard.ui-combobox-text', '24 pt').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'font-size', '847px');
	});

	it('Apply text color on selected text.', function() {
		selectText();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'fill', 'rgb(0,0,0)');

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#Color .ui-header').click();
		mobileHelper.selectFromColorPicker('#Color', 5, 2);
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').not('.PlaceholderText').should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.wait(200); // selectFromColorPicker sporadically fails if not given time to load
		cy.cGet('#CharBackColor .ui-header').click();
		mobileHelper.selectFromColorPicker('#CharBackColor', 2, 2);
		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
		mobileHelper.closeMobileWizard();

		// Highlight color is not in the SVG
		// Check mobile wizard state instead

		// Reselect text
		impressHelper.removeShapeSelection();
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on selected text.', function() {
		selectText();
		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '3495');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '635px');

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('#mobile-wizard .unoSuperScript').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',3250);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',3325);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '368px');
	});

	it('Apply subscript on selected text.', function() {
		selectText();

		mobileHelper.openTextPropertiesPanel();
		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '3495');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '635px');
		cy.cGet('#mobile-wizard .unoSubScript').click();
		mobileHelper.closeMobileWizard();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',3500);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',3575);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '368px');
	});
});
