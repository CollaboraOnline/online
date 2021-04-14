/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation Tests',function() {
	var testFileName = 'focus.ods';
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

		cy.get('.loleaflet-div-layer')
			.should('exist');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.beforeAll(testFileName, 'calc', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');

		cy.get('.loleaflet-div-layer')
			.should('exist');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();

		cy.get('.loleaflet-div-layer')
			.should('exist');

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.should('have.text', 'some text');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.type('modified ');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'modified some text');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();

		cy.get('.loleaflet-div-layer')
			.should('exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('not.exist');

		cy.get('.loleaflet-div-layer')
			.should('not.exist');
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

		cy.get('.loleaflet-annotation-content-wrapper.wizard-comment-box')
			.should('not.exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('not.exist');
	});
});
