/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Top toolbar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/top_toolbar.odp');
		desktopHelper.switchUIToCompact();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebar();
		} else {
			desktopHelper.hideSidebarImpress();
		}

		cy.wait(1000);

		impressHelper.selectTextShapeInTheCenter();
	});

	it('Apply bold on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-format-toptoolbar .arrowbackground').click();
		cy.cGet('#bold').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-format-toptoolbar .arrowbackground').click();
		cy.cGet('#italic').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-format-toptoolbar .arrowbackground').click();
		cy.cGet('#underline').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikethrough on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-format-toptoolbar .arrowbackground').click();
		cy.cGet('#strikeout').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply font color on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-fontcolor-toptoolbar .arrowbackground').click();
		cy.cGet('#fontcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('FFFF00');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'fill', 'rgb(255,255,0)');
	});

	it('Apply highlight color on text shape.', function() {
		cy.cGet('#toolbar-up #overflow-button-fontcolor-toptoolbar .arrowbackground').click();
		cy.cGet('#backcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('FFBF00');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		//highlight color is not in the SVG
		// that's why we didn't test there
	});

	it('Apply a selected font name on the text shape', function() {
		cy.cGet('#fontnamecombobox').click();
		desktopHelper.selectFromListbox('Liberation Mono');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-family', 'Liberation Mono');
	});

	it('Apply a selected font size on the text shape', function() {
		cy.cGet('#fontsizecombobox').click();
		desktopHelper.selectFromListbox('22');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '776px');
	});

	it.skip('Apply left/right alignment on text selected text.', function() {
		impressHelper.selectTextOfShape();
		cy.cGet('text tspan.TextPosition').should('have.attr', 'x', '1400');

		// Set right alignment first
		cy.cGet('#rightpara').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'x', '24530');

		// Set left alignment
		impressHelper.selectTextOfShape();
		cy.cGet('#leftpara').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'x', '1400');
	});

	it.skip('Apply superscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '8643');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '1129px');

		helper.typeIntoDocument('{ctrl}{shift}p');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',8200);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',8300);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '655px');
	});

	it.skip('Apply subscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.cGet('text tspan.TextPosition').should('have.attr', 'y', '8643');
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '1129px');

		helper.typeIntoDocument('{ctrl}{shift}b');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.gt',8700);
		cy.cGet('text tspan.TextPosition').invoke('attr','y').then((y)=>+y).should('be.lt',8750);
		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-size', '655px');
	});
});
