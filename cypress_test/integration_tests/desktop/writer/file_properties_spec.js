/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'File Property Tests', function() {

	beforeEach(function() {
		cy.viewport(1400, 1000);
		helper.setupAndLoadDocument('writer/file_properties.odt');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Add File Description.', function() {
		writerHelper.openFileProperties();

		cy.cGet('#tabcontrol-2').click();

		cy.cGet('#title-input.ui-edit').should('be.visible');;
		cy.cGet('#title-input.ui-edit').type('New Title');
		cy.cGet('#comments.ui-textarea').type('New');

		cy.cGet('#ok.ui-pushbutton').click();

		writerHelper.openFileProperties();

		cy.cGet('#tabcontrol-2').click();
		cy.cGet('#title-input.ui-edit').should('have.value', 'New Title');
		cy.cGet('#comments.ui-textarea').should('have.value', 'New');

		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it('Add Custom Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-3').click();

		// Add property
		cy.cGet('#add.ui-pushbutton').click();
		cy.cGet('#namebox-input').type('Mailstop');

		cy.cGet('#valueedit-input').type('123 Address');
		cy.cGet('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-3').click();
		cy.cGet('#valueedit-input').should('have.value', '123 Address');

		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it('Add Custom Duration Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-3').click();

		// Add property
		cy.cGet('#add.ui-pushbutton').click();
		cy.cGet('#namebox-input').type('Received from');
		cy.cGet('#typebox-input').select('Duration');
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
		cy.cGet('#tabcontrol-3').click();
		cy.cGet('#duration-input').should('have.value', '- Y: 1 M: 0 D: 2 H: 0 M: 0 S: 3');
		cy.cGet('#cancel.ui-pushbutton').click();
	});

	it('Add Custom Yes/No Property.', function() {
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-3').click();

		// Add property
		cy.cGet('#add.ui-pushbutton').click();
		cy.cGet('#namebox-input').type('Telephone number');
		cy.cGet('#typebox-input').select('Yes or no');
		cy.cGet('#yes-input').check();
		cy.cGet('#ok.ui-pushbutton').click();

		// Check property saved
		writerHelper.openFileProperties();
		cy.cGet('#tabcontrol-3').click();
		cy.cGet('#yes-input').should('be.checked');
		cy.cGet('#cancel.ui-pushbutton').click();
	});
});
