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

	it.skip('Saving comment.', function() {
		mobileHelper.insertComment();

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.reload(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'some text');

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.cGet('.cool-annotation-table').should('exist');
		cy.cGet('.vex-dialog-form .cool-annotation-textarea').should('have.text', 'some text');
		cy.cGet('.vex-dialog-form .cool-annotation-textarea').type('modified ');
		cy.cGet('.vex-dialog-buttons .button-primary').click();
		cy.cGet('#mobile-wizard .wizard-comment-box.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('have.text', 'modified some text');
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
		cy.cGet('.cool-annotation-textarea').should('have.text', '');
		cy.cGet('.button-primary').click();
		cy.cGet('.button-secondary').click();
		cy.cGet('.cool-annotation-content-wrapper.wizard-comment-box').should('not.exist');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('not.exist');
	});
});
