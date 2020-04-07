/* global describe it cy require afterEach expect Cypress beforeEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Change table properties / layout via mobile wizard.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('table_properties.odt', 'writer');
	});

	afterEach(function() {
		helper.afterAll('table_properties.odt');
	});

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#InsertRowsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#InsertRowsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#InsertColumnsBefore')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#InsertColumnsAfter')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 4);

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#DeleteRows')
			.click();

		cy.get('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#DeleteColumns')
			.click();

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

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

		before('table_properties2.odt');

		moveCursorToFirstCell();

		cy.get('body').type('{shift}{downarrow}{rightarrow}');

		openTablePanel();

		cy.get('#MergeCells')
			.scrollIntoView();
		cy.get('#MergeCells')
			.click();

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '0');

		cy.get('#rowheight .spinfield')
			.clear()
			.type('1.4')
			.type('{enter}');

		cy.get('#rowheight .spinfield')
			.should('have.attr', 'value', '1.4');

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

		// Check row height
		cy.get('#copy-paste-container td')
			.should('have.attr', 'height', '125');
	});

	it('Change column width.', function() {
		// TODO: Select all does not work with core/master
		// Table panel layout is also broken
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		before('table_properties2.odt');

		openTablePanel();

		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '3.462');

		cy.get('#columnwidth .spinfield')
			.clear()
			.type('5.6')
			.type('{enter}');

		cy.get('#columnwidth .spinfield')
			.should('have.attr', 'value', '5.6');

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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


		openTablePanel();

		cy.get('#SetMinimalRowHeight')
			.click();

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		openTablePanel();

		cy.get('#SetOptimalRowHeight')
			.click();

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
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

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

		// Check new row height
		cy.get('#copy-paste-container td')
			.then(function(items) {
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

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		openTablePanel();

		cy.get('#SetOptimalColumnWidth')
			.click();

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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

		openTablePanel();

		cy.get('#DistributeColumns')
			.click();

		mobileHelper.closeMobileWizard();

		writerHelper.copyTableToClipboard();

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
