/* global describe it cy require expect afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe('Change table properties / layout via mobile wizard.', function() {
	var testFileName = '';

	function before(testFile) {
		testFileName = testFile;
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openTablePanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#TableEditPanel');

		cy.get('#InsertRowsBefore')
			.should('be.visible');
	}

	function selectFullTable() {
		helper.clickOnIdle('#SelectTable');

		cy.get('#copy-paste-container table')
			.should('exist');
	}

	it('Insert row before.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#InsertRowsBefore');

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);
	});

	it('Insert row after.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#InsertRowsAfter');

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);
	});

	it('Insert column before.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#InsertColumnsBefore');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.have.string('text');
			});
	});

	it('Insert column after.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#InsertColumnsAfter');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
			});
	});

	it('Delete row.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#DeleteRows');

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(2);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 4);
	});

	it('Delete column.', function() {
		before('table_properties.odt');

		// Insert column first
		openTablePanel();

		helper.clickOnIdle('#InsertColumnsBefore');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		// Then delete it
		mobileHelper.closeMobileWizard();
		openTablePanel();

		helper.clickOnIdle('#DeleteColumns');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);
	});

	it('Delete table.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.clickOnIdle('#DeleteTable');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		// Check markers are in the same row (we have text selection only)
		cy.get('.leaflet-marker-icon')
			.should(function(markers) {
				expect(markers).to.have.lengthOf(2);
				expect(markers[0].getBoundingClientRect().top).to.equal(markers[1].getBoundingClientRect().top);
			});
	});

	it('Merge cells.', function() {
		before('table_properties.odt');

		// Select 2x2 part of the table.
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		// We use cursor position as the indicator of layout change.
		helper.getCursorPos('top', 'origCursorPos');

		openTablePanel();

		helper.clickOnIdle('#MergeCells');

		// Cursor was in the second row originally.
		// With merging two rows, the cursor is moved into the first row.
		cy.get('@origCursorPos')
			.then(function(origCursorPos) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.lessThan(origCursorPos);
					});
			});

		selectFullTable();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		cy.get('#copy-paste-container td')
			.should('have.length', 3);
	});

	it('Change row height.', function() {
		before('table_properties.odt');

		openTablePanel();

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '0');

		helper.typeIntoInputField('#rowheight .spinfield', '1.4', true, false);

		selectFullTable();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'height', '125');
	});

	it.skip('Change column width.', function() {
		before('table_properties.odt');

		openTablePanel();

		helper.typeIntoInputField('#columnwidth .spinfield', '1.6', true, false);

		selectFullTable();

		// Check column width
		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '145');
	});

	it('Set minimal row height.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#SetMinimalRowHeight');

		selectFullTable();

		// Check new row height
		cy.get('#copy-paste-container td')
			.should('not.have.attr', 'height');
	});

	it('Set optimal row height.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#SetOptimalRowHeight');

		selectFullTable();

		// Check new row height
		cy.get('#copy-paste-container td')
			.should(function(items) {
				expect(items).to.have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 4)
						expect(items[i]).have.attr('height', '33');
					else if (i == 2)
						expect(items[i]).have.attr('height', '34');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Distribute rows.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#DistributeRows');

		selectFullTable();

		// Check new row height
		cy.get('#copy-paste-container td')
			.should(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 4)
						expect(items[i]).have.attr('height', '33');
					else if (i == 2)
						expect(items[i]).have.attr('height', '34');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Set minimal column width.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#SetMinimalColumnWidth');

		selectFullTable();

		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '24');
	});

	it('Set optimal column width.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#SetOptimalColumnWidth');

		selectFullTable();

		cy.get('#copy-paste-container td:nth-of-type(1n)')
			.should('have.attr', 'width', '324');
		cy.get('#copy-paste-container td:nth-of-type(2n)')
			.should('have.attr', 'width', '323');
	});

	it('Distribute columns.', function() {
		before('table_with_text.odt');

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		openTablePanel();

		helper.clickOnIdle('#DistributeColumns');

		selectFullTable();

		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '323');
	});
});
