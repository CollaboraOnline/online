/* global describe it cy require afterEach expect Cypress beforeEach*/

var helper = require('../../common/helper');

describe('Change table properties / layout via mobile wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('empty.odt', 'writer');
	});

	afterEach(function() {
		helper.afterAll();
	});

	function before(testFile) {
		helper.loadTestDoc(testFile, 'writer', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled');
	}

	function moveCursorToFirstCell() {
		helper.selectAllMobile();

		cy.get('.blinking-cursor')
			.then(function(cursor) {
				expect(cursor).to.have.lengthOf(1) ;
				var posX = cursor[0].getBoundingClientRect().right + 10;
				var posY = cursor[0].getBoundingClientRect().top + 10;
				cy.get('body')
					.click(posX, posY);
			});
	}

	it('Insert row before.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
		cy.get('#TableEditPanel')
			.click();
		cy.get('#InsertRowsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 4)
			.then(function(rows) {
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);
	});

	it('Insert row after.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
		cy.get('#TableEditPanel')
			.click();
		cy.get('#InsertRowsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 4)
			.then(function(rows) {
				expect(rows[0].textContent).to.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);
	});

	it('Insert column before.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert column
		cy.get('#TableEditPanel')
			.click();
		cy.get('#InsertColumnsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should('have.length', 9)
			.then(function(columns) {
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.have.string('text');
			});
	});

	it('Insert column after.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert column
		cy.get('#TableEditPanel')
			.click();
		cy.get('#InsertColumnsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should('have.length', 9)
			.then(function(columns) {
				expect(columns[0].textContent).to.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
			});
	});

	it('Delete row.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Delete row
		cy.get('#TableEditPanel')
			.click();
		cy.get('#DeleteRows')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 2)
			.then(function(columns) {
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 4);
	});

	it('Delete column.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Delete column
		cy.get('#TableEditPanel')
			.click();
		cy.get('#DeleteColumns')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should('have.length', 3)
			.then(function(columns) {
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
				expect(columns[2].textContent).to.not.have.string('text');
			});
	});

	it('Delete table.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Delete table
		cy.get('#TableEditPanel')
			.click();
		cy.get('#DeleteTable')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Do a new selection
		helper.selectAllMobile();

		// Check markers are in the same row (we have text selection only)
		cy.get('.leaflet-marker-icon')
			.then(function(markers) {
				expect(markers).to.have.lengthOf(2);
				expect(markers[0].getBoundingClientRect().top).to.equal(markers[1].getBoundingClientRect().top);
			});
	});

	it('Merge cells.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{shift}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Merge cells
		cy.get('#TableEditPanel')
			.click();
		cy.get('#MergeCells')
			.scrollIntoView();
		cy.get('#MergeCells')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		cy.get('#copy-paste-container td')
			.should('have.length', 3);
	});

	it('Change row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Check current row height
		cy.get('#TableEditPanel')
			.click();
		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '0');

		cy.get('#rowheight .spinfield')
			.clear()
			.type('3.4')
			.type('{enter}');

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '3.4');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'height', '317');
	});

	it('Change column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table.odt');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Check current column width
		cy.get('#TableEditPanel')
			.click();
		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '3.462');

		cy.get('#columnwidth .spinfield')
			.clear()
			.type('5.6')
			.type('{enter}');

		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '5.6');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '81%');
	});

	it('Set minimal row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Set minimal row height
		cy.get('#TableEditPanel')
			.click();

		cy.get('#SetMinimalRowHeight')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.should('not.have.attr', 'height');
	});

	it('Set optimal row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Set optimal row height
		cy.get('#TableEditPanel')
			.click();

		cy.get('#SetOptimalRowHeight')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 4)
						expect(items[i]).have.attr('height', '106');
					else if (i == 2)
						expect(items[i]).have.attr('height', '107');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Distribute rows.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Distribute rows
		cy.get('#TableEditPanel')
			.click();

		cy.get('#DistributeRows')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 0 || i == 4)
						expect(items[i]).have.attr('height', '106');
					else if (i == 2)
						expect(items[i]).have.attr('height', '107');
					else
						expect(items[i]).not.have.attr('height');
				}
			});
	});

	it('Set minimal column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Set minimal column width
		cy.get('#TableEditPanel')
			.click();

		cy.get('#SetMinimalColumnWidth')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					expect(items[i]).have.attr('width', '24');
				}
			});
	});

	it('Set optimal column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Set optimal column width
		cy.get('#TableEditPanel')
			.click();

		cy.get('#SetOptimalColumnWidth')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					if (i == 1 || i == 3 || i == 5)
						expect(items[i]).have.attr('width', '323');
					else
						expect(items[i]).have.attr('width', '324');
				}
			});
	});

	it('Distribute columns.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Distribute columns
		cy.get('#TableEditPanel')
			.click();

		cy.get('#DistributeColumns')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
				expect(items).have.lengthOf(6);
				for (var i = 0; i < items.length; i++) {
					expect(items[i]).have.attr('width', '323');
				}
			});
	});
});
