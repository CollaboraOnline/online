/* global describe it Cypress cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertMultipleComment, hideSidebar, selectZoomLevel } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		cy.viewport(1400, 600);
		helper.beforeAll(testFileName, 'writer');
		var mode = Cypress.env('USER_INTERFACE');
		if (mode === 'notebookbar') {
			cy.get('#Sidebar')
				.should('have.class', 'selected');

			cy.get('#Sidebar')
				.click();

			cy.get('#Sidebar')
				.should('not.have.class', 'selected');
		} else {
			hideSidebar();
		}
		selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment('writer');

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify',function() {
		insertMultipleComment('writer');

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');

		cy.get('#comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Modify').click();

		cy.get('#annotation-modify-textarea-1').type('some other text, ');

		cy.get('#annotation-save-1').click();

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply',function() {
		insertMultipleComment('writer');

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text');

		cy.get('#comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Reply').click();

		cy.get('#annotation-reply-textarea-1').type('some reply text');

		cy.get('#annotation-reply-1').click();

		cy.get('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove',function() {
		insertMultipleComment('writer');

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('.cool-annotation-content > div')
			.should('contain','some text');

		cy.get('.cool-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.cool-annotation-content-wrapper')
			.should('not.exist');
	});

});

describe('Collapsed Annotation Tests', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment('writer', 1, true);

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify',function() {
		insertMultipleComment('writer', 1, true);

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');

		cy.get('#comment-container-1 .cool-annotation-collapsed .avatar-img').click();

		cy.get('#mobile-wizard-popup #comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Modify').click();

		cy.get('#mobile-wizard-popup  #annotation-modify-textarea-1').type('some other text, ');

		cy.get('#mobile-wizard-popup  #annotation-save-1').click();

		cy.get('#mobile-wizard-popup .cool-annotation-content-wrapper').should('exist');

		cy.get('#mobile-wizard-popup #annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply',function() {
		insertMultipleComment('writer', 1, true);

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text');

		cy.get('#comment-container-1 .cool-annotation-collapsed .avatar-img').click();

		cy.get('#mobile-wizard-popup #comment-annotation-menu-1').click();

		cy.contains('.context-menu-item','Reply').click();

		cy.get('#mobile-wizard-popup #annotation-reply-textarea-1').type('some reply text');

		cy.get('#mobile-wizard-popup #annotation-reply-1').click();

		cy.get('#mobile-wizard-popup #annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove',function() {
		insertMultipleComment('writer', 1, true);

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('.cool-annotation-content > div')
			.should('contain','some text');

		cy.get('#comment-container-1 .cool-annotation-collapsed .avatar-img').click();

		cy.get('#mobile-wizard-popup .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.cool-annotation-content-wrapper')
			.should('not.exist');
	});

});
