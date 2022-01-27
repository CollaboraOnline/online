/* global describe it cy require Cypress afterEach */
const { assertImageSize } = require('../../common/desktop_helper');
var helper = require('../../common/helper');

describe('Open different file types', function() {

	var testFileName = '';

	function before(filename) {
		var origTestFileName = filename;

		testFileName = helper.beforeAll(origTestFileName, 'writer');
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openReadOnlyFile(filename) {
		testFileName = helper.loadTestDocNoIntegration(filename, 'writer', false, false, false);

		//check doc is loaded
		cy.get('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

		helper.canvasShouldNotBeFullWhite('.leaflet-canvas-container canvas');

		cy.get('#PermissionMode').should('be.visible')
			.should('have.text', ' Read-only ');
	}

	function assertData() {
		//select all the content of doc
		helper.typeIntoDocument('{shift}{end}');

		//assert text and its properties
		var container = '#copy-paste-container';

		cy.get(container + ' p font')
			.should('have.attr', 'size', '6');

		cy.get(container + ' p font b')
			.should('exist');

		cy.get(container + ' p font b')
			.should('exist').and('have.text', 'LibreOffice');

		//assert table cells
		helper.typeIntoDocument('{home}{downarrow}');

		helper.typeIntoDocument('{shift}{rightarrow}{rightarrow}{rightarrow}{rightarrow}');

		cy.get(container + ' table')
			.should('exist');

		cy.get('#copy-paste-container colgroup').find('col')
			.should('have.length', 4);

		cy.get('#copy-paste-container tbody').find('tr')
			.should('have.length', 1);

		helper.typeIntoDocument('{downarrow}');

		helper.waitUntilIdle('.leaflet-cursor.blinking-cursor');

		// Click right to the blinking cursor position.
		cy.get('.leaflet-cursor.blinking-cursor')
			.then(function(cursor) {
				var boundRect = cursor[0].getBoundingClientRect();
				var XPos = boundRect.right + 10;
				var YPos = (boundRect.top + boundRect.bottom) / 2;

				cy.get('body')
					.click(XPos, YPos);
			});

		//assert image
		assertImageSize(480, 122);
	}

	it('Open doc file', function() {
		before('testfile.doc');

		assertData();
	});

	it('Open docx file', function() {
		before('testfile.docx');

		assertData();
	});

	it('Open docm file', function() {
		before('testfile.docm');

		assertData();
	});

	it('Open fodt file', function() {
		before('testfile.fodt');

		assertData();
	});

	it('Open dot file', function() {
		before('testfile.dot');

		assertData();
	});

	it('Open dotm file', function() {
		openReadOnlyFile('testfile.dotm');
	});

	it('Open dotx file', function() {
		openReadOnlyFile('testfile.dotx');
	});
});
