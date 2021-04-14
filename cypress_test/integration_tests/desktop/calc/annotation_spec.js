/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var testFileName = 'focus.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Insert',function() {
		insertMultipleComment();

		cy.get('.loleaflet-div-layer').should('exist');

		cy.get('.loleaflet-div-layer').trigger('mouseover');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');
	});

	it('Modify',function() {
		insertMultipleComment();

		cy.get('.loleaflet-div-layer').should('exist');

		cy.get('.loleaflet-div-layer').trigger('mouseover');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Modify')
			.click();

		cy.get('.loleaflet-annotation-edit.modify-annotation')
			.type('some other text, ');

		cy.get('.loleaflet-annotation-edit.modify-annotation #annotation-save')
			.click();

		cy.get('.loleaflet-div-layer').trigger('mouseover');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some other text, some text');

		cy.get('.loleaflet-div-layer').should('exist');
	});

	it('Reply should not be possible', function() {
		insertMultipleComment();

		cy.get('.loleaflet-div-layer').should('exist');

		cy.get('.loleaflet-div-layer').trigger('mouseover');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Reply')
			.should('not.exist');
	});

	it('Remove',function() {
		insertMultipleComment();

		cy.get('.loleaflet-div-layer').should('exist');

		cy.get('.loleaflet-div-layer').trigger('mouseover');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.loleaflet-div-layer').should('not.exist');
	});
});
