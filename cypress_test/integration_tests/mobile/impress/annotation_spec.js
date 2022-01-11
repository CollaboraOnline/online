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

	it.skip('Saving comment.', function() {
		mobileHelper.insertComment();

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.reload(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'some text');

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('.cool-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .cool-annotation-textarea')
			.should('have.text', 'some text');

		cy.get('.vex-dialog-form .cool-annotation-textarea')
			.type('modified ');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('#mobile-wizard .wizard-comment-box.cool-annotation-content-wrapper')
			.should('exist');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('have.text', 'modified some text');
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

		cy.get('.cool-annotation-textarea')
			.should('have.text', '');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.vex-dialog-button-secondary')
			.click();

		cy.get('.cool-annotation-content-wrapper.wizard-comment-box')
			.should('not.exist');

		cy.get('#mobile-wizard .wizard-comment-box .cool-annotation-content')
			.should('not.exist');
	});
});
