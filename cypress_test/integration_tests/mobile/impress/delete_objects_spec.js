/* global describe cy it expect beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Delete Objects', function() {
	var testFileName = 'delete_objects.odp';

	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Delete Text', function() {
		cy.get('.leaflet-layer')
			.dblclick('center');

		cy.wait(100);

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

		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});

		//deletion


		cy.get('.leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('not.exist');
	});

	it('Delete Table', function() {
		mobileHelper.openInsertionWizard();

		// Open Table submenu
		cy.contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
			.click();

		cy.get('.mobile-wizard.ui-text')
			.should('be.visible');

		// Push insert table button
		cy.get('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		//delete
		cy.get('path.leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.get('.menu-entry-icon.delete').parent()
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');
	});

	it('Delete Fontwork', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.contains('.menu-entry-with-icon', 'Fontwork...')
			.click();

		cy.get('#FontworkGalleryDialog').should('exist');

		cy.get('#ok').click();

		cy.wait(200);

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		cy.get('.leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Chart...')
			.click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		cy.get('.leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});
});
