/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../common/helper');

describe('Change table properties / layout via mobile wizard.', function() {
	beforeEach(function() {
		helper.loadTestDoc('table.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled');
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Insert row before.', function() {
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
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
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
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
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
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
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
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
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
		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
		cy.get('#TableEditPanel')
			.click();
		cy.get('#DeleteTable')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		cy.get('#copy-paste-container title')
			.should('exist');
		cy.get('#copy-paste-container table')
			.should('not.exist');
	});

	it('Merge cells.', function() {
		cy.get('body').type('{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Insert row
		cy.get('#TableEditPanel')
			.click();
		cy.get('#MergeCells')
			.scrollIntoView();
		cy.get('#MergeCells')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		helper.copyTableToClipboard();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 1);
		cy.get('#copy-paste-container td')
			.should('have.length', 1);
	});
});
