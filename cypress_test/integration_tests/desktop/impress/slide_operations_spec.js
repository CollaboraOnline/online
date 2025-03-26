/* -*- js-indent-level: 8 -*- */
/* global describe it cy require expect beforeEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Slide operations', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/slide_operations.odp');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Add slides', function() {
		cy.cGet('#presentation-toolbar #insertpage').click();

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Remove slides', function() {
		// Add slides
		cy.cGet('#presentation-toolbar #insertpage').click();

		impressHelper.assertNumberOfSlidePreviews(2);

		// Remove Slides
		cy.cGet('#presentation-toolbar #deletepage')
			.should('not.have.attr', 'disabled');

		cy.cGet('#presentation-toolbar #deletepage')
			.click();

		cy.cGet('#modal-dialog-deleteslide-modal .button-primary').click();

		cy.cGet('#presentation-toolbar #deletepage')
			.should('have.attr', 'disabled')

		impressHelper.assertNumberOfSlidePreviews(1);

	});

	it('Duplicate slide', function() {
		// Also check if comments are getting duplicated
		cy.cGet('#options-modify-page').click();
		desktopHelper.insertComment();
		cy.cGet('[id^=annotation-content-area-]').should('include.text', 'some text0');
		cy.cGet('#presentation-toolbar #duplicatepage').click();

		impressHelper.assertNumberOfSlidePreviews(2);
		cy.cGet('#SlideStatus').should('have.text', 'Slide 2 of 2');
		cy.cGet('[id^=annotation-content-area-]').should('include.text', 'some text0');

	});

	// Skip it for now will enable it after Despatch nav patch get merged in CORE 25.04
	it('Navigator height test', function() {
		var navigationContainer, navOptionContainer, presentationWrapper, navHeading;

		cy.cGet('.navigation-header')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				navHeading = items[0].getBoundingClientRect();
			});

		cy.cGet('.navigation-options-container')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				navOptionContainer = items[0].getBoundingClientRect();
			});


		cy.cGet('#presentation-controls-wrapper')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				presentationWrapper = items[0].getBoundingClientRect();
			});

		cy.cGet('#navigation-sidebar')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				navigationContainer = items[0].getBoundingClientRect();
				expect(navigationContainer.height).equal(navHeading.height + navOptionContainer.height + presentationWrapper.height);
			});
	});
});
