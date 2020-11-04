/* global describe it cy require afterEach expect Cypress */

var helper = require('../../common/helper');

describe('Form field button tests.', function() {
	var testFileName = 'shape_operations.odt';

	function before(fileName) {
		testFileName = fileName;
		helper.beforeAll(fileName, 'writer');

		showStatusBar();

		// Blinking cursor is not visible for some reason.
		helper.typeIntoDocument('x');

		cy.get('.blinking-cursor')
			.should('be.visible');
	}
	afterEach(function() {
		helper.afterAll(testFileName, 'writer');
	});

	function showStatusBar() {
		cy.get('#toolbar-down')
			.then(function(statusbar) {
				if (!Cypress.dom.isVisible(statusbar[0])) {
					cy.get('#menu-view')
						.click();

					cy.get('#menu-showstatusbar')
						.click();
				}
			});

		cy.get('#toolbar-down')
			.should('be.visible');
	}

	function buttonShouldNotExist() {
		cy.get('.form-field-frame')
			.should('not.exist');

		cy.get('.form-field-button')
			.should('not.exist');

		cy.get('.drop-down-field-list')
			.should('not.exist');
	}

	function buttonShouldExist() {
		cy.get('.form-field-frame')
			.should('exist');

		cy.get('.form-field-button')
			.should('exist');

		cy.get('.drop-down-field-list')
			.should('exist');

		// Check also the position relative to the blinking cursor
		cy.get('.blinking-cursor')
			.then(function(cursors) {
				// TODO: why we have two blinking cursors here?
				//expect(cursors).to.have.lengthOf(1);

				var cursorRect = cursors[0].getBoundingClientRect();
				cy.get('.form-field-frame')
					.should(function(frames) {
						expect(frames).to.have.lengthOf(1);
						var frameRect = frames[0].getBoundingClientRect();
						expect(frameRect.top).to.at.most(cursorRect.top);
						expect(frameRect.bottom).to.be.at.least(cursorRect.bottom);
						expect(frameRect.left).to.at.most(cursorRect.left);
						expect(frameRect.right).to.be.at.least(cursorRect.right);
					});
			});
	}

	function doZoom(zoomIn) {
		helper.initAliasToEmptyString('prevZoom');

		cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
			.invoke('text')
			.as('prevZoom');

		cy.get('@prevZoom')
			.should('not.be.equal', '');

		if (zoomIn) {
			cy.get('.w2ui-tb-image.w2ui-icon.zoomin')
				.click();
		} else {
			cy.get('.w2ui-tb-image.w2ui-icon.zoomout')
				.click();
		}

		cy.get('@prevZoom')
			.then(function(prevZoom) {
				cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
					.should(function(zoomItem) {
						expect(zoomItem.text()).to.be.not.equal(prevZoom);
					});
			});
	}

	it('Activate and deactivate form field button.', function() {
		before('form_field.odt');

		// We don't have the button by default
		buttonShouldNotExist();

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor again to the other side of the field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor away
		helper.moveCursor('right');

		buttonShouldNotExist();

		// Move the cursor back next to the field
		helper.moveCursor('left');

		buttonShouldExist();
	});

	it('Check drop down list.', function() {
		before('form_field.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		cy.get('.drop-down-field-list')
			.should('not.be.visible');

		// Check content of the list
		cy.get('.drop-down-field-list')
			.should(function(list) {
				expect(list[0].children.length).to.be.equal(4);
				expect(list[0].children[0]).to.have.text('February');
				expect(list[0].children[1]).to.have.text('January');
				expect(list[0].children[2]).to.have.text('December');
				expect(list[0].children[3]).to.have.text('July');
			});

		cy.get('.drop-down-field-list-item.selected')
			.should('have.text', 'February');

		// Select a new item
		cy.get('.form-field-button')
			.click();

		cy.get('.drop-down-field-list')
			.should('be.visible');

		cy.contains('.drop-down-field-list-item', 'July')
			.click();

		// List is hidden, but have the right selected element
		cy.get('.drop-down-field-list')
			.should('not.be.visible');

		cy.get('.drop-down-field-list-item.selected')
			.should('have.text', 'July');
	});

	it('Test field editing', function() {
		before('form_field.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		// Select a new item
		cy.get('.form-field-button')
			.click();

		cy.get('.drop-down-field-list')
			.should('be.visible');

		cy.contains('.drop-down-field-list-item', 'January')
			.click();

		cy.get('.drop-down-field-list-item.selected')
			.should('have.text', 'January');

		// Move the cursor away and back
		helper.moveCursor('left');

		buttonShouldNotExist();

		// Move the cursor back next to the field
		helper.moveCursor('right');

		buttonShouldExist();

		cy.get('.drop-down-field-list-item.selected')
			.should('have.text', 'January');

		// Do the same from the right side of the field.
		helper.moveCursor('right');

		buttonShouldExist();

		// Select a new item
		cy.get('.form-field-button')
			.click();

		cy.get('.drop-down-field-list')
			.should('be.visible');

		cy.contains('.drop-down-field-list-item', 'December')
			.click();

		cy.get('.drop-down-field-list-item.selected')
			.should('have.text', 'December');
	});

	it('Multiple form field button activation.', function() {
		before('multiple_form_fields.odt');

		// We don't have the button by default
		buttonShouldNotExist();

		// Move the cursor next to the first form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor to the other side of the field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor to the second form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor to the other side of the second field
		helper.moveCursor('right');

		buttonShouldExist();

		helper.moveCursor('right');

		buttonShouldNotExist();
	});

	it('Test drop-down field with no selection.', function() {
		before('drop_down_form_field_noselection.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		cy.get('.drop-down-field-list-item.selected')
			.should('not.exist');
	});

	it('Test drop-down field with no items.', function() {
		before('drop_down_form_field_noitem.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		cy.get('.drop-down-field-list-item')
			.should('have.text', 'No Item specified');

		cy.get('.drop-down-field-list-item.selected')
			.should('not.exist');

		cy.get('.form-field-button')
			.click();

		cy.get('.drop-down-field-list')
			.should('be.visible');

		cy.contains('.drop-down-field-list-item', 'No Item specified')
			.click();

		cy.get('.drop-down-field-list-item.selected')
			.should('not.exist');
	});

	it('Test field button after zoom.', function() {
		before('form_field.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Do a zoom in
		doZoom(true);

		buttonShouldExist();

		// Do a zoom out
		doZoom(false);

		buttonShouldExist();

		// Now check that event listener does not do
		// anything stupid after the button is removed.

		// Move the cursor away from the field
		helper.moveCursor('left');

		buttonShouldNotExist();

		// Do a zoom in again
		doZoom(true);
	});

	it('Test dynamic font size.', function() {
		before('form_field.odt');

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Get the initial font size from the style
		helper.initAliasToEmptyString('prevFontSize');

		cy.get('.drop-down-field-list-item')
			.invoke('css', 'font-size')
			.as('prevFontSize');

		cy.get('@prevFontSize')
			.should('not.be.equal', '');

		// Do a zoom in
		doZoom(true);

		buttonShouldExist();

		// Check that the font size was changed
		cy.get('@prevFontSize')
			.then(function(prevFontSize) {
				cy.get('.drop-down-field-list-item')
					.should(function(items) {
						var prevSize = parseInt(prevFontSize, 10);
						var currentSize = parseInt(items.css('font-size'), 10);
						expect(currentSize).to.be.greaterThan(prevSize);
					});
			});

		cy.get('.drop-down-field-list-item')
			.invoke('css', 'font-size')
			.as('prevFontSize');

		// Do a zoom out
		doZoom(false);

		buttonShouldExist();

		// Check that the font size was changed
		cy.get('@prevFontSize')
			.then(function(prevFontSize) {
				cy.get('.drop-down-field-list-item')
					.should(function(items) {
						var prevSize = parseInt(prevFontSize, 10);
						var currentSize = parseInt(items.css('font-size'), 10);
						expect(currentSize).to.be.lessThan(prevSize);
					});
			});
	});
});

