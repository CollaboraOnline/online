/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Apply font on text and on text shape.', function() {
	var testFileName = 'apply_font.odp';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		selectTextShape();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function selectTextShape() {
		// Click on the center of the slide to select the text shape there
		cy.get('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.click(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('be.visible');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TextShape');
	}

	function selectTextOfShape() {
		// Double click onto the selected shape
		cy.get('svg g .leaflet-interactive')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.get('.leaflet-cursor.blinking-cursor')
			.should('exist');

		helper.selectAllText(false);
	}

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();

		// Remove selection first with clicking next to the rotate handler
		cy.get('.transform-handler--rotate')
			.then(function(items) {
				var XPos = items[0].getBoundingClientRect().left - 10;
				var YPos = items[0].getBoundingClientRect().top;
				cy.get('body')
					.click(XPos, YPos);

				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('not.exist');

		// If we click two fast on shape again
		// then it steps into edit mode
		cy.wait(200);

		// Select text shape again which will retrigger a new SVG from core
		selectTextShape();
	}

	function openTextPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.get('#TextPropertyPanel')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	}

	it('Apply bold on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#Bold')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#Italic')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#Underline')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#Strikeout')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#Shadowed')
			.click();

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of text shape.', function() {
		openTextPropertiesPanel();

		cy.get('#fontnamecombobox')
			.click();

		cy.contains('.ui-combobox-text', 'Linux Libertine G')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#fontsizecombobox')
			.click();

		cy.contains('.mobile-wizard.ui-combobox-text', '24')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '24');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});

	it('Grow font size of text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#Grow')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '705px');
	});

	it('Shrink font size of text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#Shrink')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '564px');
	});

	it('Apply text color on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('not.have.attr', 'font-color');

		cy.get('#Color')
			.click();

		mobileHelper.selectFromColorPalette(0, 5, 2);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('not.have.attr', 'font-color');

		cy.get('#CharBackColor')
			.click();

		mobileHelper.selectFromColorPalette(1, 2, 2);

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		openTextPropertiesPanel();

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#SuperScript')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3285');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it('Apply subscript on text shape.', function() {
		openTextPropertiesPanel();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#SubScript')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it('Clear direct formatting of text shape.', function() {
		openTextPropertiesPanel();

		// Change the font size first
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#Grow')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '705px');

		// Remove direct formatting
		openTextPropertiesPanel();

		cy.get('#clearFormatting')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');
	});

	it('Apply bold on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#Bold')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#Italic')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#Underline')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#Strikeout')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply shadowed on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#Shadowed')
			.click();

		triggerNewSVG();

		cy.wait(400);
		// TODO: shadowed property is not in the SVG
	});

	it('Change font name of selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#fontnamecombobox')
			.click();

		cy.contains('.ui-combobox-text', 'Linux Libertine G')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#fontnamecombobox .ui-header-right .entry-value')
			.should('have.text', 'Linux Libertine G');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});

	it('Change font size of selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#fontsizecombobox')
			.click();

		cy.contains('.mobile-wizard.ui-combobox-text', '24')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#fontsizecombobox .ui-header-right .entry-value')
			.should('have.text', '24');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});

	it('Grow font size of selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#Grow')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '705px');
	});

	it('Shrink font size of selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#Shrink')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '564px');
	});

	it('Apply text color on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('not.have.attr', 'font-color');

		cy.get('#Color')
			.click();

		mobileHelper.selectFromColorPalette(0, 5, 2);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(106,168,79)');
	});

	it('Apply highlight on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#CharBackColor')
			.click();

		mobileHelper.selectFromColorPalette(1, 2, 2);

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');

		triggerNewSVG();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('#CharBackColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(204, 0, 0);');
	});

	it('Apply superscript on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#SuperScript')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3285');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it('Apply subscript on selected text.', function() {
		selectTextOfShape();

		mobileHelper.openMobileWizard();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#SubScript')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});
});
