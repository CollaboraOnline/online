/* global describe beforeEach cy it expect require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {

	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/delete_objects.odt');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	it('Delete Text', function() {
		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Shape').click();
		cy.cGet('.col.w2ui-icon.basicshapes_rectangle').click();
		// Check that the shape is there
		cy.cGet('#canvas-container > svg').should('exist');
		cy.cGet('#canvas-container > svg > svg').then(function(svg) {
				expect(parseInt(svg[0].style.width.replace('px', ''))).to.be.greaterThan(0);
				expect(parseInt(svg[0].style.height.replace('px', ''))).to.be.greaterThan(0);
			});

		//deletion
		cy.cGet('.leaflet-layer')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete').should('be.visible').click();
		cy.cGet('#document-container svg g').should('not.exist');
	});

	it('Delete Table', function() {
		helper.setDummyClipboardForCopy();
		mobileHelper.openInsertionWizard();
		// Open Table submenu
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table').click();
		cy.cGet('.mobile-wizard.ui-text').should('be.visible');
		// Push insert table button
		cy.cGet('.inserttablecontrols button').should('be.visible').click();
		// Table is inserted with the markers shown
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('exist');
		helper.typeIntoDocument('{ctrl}a');
		helper.copy();
		// Two rows
		cy.cGet('#copy-paste-container tr').should('have.length', 2);
		// Four cells
		cy.cGet('#copy-paste-container td').should('have.length', 4);
		//delete
		cy.cGet('.leaflet-marker-icon.table-select-marker').eq(0).trigger('pointerdown', eventOptions).wait(1000);

		cy.cGet('.menu-entry-icon.tabledeletemenu').parent()
			.click()
			.cGet('.menu-entry-icon.deletetable').parent()
			.click();

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('not.exist');
	});

	it('Delete Fontwork', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Fontwork...').click();
		cy.cGet('#FontworkGalleryDialog').should('exist');
		cy.cGet('#ok').click();
		cy.wait(1000);

		cy.cGet('#test-div-shapeHandlesSection').should('exist');

		cy.cGet('#canvas-container')
			.then(function(container) {
				var x = parseInt(container[0].style.left.replace('px', '')) + parseInt(container[0].style.width.replace('px', '')) / 2;
				var y = parseInt(container[0].style.top.replace('px', '')) + parseInt(container[0].style.height.replace('px', '')) / 2;

				cy.cGet('.leaflet-layer')
				.trigger('pointerdown', x, y, { force: true, button: 0, pointerType: 'mouse' })
				.wait(2000)
				.trigger('pointerup', x, y, { force: true, button: 0, pointerType: 'mouse' });
			});

		cy.wait(1000);
		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete').should('be.visible').click();
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});

	it('Delete Chart' , function() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Chart...').click();
		cy.cGet('#test-div-shapeHandlesSection').should('exist');

		cy.cGet('#canvas-container')
		.then(function(container) {
			var x = parseInt(container[0].style.left.replace('px', '')) + parseInt(container[0].style.width.replace('px', '')) / 2;
			var y = parseInt(container[0].style.top.replace('px', '')) + parseInt(container[0].style.height.replace('px', '')) / 2;

			cy.cGet('.leaflet-layer')
			.trigger('pointerdown', x, y, { force: true, button: 0, pointerType: 'mouse' })
			.wait(2000)
			.trigger('pointerup', x, y, { force: true, button: 0, pointerType: 'mouse' });
		});

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete').should('be.visible').click();
		cy.cGet('#test-div-shapeHandlesSection').should('not.exist');
	});
});
