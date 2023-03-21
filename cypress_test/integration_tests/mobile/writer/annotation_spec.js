/* global describe it cy Cypress beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe.skip('Annotation tests.', function() {
	var origTestFileName = 'annotation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Saving comment.', function() {
		cy.wait(1000);

		mobileHelper.insertComment();

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		//reset get to original function
		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			return originalFn(selector, options);
		});

		helper.reload(testFileName, 'writer', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		helper.waitUntilIdle('#mobile-wizard-content', undefined);

		cy.get('#annotation-content-area-1').should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		//cy.get('.blinking-cursor').should('be.visible');

		cy.get('#input-modal-input').type('{home}modified ');

		cy.get('.button-primary').click();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'modified some text');
	});

	it('Reply to comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Reply');

		cy.get('#comment-container-1').should('exist');

		cy.get('#input-modal-input').should('have.text', '');

		cy.get('#input-modal-input').type('reply');

		cy.get('.button-primary').click();

		cy.get('#comment-container-2').should('exist');

		//cy.get('#annotation-content-area-1').should('have.text', 'some text');
		//cy.get('#annotation-content-area-2').should('have.text', 'reply');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('#annotation-content-area-1').should('not.exist');
	});

	it('Try to insert empty comment.', function() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		cy.get('.cool-annotation-table')
			.should('exist');

		cy.get('.cool-annotation-textarea')
			.should('have.text', '');

		cy.get('.button-primary')
			.click();

		cy.get('.button-secondary')
			.click();

		cy.get('#mobile-wizard .wizard-comment-box.cool-annotation-content-wrapper')
			.should('not.exist');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('not.exist');
	});

	it('Resolve comment.', function() {
		// Show resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);

		mobileHelper.insertComment();

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Resolve');

		cy.wait(1000);

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content-resolved')
			.should('exist');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content-resolved')
			.should('have.text', 'Resolved');
	});
});
