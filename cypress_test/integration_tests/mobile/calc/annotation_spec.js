/* global describe it Cypress cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation Tests',function() {
	var origTestFileName = 'annotation.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Saving comment.', function() {
		mobileHelper.insertComment();

		cy.get('#comment-container-1').should('exist');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		//reset get to original function
		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			return originalFn(selector, options);
		});

		helper.reload(testFileName, 'calc', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		helper.waitUntilIdle('#mobile-wizard-content', undefined);

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		cy.get('#comment-container-1').should('exist');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		cy.get('#comment-container-1').should('exist');

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		cy.get('#input-modal-input').type('modified');

		cy.get('#response-ok').click();

		cy.get('#tb_actionbar_item_comment_wizard').click();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'some textmodified');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('#annotation-content-area-1').should('not.exist');

		cy.get('#comment-container-1').should('not.exist');
	});

	it('Try to insert empty comment.', function() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		cy.get('.cool-annotation-table')
			.should('exist');

		cy.get('#input-modal-input')
			.should('have.text', '');

		cy.get('#response-ok').click();

		cy.get('.cool-annotation-content-wrapper.wizard-comment-box')
			.should('not.exist');

		cy.get('.wizard-comment-box .cool-annotation-content')
			.should('not.exist');
	});
});
