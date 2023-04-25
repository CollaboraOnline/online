/* global describe it cy require afterEach */
const { assertImageSize, openReadOnlyFile } = require('../../common/desktop_helper');
var helper = require('../../common/helper');

describe.skip(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Open different file types', function() {

	var testFileName = '';

	function before(filename) {
		var origTestFileName = filename;

		testFileName = helper.beforeAll(origTestFileName, 'writer');
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertData() {
		//select all the content of doc
		helper.typeIntoDocument('{shift}{end}');

		//assert text and its properties
		var container = '#copy-paste-container';

		cy.cGet(container + ' p font').should('have.attr', 'size', '6');
		cy.cGet(container + ' p font b').should('exist');
		cy.cGet(container + ' p font b').should('exist').and('have.text', 'LibreOffice');
		//assert table cells
		helper.typeIntoDocument('{home}{downarrow}');
		helper.typeIntoDocument('{shift}{rightarrow}{rightarrow}{rightarrow}{rightarrow}');
		cy.cGet(container + ' table').should('exist');
		cy.cGet('#copy-paste-container colgroup').find('col').should('have.length', 4);
		cy.cGet('#copy-paste-container tbody').find('tr').should('have.length', 1);
		helper.typeIntoDocument('{downarrow}');
		helper.waitUntilIdle('.leaflet-cursor.blinking-cursor');

		// Click right to the blinking cursor position.
		cy.cGet('.leaflet-cursor.blinking-cursor')
			.then(function(cursor) {
				var boundRect = cursor[0].getBoundingClientRect();
				var XPos = boundRect.right + 10;
				var YPos = (boundRect.top + boundRect.bottom) / 2;

				cy.cGet('body').click(XPos, YPos);
			});

		//assert image
		assertImageSize(480, 122);
	}

	it('Open doc file', { defaultCommandTimeout: 60000 }, function() {
		before('testfile.doc');
		assertData();
	});

	it('Open docx file', { defaultCommandTimeout: 60000 }, function() {
		before('testfile.docx');
		assertData();
	});

	it('Open docm file', { defaultCommandTimeout: 60000 }, function() {
		before('testfile.docm');
		assertData();
	});

	it('Open fodt file', { defaultCommandTimeout: 60000 }, function() {
		before('testfile.fodt');
		assertData();
	});

	it('Open dot file', { defaultCommandTimeout: 60000 }, function() {
		testFileName = openReadOnlyFile('writer', 'testfile.dot');
	});

	it('Open dotm file', { defaultCommandTimeout: 60000 }, function() {
		testFileName = openReadOnlyFile('writer', 'testfile.dotm');
	});

	it('Open dotx file', { defaultCommandTimeout: 60000 }, function() {
		testFileName = openReadOnlyFile('writer','testfile.dotx');
	});
});
