/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Sidebar Tests', function() {
	var testFileName = 'sidebar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Switch to slide transition Deck', function() {
		cy.get('#tb_editbar_item_slidechangewindow .w2ui-button')
			.should('not.have.class', 'checked');

		cy.get('#layoutvalueset')
			.should('be.visible');

		cy.get('#tb_editbar_item_slidechangewindow .w2ui-button')
			.click({force: true});

		cy.get('#tb_editbar_item_slidechangewindow .w2ui-button')
			.should('have.class', 'checked');

		cy.get('#layoutvalueset')
			.should('not.exist');

		cy.get('#transitions_icons')
			.should('be.visible');
	});

	it('Set gradient background color', function() {
		cy.get('#fillattr2')
			.should('not.be.visible');

		cy.get('#fillstyle select')
			.wait(1000)
			.select('Gradient');

		cy.get('#fillattr2')
			.should('be.visible');

		cy.get('#fillattr3')
			.should('be.visible');

		cy.get('#fillattr2')
			.click();

		cy.get('.modalpopup')
			.should('be.visible');

		cy.get('#colorset')
			.should('be.visible');
	});

	it('Set underline using popup', function() {
		cy.get('#layoutvalueset')
			.should('be.visible');

		impressHelper.selectTextShapeInTheCenter();

		impressHelper.selectTextOfShape();

		cy.get('#layoutvalueset')
			.should('not.be.visible');

		cy.get('#Underline .arrowbackground')
			.click();

		cy.get('.modalpopup')
			.should('be.visible');

		cy.get('#single')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});
});
