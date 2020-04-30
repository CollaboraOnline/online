/* global describe it cy require expect Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Change table properties / layout via mobile wizard.', function() {
	function before(testFile) {
		helper.loadTestDoc(testFile, 'writer', true);

		// Click on edit button
		mobileHelper.enableEditingMobile();
	}

	function openTablePanel() {
		mobileHelper.openMobileWizard();

		// Open table panel
		cy.get('#TableEditPanel')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	}

	function moveCursorToFirstCell() {
		writerHelper.selectAllMobile();

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

		before('table_properties.odt');

		openTablePanel();

		cy.get('#InsertRowsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);

		helper.afterAll('table_properties.odt');
	});

	it('Insert row after.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#InsertRowsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(4);
				expect(rows[0].textContent).to.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 8);

		helper.afterAll('table_properties.odt');
	});

	it('Insert column before.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#InsertColumnsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.have.string('text');
			});

		helper.afterAll('table_properties.odt');
	});

	it('Insert column after.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#InsertColumnsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(9);
				expect(columns[0].textContent).to.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
			});

		helper.afterAll('table_properties.odt');
	});

	it('Delete row.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#DeleteRows')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should(function(rows) {
				expect(rows).to.have.lengthOf(2);
				expect(rows[0].textContent).to.not.have.string('text');
				expect(rows[1].textContent).to.not.have.string('text');
			});
		cy.get('#copy-paste-container td')
			.should('have.length', 4);

		helper.afterAll('table_properties.odt');
	});

	it('Delete column.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#DeleteColumns')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 3);
		cy.get('#copy-paste-container td')
			.should(function(columns) {
				expect(columns).to.have.lengthOf(3);
				expect(columns[0].textContent).to.not.have.string('text');
				expect(columns[1].textContent).to.not.have.string('text');
				expect(columns[2].textContent).to.not.have.string('text');
			});

		helper.afterAll('table_properties.odt');
	});

	it('Delete table.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#DeleteTable')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		mobileHelper.closeMobileWizard();

		// Do a new selection
		writerHelper.selectAllMobile();

		// Check markers are in the same row (we have text selection only)
		cy.get('.leaflet-marker-icon')
			.should(function(markers) {
				expect(markers).to.have.lengthOf(2);
				expect(markers[0].getBoundingClientRect().top).to.equal(markers[1].getBoundingClientRect().top);
			});

		helper.afterAll('table_properties.odt');
	});

	it('Merge cells.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{shift}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#MergeCells')
			.scrollIntoView();
		cy.get('#MergeCells')
			.click();

		writerHelper.selectAllMobile();

		// Check rows / columns
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		cy.get('#copy-paste-container td')
			.should('have.length', 3);

		helper.afterAll('table_properties.odt');
	});

	// Regression here: we can't enter value directly into the spinfield
	it.skip('Change row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '0');

		cy.get('#rowheight .spinfield')
			.clear()
			.type('1.4')
			.type('{enter}');

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '1.4');

		writerHelper.selectAllMobile();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'height', '125');

		helper.afterAll('table_properties.odt');
	});

	// Regression here: we can't enter value directly into the spinfield
	it.skip('Change column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties.odt');

		openTablePanel();

		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '3.46');

		cy.get('#columnwidth .spinfield')
			.clear()
			.type('5.6')
			.type('{enter}');

		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '5.6');

		writerHelper.selectAllMobile();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '81%');

		helper.afterAll('table_properties.odt');
	});

	it('Set minimal row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');


		openTablePanel();

		cy.get('#SetMinimalRowHeight')
			.click();

		writerHelper.selectAllMobile();

		// Check new row height
		cy.get('#copy-paste-container td')
			.should('not.have.attr', 'height');

		helper.afterAll('table_with_text.odt');
	});

	it('Set optimal row height.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#SetOptimalRowHeight')
			.click();

		writerHelper.selectAllMobile();

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

		helper.afterAll('table_with_text.odt');
	});

	it('Distribute rows.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#DistributeRows')
			.click();

		writerHelper.selectAllMobile();

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

		helper.afterAll('table_with_text.odt');
	});

	it('Set minimal column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#SetMinimalColumnWidth')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '24');

		helper.afterAll('table_with_text.odt');
	});

	it('Set optimal column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#SetOptimalColumnWidth')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container td:nth-of-type(1n)')
			.should('have.attr', 'width', '324');
		cy.get('#copy-paste-container td:nth-of-type(2n)')
			.should('have.attr', 'width', '323');

		helper.afterAll('table_with_text.odt');
	});

	it('Distribute columns.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_with_text.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{leftarrow}{shift}{downarrow}{downarrow}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#DistributeColumns')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container td')
			.should('have.attr', 'width', '323');

		helper.afterAll('table_with_text.odt');
	});
});
