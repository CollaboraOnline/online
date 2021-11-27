/* global describe it Cypress cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation Tests',function() {
	var testFileName = 'annotation.ods';
	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

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

		helper.beforeAll(testFileName, 'calc', true);

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

		cy.get('#new-mobile-comment-input-area').type('modified ');

		cy.get('.vex-dialog-button-primary').click();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'modified some text');
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

		cy.get('.cool-annotation-textarea')
			.should('have.text', '');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.vex-dialog-button-secondary')
			.click();

		cy.get('.cool-annotation-content-wrapper.wizard-comment-box')
			.should('not.exist');

		cy.get('.wizard-comment-box .cool-annotation-content')
			.should('not.exist');
	});
});
