/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation tests.', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Saving comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.beforeAll(testFileName, 'writer', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.get('#annotation-content-area-1').should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		//cy.get('.blinking-cursor').should('be.visible');

		cy.get('#new-mobile-comment-input-area').type('{home}modified ');

		cy.get('.vex-dialog-button-primary').click();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'modified some text');
	});

	it('Reply to comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Reply');

		cy.get('#comment-container-1').should('exist');

		cy.get('#new-mobile-comment-input-area').should('have.text', '');

		cy.get('#new-mobile-comment-input-area').type('reply');

		cy.get('.vex-dialog-button-primary').click();

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

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.loleaflet-annotation-textarea')
			.should('have.text', '');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.vex-dialog-button-secondary')
			.click();

		cy.get('#mobile-wizard .wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('not.exist');

		cy.get('#mobile-wizard .wizard-comment-box .loleaflet-annotation-content')
			.should('not.exist');
	});

	it('Resolve comment.', function() {
		// Show resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);

		mobileHelper.insertComment();

		cy.get('#annotation-content-area-1').should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Resolve');

		cy.get('#mobile-wizard .wizard-comment-box .loleaflet-annotation-content-resolved')
			.should('exist');

		cy.get('#mobile-wizard .wizard-comment-box .loleaflet-annotation-content-resolved')
			.should('have.text', 'Resolved');
	});
});
