/* global describe it cy beforeEach Cypress require afterEach expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var mode = Cypress.env('USER_INTERFACE');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Table operations', function() {
	var origTestFileName = 'table_operation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		desktopHelper.switchUIToNotebookbar();
		desktopHelper.selectZoomLevel('70');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectFullTable() {
		helper.moveCursor('down');

		helper.typeIntoDocument('{ctrl}{a}');

		cy.cGet('#copy-paste-container table').should('exist');
	}

	it('Insert row before.', function() {
		helper.clickOnIdle('#insert .unoInsertRowsBefore');
		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.have.string('text');
			});
		cy.cGet('#copy-paste-container td').should('have.length', 8);
	});

	it('Insert row after.', function() {
		helper.clickOnIdle('#insert .unoInsertRowsAfter');
		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.cGet('#copy-paste-container td').should('have.length', 8);
	});

	it('Insert column before.', function() {

		helper.clickOnIdle('#insert .unoInsertColumnsBefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr').should('have.length', 3);
		cy.cGet('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.have.string('text');
			});

	});

	it('Insert column after.', function() {
		helper.clickOnIdle('#insert .unoInsertColumnsAfter');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 4);

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr').should('have.length', 3);
		cy.cGet('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
			});
	});

	it('Delete row.', function() {
		helper.clickOnIdle('#delete .unoDeleteRows');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 2);

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(2);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.cGet('#copy-paste-container td').should('have.length', 4);
	});

	it('Delete column.', function() {
		// Insert column first
		helper.clickOnIdle('#insert .unoInsertColumnsBefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 4);

		// Then delete it
		helper.clickOnIdle('#delete .unoDeleteColumns');
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 3);
	});

	it('Delete table.', function() {
		helper.clickOnIdle('#delete .unoDeleteTable');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('not.exist');
	});

	it('Merge cells.', function() {

		// Select 2x2 part of the table.
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		// We use cursor position as the indicator of layout change.
		helper.getCursorPos('top', 'origCursorPos');

		// Cursor was in the second row originally.
		// With merging two rows, the cursor is moved into the first row.
		cy.get('@origCursorPos')
			.then(function(origCursorPos) {
				helper.clickOnIdle('#split_merge .unoMergeCells');
				cy.cGet('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().top).to.be.lessThan(origCursorPos);
					});
			});

		selectFullTable();

		// Check rows / columns
		cy.cGet('#copy-paste-container tr').should('have.length', 2);
		cy.cGet('#copy-paste-container td').should('have.length', 3);
	});

	//Fixme: bug in notebookbar cannot change the rowheight when the table already exist in document
	it('Change row height.', function() {
		if (mode === 'classic') {
			cy.cGet('#rowheight .spinfield').should('have.value', '0');
			helper.typeIntoInputField('#rowheight .spinfield', '1.4', true, false);
			selectFullTable();
			// Check row height
			cy.cGet('#copy-paste-container td').should('have.attr', 'height', '134');
		}
	});

	//Fixme: bug in notebookbar cannot change the columnheight when the table already exist in document
	it('Change column width.', function() {
		if (mode === 'classic') {
			helper.typeIntoInputField('#columnwidth .spinfield', '1.6', true, false);
			selectFullTable();
			// Check column width
			cy.cGet('#copy-paste-container td').should('have.attr', 'width', '23%');
		}
	});

	it('Set minimal row height.', function() {

		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		helper.clickOnIdle('#rowsizing .unoSetMinimalRowHeight');

		selectFullTable();

		// Check new row height
		cy.cGet('#copy-paste-container td').should('not.have.attr', 'height');
	});

	it('Set optimal row height.', function() {
		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');
		helper.clickOnIdle('#rowsizing .unoSetOptimalRowHeight');
		selectFullTable();

		// Check new row height
		cy.cGet('#copy-paste-container td')
			.should(function(items) {
				expect(items).to.have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 2 || i == 4)
						expect(items[i]).have.attr('height', '18');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Distribute rows.', function() {
		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		helper.clickOnIdle('#rowsizing .unoDistributeRows');

		selectFullTable();

		// Check new row height
		cy.cGet('#copy-paste-container td')
			.should(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 2 || i == 4)
						expect(items[i]).have.attr('height', '18');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Set minimal column width.', function() {
		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		helper.clickOnIdle('#columnsizing .unoSetMinimalColumnWidth');

		selectFullTable();

		cy.cGet('#copy-paste-container td').should('have.attr', 'width', '25');
	});

	it('Set optimal column width.', function() {
		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		helper.clickOnIdle('#columnsizing .unoSetOptimalColumnWidth');

		selectFullTable();

		cy.cGet('#copy-paste-container td:nth-of-type(1n)').should('have.attr', 'width', '90%');
		cy.cGet('#copy-paste-container td:nth-of-type(2n)').should('have.attr', 'width', '10%');
	});

	it('Distribute columns.', function() {
		// Select full table (3x2)
		helper.moveCursor('down', 'shift');
		helper.moveCursor('down', 'shift');
		helper.moveCursor('right', 'shift');

		helper.clickOnIdle('#columnsizing .unoDistributeColumns');

		selectFullTable();

		cy.cGet('#copy-paste-container td').should('have.attr', 'width', '50%');
	});

	it('Split Cells', function() {
		helper.typeIntoDocument('{downarrow}');

		helper.typeIntoDocument('{ctrl}{a}');

		helper.waitUntilIdle('#copy-paste-container');

		cy.cGet('#copy-paste-container colgroup').find('col').should('have.length', 2);
		cy.cGet('#copy-paste-container tbody').find('tr').should('have.length', 3);
		helper.typeIntoDocument('{leftarrow}');
		cy.cGet('.unospan-split_merge.unoSplitCell').click();
		cy.cGet('.lokdialog.ui-dialog-content.ui-widget-content').should('exist');
		cy.cGet('.lokdialog.ui-dialog-content.ui-widget-content').click();
		cy.cGet('#ok.ui-pushbutton.jsdialog').should('exist');
		cy.cGet('#ok.ui-pushbutton.jsdialog').click();

		helper.typeIntoDocument('{ctrl}{a}');

		helper.waitUntilIdle('#copy-paste-container');

		cy.cGet('#copy-paste-container colgroup').find('col').should('have.length', 2);
		cy.cGet('#copy-paste-container tbody').find('tr').should('have.length', 4);
	});
});
