/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sidebar Tests', function() {
	var testFileName = 'sidebar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
		desktopHelper.switchUIToCompact();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it.skip('Switch to slide transition Deck', function() {
		cy.cGet('#tb_editbar_item_slidechangewindow .w2ui-button').should('not.have.class', 'checked');
		cy.cGet('#layoutvalueset').should('be.visible');
		cy.cGet('#tb_editbar_item_slidechangewindow .w2ui-button').click({force: true});
		cy.cGet('#tb_editbar_item_slidechangewindow .w2ui-button').should('have.class', 'checked');
		cy.cGet('#layoutvalueset').should('not.exist');
		cy.cGet('#transitions_iconswin').should('be.visible');
	});

	it('Set gradient background color', function() {
		cy.cGet('#fillattr2').should('not.be.visible');

		helper.waitUntilIdle('#fillstyle');
		cy.cGet('#fillstyle select').select('Gradient');
		cy.cGet('#fillattr2').should('be.visible');
		cy.cGet('#fillattr3').should('be.visible');
		helper.waitUntilIdle('#fillattr2');
		cy.cGet('#fillattr2').click();
		cy.cGet('.modalpopup .jsdialog-container').should('be.visible');
		cy.cGet('#colorset').should('be.visible');
	});

	it('Set underline using popup', function() {
		cy.cGet('#layoutvalueset').should('be.visible');
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.selectTextOfShape();
		cy.cGet('#layoutvalueset').should('not.be.visible');
		cy.cGet('#Underline .arrowbackground').click();
		cy.cGet('.modalpopup .jsdialog-container').should('be.visible');
		cy.cGet('#single').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});
});
