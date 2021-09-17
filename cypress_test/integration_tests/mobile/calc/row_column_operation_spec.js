/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Row Column Operation', function() {
	var testFileName = 'row_column_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true,false);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectOption(submenu, option) {
		cy.get('#toolbar-hamburger').click();

		cy.get('.menu-entry-icon.sheetmenu').parent()
		    .click();

		cy.contains('.menu-entry-with-icon', submenu)
			.parent().click();

		if (typeof option !== 'undefined') {
			cy.contains('.menu-entry-with-icon', option)
				.parent().click();
		}
	}

	it('Insert/Delete row' , function() {
		//Insert row above
		selectOption('Insert Rows', 'Rows Above');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('not.have.text');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(2).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		//delete row
		calcHelper.clickOnFirstCell(true, false);

		selectOption('Delete Rows');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		//insert row below
		calcHelper.clickOnFirstCell(true, false);

		selectOption('Insert Rows', 'Rows Below');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('not.have.text');
			});

			cy.get('tr').eq(2).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});
	});

	it('Insert/Delete Column', function() {
		//insert column before
		selectOption('Insert Columns', 'Columns Before');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('have.text', 'Hello');
				cy.get('td').eq(2).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('have.text', 'World');
				cy.get('td').eq(2).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true, false);

		//delete column
		selectOption('Delete Columns');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		selectOption('Insert Columns', 'Columns After');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('not.have.text');
				cy.get('td').eq(2).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('not.have.text');
				cy.get('td').eq(2).should('have.text', 'Bye');
			});
		});
	});
});
