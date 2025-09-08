/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sidebar Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/sidebar.odp');
	});

	it('Set gradient background color', function() {
		cy.cGet('#fillattr2').should('not.be.visible');

		cy.cGet('#fillstyle select').select('Gradient');
		cy.cGet('#fillattr2').should('be.visible');
		cy.cGet('#fillattr3').should('be.visible');
		cy.cGet('#fillattr2').click();
		cy.cGet('.modalpopup .jsdialog-container').should('be.visible');
		cy.cGet('#colorwindow_iv_colors .ui-iconview').should('be.visible');
	});

	it.skip('Set underline using popup', function() {
		cy.cGet('#layoutvalueset').should('be.visible');
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();
		cy.cGet('#layoutvalueset').should('not.be.visible');
		cy.cGet('#Underline .arrowbackground').click();
		cy.cGet('.modalpopup .jsdialog-container').should('be.visible');
		cy.cGet('#single').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition tspan')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Sidebar menubutton visual test', function() {
		cy.cGet('#fillstyle select').select('Color');
		cy.cGet('#fillattr').should('be.visible');
		cy.cGet('#fillattr').compareSnapshot('sidebar_menubutton_color', 0.1);
	});
});
