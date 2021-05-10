/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('../../common/calc_helper');

describe('Delete Objects',function() {
	var testFileName = 'delete_objects.ods';

	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Delete Text', function() {
		calcHelper.dblClickOnFirstCell();

		helper.typeIntoDocument('text');

		helper.selectAllText();

		helper.expectTextForClipboard('text');

		helper.typeIntoDocument('{del}');

		helper.typeIntoDocument('{ctrl}a');

		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.contains('.menu-entry-with-icon', 'Shape')
			.click();

		cy.get('.col.w2ui-icon.basicshapes_rectangle').
			click();

		// Check that the shape is there
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		//deletion
		cy.get('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Chart')
			.click();

		cy.get('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.should('exist');

		//deletion
		cy.get('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.should('not.exist');
	});
});
