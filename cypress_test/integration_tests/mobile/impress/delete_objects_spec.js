/* global describe cy it beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {

	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/delete_objects.odp');

		mobileHelper.enableEditingMobile();
	});

	it('Delete Text', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#document-container').dblclick('center');

		cy.wait(100);

		helper.typeIntoDocument('text');

		helper.selectAllText();
		helper.copy();

		helper.expectTextForClipboard('text');

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
		cy.cGet('#document-container svg g').should('exist');

		//cy.cGet('#document-container svg')
		//	.then(function(svg) {
		//		expect(svg[0].getBoundingClientRect().width).to.be.greaterThan(0);
		//		expect(svg[0].getBoundingClientRect().height).to.be.greaterThan(0);
		//	});

		//deletion

		cy.cGet('#document-container')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.cGet('#document-container svg g').should('not.exist');
	});

	it('Delete Table', function() {
		mobileHelper.openInsertionWizard();

		// Open Table submenu
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', 'Table')
			.click();

		cy.cGet('.mobile-wizard.ui-text')
			.should('be.visible');

		// Push insert table button
		cy.cGet('.inserttablecontrols button')
			.should('be.visible')
			.click();

		// Table is inserted with the markers shown
		cy.cGet('.table-column-resize-marker')
			.should('exist');

		//delete
		cy.cGet('#document-container')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('.menu-entry-icon.delete').parent()
			.click();

		cy.cGet('.table-column-resize-marker')
			.should('not.exist');
	});

	it('Delete Fontwork', function() {
		mobileHelper.openInsertionWizard();

		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Fontwork...')
			.click();

		cy.cGet('#FontworkGalleryDialog').should('exist');
		cy.cGet('#FontworkGalleryDialog #ok.ui-pushbutton-wrapper button').click();
		cy.cGet('#FontworkGalleryDialog').should('not.exist');

		cy.wait(200);

		cy.cGet('#test-div-shapeHandlesSection')
			.should('exist');

		cy.cGet('#document-container')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.cGet('#test-div-shapeHandlesSection')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		mobileHelper.openInsertionWizard();

		cy.cGet('body').contains('.menu-entry-with-icon', 'Chart...')
			.click();

		cy.cGet('#test-div-shapeHandlesSection')
			.should('exist');

		cy.cGet('#document-container')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.cGet('#test-div-shapeHandlesSection')
			.should('not.exist');
	});
});
