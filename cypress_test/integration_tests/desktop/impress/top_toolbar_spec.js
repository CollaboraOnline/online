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
		cy.cGet('#bold').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		cy.cGet('#italic').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		cy.cGet('#underline').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikethrough on text shape.', function() {
		cy.cGet('#strikeout').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply font color on text shape.', function() {
		cy.cGet('#fontcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('FFFF00');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('text tspan.TextPosition tspan').should('have.attr', 'fill', 'rgb(255,255,0)');
	});

	it('Apply highlight color on text shape.', function() {
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

	it('Click shape hyperlink.', function() {
		// Insert shape
		cy.cGet('#toolbar-up #overflow-button-other-toptoolbar .arrowbackground').click();
		cy.cGet('.ui-toolbar #insertshapes').click();
		cy.cGet('.col.w2ui-icon.basicshapes_round-quadrat').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');

		// Select shape at center of document
		impressHelper.clickCenterOfSlide( { } );

		helper.typeIntoDocument('{ctrl}k');
		cy.cGet('#target').should('exist').should('be.visible');
		cy.cGet('#indication').should('exist').should('not.be.visible');
		cy.cGet('#name').should('exist').should('not.be.visible');

		cy.cGet('#target-input').type('www.something.com');
		cy.cGet('#ok').click();

		impressHelper.removeShapeSelection();

		// Ctrl-click to open hyperlink pop-up
		impressHelper.clickCenterOfSlide( {ctrlKey: true} );

		cy.cGet('#info-modal-label2').should('have.text', 'http://www.something.com/');
		cy.cGet('#openlink-response').should('exist');
	});
});
