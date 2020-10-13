/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Annotation tests.', function() {
	var testFileName = 'annotation.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
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

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation-content')
			.should('have.text', 'some text');

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');
	}

	it('Saving comment.', function() {
		insertComment();

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		helper.beforeAll(testFileName, 'impress', true);

		mobileHelper.enableEditingMobile();

		cy.get('.loleaflet-annotation-content')
			.should('have.text', 'some text');

		cy.get('.leaflet-marker-icon.annotation-marker')
			.should('be.visible');
	});

	it('Modifying comment.', function() {
		insertComment();

		mobileHelper.selectAnnotationMenuItem('Modify');

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.should('have.text', 'some text');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.type('modified ');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation-content')
			.should('have.text', 'modified some text');
	});

	// TODO: Reply does not work at all
	it.skip('Reply to comment.', function() {
		insertComment();

		mobileHelper.selectAnnotationMenuItem('Reply');

		cy.get('.loleaflet-annotation-table')
			.should('exist');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.should('have.text', '');

		cy.get('.vex-dialog-form .loleaflet-annotation-textarea')
			.type('reply');

		cy.get('.vex-dialog-button-primary')
			.click();

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation:nth-of-type(1) .loleaflet-annotation-content')
			.should('have.text', 'some text');

		cy.get('.loleaflet-annotation:nth-of-type(2) .loleaflet-annotation-content')
			.should('have.text', 'reply');
	});

	it('Remove comment.', function() {
		insertComment();

		cy.get('.loleaflet-annotation-content')
			.should('have.text', 'some text');

		mobileHelper.selectAnnotationMenuItem('Remove');

		cy.get('.loleaflet-annotation-content')
			.should('not.exist');

		cy.get('.leaflet-marker-icon.annotation-marker')
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

		cy.get('.loleaflet-annotation')
			.should('not.exist');

		cy.get('.loleaflet-annotation-content')
			.should('not.exist');
	});
});
