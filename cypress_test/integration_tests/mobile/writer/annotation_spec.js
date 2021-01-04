/* global describe it cy beforeEach require afterEach Cypress*/

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

	function insertComment() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Comment')
			.click();

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.loleaflet-annotation-textarea')
			.type('some text');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');
	}

	it('Saving comment.', function() {
		insertComment();

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.beforeAll(testFileName, 'writer', true);

		mobileHelper.enableEditingMobile();

		mobileHelper.openCommentWizard();

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.should('have.text', 'some text');

		cy.get('.blinking-cursor')
			.should('be.visible');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.type('{home}modified ');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'modified some text');
	});

	it('Reply to comment.', function() {
		insertComment();

		// TODO: we wait for a focus event before replying because
		// it would grab the focus from the dialog otherwise.
		if (Cypress.env('CYPRESS_INTEGRATION') === 'php-proxy') {
			cy.wait(2000);
		}

		mobileHelper.selectAnnotationMenuItem('Reply');

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.should('have.text', '');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.type('reply');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('exist');

		cy.get('.ui-content .wizard-comment-box.loleaflet-annotation-content-wrapper:nth-of-type(1) .loleaflet-annotation-content')
			.should('have.text', 'some text');

		cy.get('.ui-content .wizard-comment-box.loleaflet-annotation-content-wrapper:nth-of-type(2) .loleaflet-annotation-content')
			.should('have.text', 'reply');
	});

	it('Remove comment.', function() {
		insertComment();

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
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

		cy.get('.wizard-comment-box.loleaflet-annotation-content-wrapper')
			.should('not.exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('not.exist');
	});

	it('Resolve comment.', function() {
		// Show resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);

		insertComment();

		cy.get('.wizard-comment-box .loleaflet-annotation-content')
			.should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Resolve');

		cy.get('.wizard-comment-box .loleaflet-annotation-content-resolved')
			.should('exist');

		cy.get('.wizard-comment-box .loleaflet-annotation-content-resolved')
			.should('have.text', 'Resolved');
	});
});
