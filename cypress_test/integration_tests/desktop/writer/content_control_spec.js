/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
// var desktopHelper = require('../../common/desktop_helper');
// var mode = Cypress.env('USER_INTERFACE');

describe('Annotation Tests', function () {
	var origTestFileName = 'content_control.odt';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function clickOnClassicMenu(mainMenu, entry) {
		helper.clickOnIdle(mainMenu);
		cy.contains(mainMenu + ' li', entry)
			.click();
	}

	it('Insert Rich Text', function () {
		clickOnClassicMenu('#menu-form', 'Insert Rich Text');
		helper.expectTextForClipboard('Click here to enter text\\u0001');
	});

	it('Insert Checkbox', function() {
		clickOnClassicMenu('#menu-form', 'Insert Checkbox');
		
		helper.expectTextForClipboard('☐\\u0001');

		//uncheck
		helper.typeIntoDocument(' {ctrl}{a}');

		helper.expectTextForClipboard('☒\\u0001');

		//change checked/unchecked character
		helper.typeIntoDocument('{leftArrow}');

		clickOnClassicMenu('#menu-form', 'Properties');

		cy.get('.lokdialog.ui-dialog-content.ui-widget-content')
			.should('be.visible');

		cy.get('.ui-edit.jsdialog').eq(0).clear({force: true}).type('Yes');
		
		cy.get('.ui-edit.jsdialog').eq(1).clear({force: true}).type('No');

		cy.get('.ui-pushbutton.button-primary').click();

		helper.typeIntoDocument('{leftArrow} {ctrl}{a}');

		helper.expectTextForClipboard('No\\u0001');

		helper.typeIntoDocument('{leftArrow} {ctrl}{a}');

		helper.expectTextForClipboard('Yes\\u0001');
	});

	function assertDropDownData(arr) {
		cy.get('.leaflet-marker-icon.writer-drop-down-marker').should('be.visible').click();

		cy.get('#container-dropdown')
			.should('be.visible');

		for (var i=0; i<arr.length; i++) {
			cy.get('#container-dropdown #list .jsdialog.ui-treeview-cell').eq(i)
				.should('have.text', arr[i]);
		}

		cy.get('.jsdialog-overlay.cancellable').click();
	}
	
	function openPropertiesDialog(selectEntry, entryNumber = 0) {
		clickOnClassicMenu('#menu-form', 'Properties');

		cy.get('.lokdialog.ui-dialog-content.ui-widget-content')
			.should('be.visible');
		
		if (selectEntry) {
			cy.get('tr.jsdialog.ui-listview-entry').eq(entryNumber).click();

			cy.get('tr.jsdialog.ui-listview-entry').eq(entryNumber).should('have.class', 'selected');
		}
	}

	it('Insert Dropdown', function() {
		clickOnClassicMenu('#menu-form', 'Insert Dropdown');

		assertDropDownData(['Choose an item']);
		
		openPropertiesDialog(false);
		
		// add items
		for (var i = 1; i <= 4; i++) {
			cy.get('#ContentControlDialog #add')
				.click();
			
			cy.get('#ContentControlListItemDialog')
				.should('be.visible');
			
			cy.get('#displayname')
				.type('Item' + i.toString());
			
			cy.get('#ContentControlListItemDialog #ok')
				.click();
		}
		
		cy.get('#ContentControlDialog #ok')
			.click();

		assertDropDownData(['Choose an item', 'Item1', 'Item2', 'Item3', 'Item4']);

		//delete item
		openPropertiesDialog(true);

		cy.get('#ContentControlDialog #remove')
			.click();
		
		cy.get('#ContentControlDialog #ok')
			.click();

		assertDropDownData(['Item1', 'Item2', 'Item3', 'Item4']);
		
		//modify 
		openPropertiesDialog(true);
		
		cy.get('#ContentControlDialog #modify')
			.click();

		cy.get('#ContentControlListItemDialog')
			.should('be.visible');

		cy.get('#displayname').clear({force: true})
			.type('Item10', {force: true});
		
		cy.get('#ContentControlListItemDialog #ok')
			.click();
		
		cy.get('#ContentControlDialog #ok')
			.click();

		assertDropDownData(['Item10', 'Item2', 'Item3', 'Item4']);
		
		//move down
		openPropertiesDialog(true);

		cy.get('#ContentControlDialog #movedown')
			.click();
		
		cy.get('#ContentControlDialog #ok')
			.click();
		
		assertDropDownData(['Item2', 'Item10', 'Item3', 'Item4']);
		
		//move up
		openPropertiesDialog(true, 1);

		cy.get('#ContentControlDialog #moveup')
			.click();
		
		cy.get('#ContentControlDialog #ok')
			.click();
		
		assertDropDownData(['Item10', 'Item2', 'Item3', 'Item4']);
	});

	it('Insert Picture', function() {
		clickOnClassicMenu('#menu-form', 'Insert Picture');

		//no other way to assert this as it is part of canvas
		cy.get('div.leaflet-marker-icon.leaflet-selection-marker-start').should('be.visible');

		cy.get('div.leaflet-marker-icon.leaflet-selection-marker-end').should('be.visible');
	});

	it('Insert Date', function() {
		clickOnClassicMenu('#menu-form', 'Insert Date');

		cy.get('.leaflet-marker-icon.writer-drop-down-marker').should('be.visible').click();

		cy.get('td.ui-datepicker-days-cell-over.ui-datepicker-current-day').click();

		helper.typeIntoDocument('{ctrl}{a}');

		const date = new Date();
		var day = date.getDate();
		var month = date.getMonth() + 1;
		var year = date.getFullYear().toString();

		helper.expectTextForClipboard(`${month}/${day}/${year.slice(2)}\\u0001`);

		//change format
		helper.typeIntoDocument('{leftArrow}');

		openPropertiesDialog(false);

		cy.get('.jsdialog.ui-treeview-entry').eq(1).click();

		cy.get('.jsdialog.ui-treeview-entry').eq(1).should('have.class', 'selected');

		cy.get('#ContentControlDialog #ok')
			.click();

		cy.get('.leaflet-marker-icon.writer-drop-down-marker').should('be.visible').click();

		cy.get('td.ui-datepicker-days-cell-over.ui-datepicker-current-day').click();

		helper.typeIntoDocument('{ctrl}{a}');

		helper.expectTextForClipboard(`${month}/${day}/${year}\\u0001`);
	});
});