/* -*- js-indent-level: 8 -*- */
/* global describe it cy require expect afterEach beforeEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Slide operations', function() {
	var origTestFileName = 'slide_operations.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Add slides', function() {
		helper.clickOnIdle('#tb_presentation-toolbar_item_insertpage');

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Remove slides', function() {
		// Add slides
		helper.clickOnIdle('#tb_presentation-toolbar_item_insertpage');

		impressHelper.assertNumberOfSlidePreviews(2);

		// Remove Slides
		cy.cGet('#tb_presentation-toolbar_item_deletepage')
			.should('not.have.class', 'disabled')
			.click();

		cy.cGet('#modal-dialog-deleteslide-modal .button-primary').click();

		cy.cGet('#tb_presentation-toolbar_item_deletepage')
			.should('have.class', 'disabled');

		impressHelper.assertNumberOfSlidePreviews(1);

	});

	it('Duplicate slide', function() {
		// Also check if comments are getting duplicated
		cy.cGet('#options-modify-page').click();
		desktopHelper.insertComment();
		cy.cGet('#annotation-content-area-1').should('include.text', 'some text0');
		helper.clickOnIdle('#tb_presentation-toolbar_item_duplicatepage');

		impressHelper.assertNumberOfSlidePreviews(2);
		cy.cGet('#PageStatus').should('have.text', 'Slide 2 of 2');
		cy.cGet('#annotation-content-area-2').should('include.text', 'some text0');

	});

	it('Slide pane height test', function() {
		var container, content, toolbar;

		cy.cGet('#slide-sorter')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				content = items[0].getBoundingClientRect();
			});

		cy.cGet('#presentation-toolbar')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				toolbar = items[0].getBoundingClientRect();
			});

		cy.cGet('#presentation-controls-wrapper')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				container = items[0].getBoundingClientRect();
				expect(container.height).equal(content.height + toolbar.height);
			});
	});
});
