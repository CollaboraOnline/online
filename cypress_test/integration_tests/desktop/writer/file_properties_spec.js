/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');

describe('File Property Tests', function() {
	var origTestFileName = 'file_properties.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Add File Description.', function() {
		writerHelper.openFileProperties();

		cy.get('#description-tab-label').click();

		helper.waitUntilIdle('#title.ui-edit');

		cy.get('#title.ui-edit').type('New Title');
		// sometimes it doesn't finish typing
		helper.waitUntilIdle('#title.ui-edit');

		// Fixme: type now char by char because we receive update messages
		//        can be reverted after core update
		cy.get('#comments.ui-textarea').type('N');
		cy.wait(500);
		cy.get('#comments.ui-textarea').type('e');
		cy.wait(500);
		cy.get('#comments.ui-textarea').type('w');
		cy.wait(500);

		helper.waitUntilIdle('#comments.ui-textarea');


		cy.get('#ok.ui-pushbutton').click();


		writerHelper.openFileProperties();

		cy.get('#description-tab-label').click();

		cy.get('#title.ui-edit').should('have.value', 'New Title');
		cy.get('#comments.ui-textarea').should('have.value', 'New');

		helper.clickOnIdle('#cancel.ui-pushbutton');
	});

	it.skip('Add Custom Property.', function() {
		writerHelper.openFileProperties();

		cy.get('#customprops-tab-label').click();
		
		cy.wait(200);

		// Add property
		helper.clickOnIdle('.ui-pushbutton', 'Add Property');

		helper.waitUntilIdle('#namebox');
		cy.get('#namebox select')
			.select('Mailstop');

		helper.waitUntilIdle('#valueedit');
		cy.get('#valueedit').type('123 Address');

		cy.get('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();

		cy.get('#customprops-tab-label').click();

		cy.get('#valueedit.ui-edit').should('have.value', '123 Address');

		helper.clickOnIdle('#cancel.ui-pushbutton');
	});

	it.skip('Add Custom Duration Property.', function() {
		writerHelper.openFileProperties();

		helper.clickOnIdle('#customprops-tab-label');
		
		cy.wait(200);

		// Add property
		helper.clickOnIdle('.ui-pushbutton', 'Add Property');

		helper.waitUntilIdle('#namebox');
		cy.get('#namebox select')
			.select('Received from');

		helper.waitUntilIdle('#typebox');
		cy.get('#typebox select')
			.select('Duration');

		helper.clickOnIdle('#durationbutton');

		cy.get('#negative-input').check();
		cy.get('#years-input').type('1');
		cy.get('#days-input').type('2');
		cy.get('#seconds-input').type('3');

		// click the sub-dialog ok button
		cy.get('#ok.ui-pushbutton')
			.invoke('slice', 1)
			.click();

		cy.get('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();

		helper.clickOnIdle('#customprops-tab-label');

		cy.get('#duration.ui-edit').should('have.value', '- Y: 1 M: 0 D: 2 H: 0 M: 0 S: 3');

		helper.clickOnIdle('#cancel.ui-pushbutton');
	});
	
	it.skip('Add Custom Yes/No Property.', function() {
		writerHelper.openFileProperties();

		cy.get('#customprops-tab-label').click();
		
		cy.wait(200);

		// Add property
		helper.clickOnIdle('.ui-pushbutton', 'Add Property');

		helper.waitUntilIdle('#namebox');
		cy.get('#namebox select')
			.select('Telephone number');

		helper.waitUntilIdle('#typebox');
		cy.get('#typebox select')
			.select('Yes or no');

		helper.waitUntilIdle('#yes-input');
		cy.get('#yes-input').check();

		cy.get('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();

		cy.get('#customprops-tab-label').click();

		cy.get('#yes-input').should('be.checked');

		helper.clickOnIdle('#cancel.ui-pushbutton');
	});
});