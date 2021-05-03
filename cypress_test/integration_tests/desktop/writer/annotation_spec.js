/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment();

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');
	});

	it('Modify',function() {
		insertMultipleComment();

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Modify')
			.click();

		cy.get('.loleaflet-annotation-edit.modify-annotation')
			.type('some other text, ');

		cy.get('.loleaflet-annotation-edit.modify-annotation #annotation-save')
			.click();

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some other text, some text');
	});

	it('Reply',function() {
		insertMultipleComment();

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Reply')
			.click();

		cy.get('.loleaflet-annotation-edit.reply-annotation')
			.type('some reply text');

		cy.get('.loleaflet-annotation-edit.reply-annotation #annotation-reply')
			.click();

		cy.get('.loleaflet-annotation-content > div').eq(1)
			.should('contain','some reply text');
	});

	it('Remove',function() {
		insertMultipleComment();

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('.loleaflet-annotation-content > div')
			.should('contain','some text');

		cy.get('.loleaflet-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.loleaflet-annotation-content-wrapper')
			.should('not.exist');
	});

});
