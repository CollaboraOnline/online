/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var testFileName = 'annotation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Insert',function() {
		insertMultipleComment('calc');

		cy.get('.cool-annotation').should('exist');

		cy.get('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.get('#comment-container-1').trigger('mouseover');

		cy.get('#annotation-content-area-1').should('contain','some text');
	});

	it('Modify',function() {
		insertMultipleComment('calc');

		cy.get('#comment-container-1').should('exist');

		cy.get('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.get('#comment-container-1').trigger('mouseover');

		cy.get('#annotation-content-area-1').should('contain','some text');

		cy.get('#comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Modify').click();

		cy.get('#annotation-modify-textarea-1').type('some other text, ');

		cy.get('#annotation-save-1').click();

		cy.get('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.get('#annotation-content-area-1').trigger('mouseover');

		cy.get('#annotation-content-area-1').should('contain','some other text, some text');

		cy.get('#comment-container-1').should('exist');
	});

	it('Reply should not be possible', function() {
		insertMultipleComment('calc');

		cy.get('#comment-container-1').should('exist');

		cy.get('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.get('#comment-container-1').trigger('mouseover');

		cy.get('#annotation-content-area-1').should('contain','some text');

		cy.get('#comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Reply').should('not.exist');
	});

	it('Remove',function() {
		insertMultipleComment('calc');

		cy.get('#comment-container-1').should('exist');

		cy.get('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.get('#comment-container-1').trigger('mouseover');

		cy.get('#annotation-content-area-1').should('contain','some text');

		cy.get('#comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Remove').click();

		cy.get('#comment-container-1').should('not.exist');
	});
});
