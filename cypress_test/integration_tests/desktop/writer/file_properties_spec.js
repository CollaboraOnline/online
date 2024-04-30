/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'File Property Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/file_properties.odt');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Add File Description.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-2').click();
		helper.waitUntilIdle('#title-input.ui-edit');
		cy.cGet('#title-input.ui-edit').type('New Title');
		// sometimes it doesn't finish typing
		helper.waitUntilIdle('#title-input.ui-edit');

		// Fixme: type now char by char because we receive update messages
		//        can be reverted after core update
		cy.cGet('#comments.ui-textarea').type('N');
		cy.wait(500);
		cy.cGet('#comments.ui-textarea').type('e');
		cy.wait(500);
		cy.cGet('#comments.ui-textarea').type('w');
		cy.wait(500);

		helper.waitUntilIdle('#comments.ui-textarea');
		cy.cGet('#ok.ui-pushbutton').click();
		writerHelper.openFileProperties();

		cy.cGet('#tabcontrol-2').click();
		cy.cGet('#title-input.ui-edit').should('have.value', 'New Title');
		cy.cGet('#comments.ui-textarea').should('have.value', 'New');

		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it.skip('Add Custom Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.wait(200);

		// Add property
		cy.cGet('.ui-pushbutton', 'Add Property').click();
		helper.waitUntilIdle('#namebox');
		cy.cGet('#namebox select').select('Mailstop');

		helper.waitUntilIdle('#value-input');
		cy.cGet('#valueedit-input').type('123 Address');
		cy.cGet('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.cGet('#valueedit-input.ui-edit').should('have.value', '123 Address');

		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it.skip('Add Custom Duration Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.wait(200);

		// Add property
		cy.cGet('.ui-pushbutton', 'Add Property').click();
		helper.waitUntilIdle('#namebox');
		cy.cGet('#namebox select').select('Received from');
		helper.waitUntilIdle('#typebox');
		cy.cGet('#typebox select').select('Duration');
		cy.cGet('#durationbutton').click();
		cy.cGet('#negative-input').check();
		cy.cGet('#years-input').type('1');
		cy.cGet('#days-input').type('2');
		cy.cGet('#seconds-input').type('3');

		// click the sub-dialog ok button
		cy.cGet('#ok.ui-pushbutton').invoke('slice', 1).click();
		cy.cGet('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.cGet('#duration-input.ui-edit').should('have.value', '- Y: 1 M: 0 D: 2 H: 0 M: 0 S: 3');
		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it.skip('Add Custom Yes/No Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.wait(200);

		// Add property
		cy.cGet('.ui-pushbutton', 'Add Property').click();
		helper.waitUntilIdle('#namebox');
		cy.cGet('#namebox select').select('Telephone number');
		helper.waitUntilIdle('#typebox');
		cy.cGet('#typebox-input select').select('Yes or no');
		helper.waitUntilIdle('#yes-input');
		cy.cGet('#yes-input').check();
		cy.cGet('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();
		cy.cGet('#customprops-tab-label').click();
		cy.cGet('#yes-input').should('be.checked');
		cy.cGet('#cancel.ui-pushbutton').click();
	});
});
