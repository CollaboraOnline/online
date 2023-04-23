/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation tests.', function() {
	var origTestFileName = 'annotation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Saving comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.reload(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('.cool-annotation-table')
			.should('exist');

		cy.get('#annotation-content-area-1')
			.should('have.text', 'some text');

		cy.get('#input-modal-input').type('modified');

		cy.get('#response-ok').click();

		cy.get('#tb_actionbar_item_comment_wizard').click();

		cy.get('#annotation-content-area-1')
			.should('exist');

		cy.get('#annotation-content-area-1')
			.should('have.text', 'some textmodified');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('not.exist');

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('not.exist');
	});

	it('Try to insert empty comment.', function() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		cy.get('.cool-annotation-table')
			.should('exist');

		cy.get('#input-modal-input')
			.should('have.text', '');

		cy.get('#response-ok')
			.click();

		cy.get('.cool-annotation-content-wrapper.wizard-comment-box')
			.should('not.exist');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('not.exist');
	});
});
