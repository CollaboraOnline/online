/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile'], 'Annotation tests.', function() {
	var newFilePath;

	beforeEach(function() {
		newFilePath = helper.setupAndLoadDocument('writer/annotation.odt');

		mobileHelper.enableEditingMobile();
	});

	it('Saving comment.', { defaultCommandTimeout: 60000 }, function() {
		mobileHelper.insertComment();
		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);
		helper.reloadDocument(newFilePath);
		mobileHelper.enableEditingMobile();
		mobileHelper.openCommentWizard();
		helper.waitUntilIdle('#mobile-wizard-content', undefined);
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
	});

	it('Modifying comment.', function() {
		mobileHelper.insertComment();
		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.cGet('#comment-container-1').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');

		//cy.get('.blinking-cursor').should('be.visible');
		cy.cGet('#input-modal-input').type('{home}modified ');
		cy.cGet('#response-ok').click();
		cy.cGet('#toolbar-up #comment_wizard').click();
		cy.cGet('#comment-container-1').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text', 'modified some text');
	});

	it('Reply to comment.', function() {
		mobileHelper.insertComment();
		mobileHelper.selectAnnotationMenuItem('Reply');
		cy.cGet('#comment-container-1').should('exist');
		cy.cGet('#input-modal-input').should('have.text', '');
		cy.cGet('#input-modal-input').type('reply');
		cy.cGet('#response-ok').click();
		cy.cGet('#comment-container-1').click();
		cy.cGet('#comment-container-2').should('exist');
	});

	it('Remove comment.', function() {
		mobileHelper.insertComment();
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
		mobileHelper.selectAnnotationMenuItem('Remove');
		cy.cGet('#annotation-content-area-1').should('not.exist');
	});

	it('Try to insert empty comment.', function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Comment').click();
		cy.cGet('#input-modal-input').should('exist');
		cy.cGet('#input-modal-input').should('have.text', '');
		cy.cGet('#response-ok').click();
		cy.cGet('#mobile-wizard .wizard-comment-box.cool-annotation-content-wrapper').should('not.exist');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content').should('not.exist');
	});

	it('Resolve comment.', function() {
		// Show resolved comments
		mobileHelper.selectHamburgerMenuItem(['View', 'Resolved Comments']);
		mobileHelper.insertComment();
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
		mobileHelper.selectAnnotationMenuItem('Resolve');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content-resolved').should('exist');
		cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-content-resolved').should('have.text', 'Resolved');
	});
});
