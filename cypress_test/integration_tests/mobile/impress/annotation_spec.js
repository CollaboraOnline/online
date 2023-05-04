/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile'], 'Annotation tests.', function() {
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

		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.cGet('.cool-annotation-table').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
		cy.cGet('#input-modal-input').type('modified');
		cy.cGet('#response-ok').click();
		cy.cGet('#tb_actionbar_item_comment_wizard').click();
		cy.cGet('#annotation-content-area-1').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text', 'some textmodified');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();

		cy.cGet('.leaflet-marker-icon.annotation-marker').should('be.visible');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('not.exist');
		cy.cGet('.leaflet-marker-icon.annotation-marker').should('not.exist');
	});

	it('Try to insert empty comment.', function() {
		mobileHelper.openInsertionWizard();

		cy.cGet('body').contains('.menu-entry-with-icon', 'Comment').click();

		cy.cGet('.cool-annotation-table').should('exist');
		cy.cGet('#input-modal-input').should('have.text', '');
		cy.cGet('#response-ok').click();
		cy.cGet('.cool-annotation-content-wrapper.wizard-comment-box').should('not.exist');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('not.exist');
	});
});
