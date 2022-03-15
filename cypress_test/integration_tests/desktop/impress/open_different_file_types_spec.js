/* global describe it cy require expect afterEach */
var helper = require('../../common/helper');
const { selectZoomLevel, openReadOnlyFile } = require('../../common/desktop_helper');
// const { selectTextShapeInTheCenter } = require('../../common/impress_helper');

describe('Open different file types', function() {

	var testFileName = '';

	function before(filename) {
		var origTestFileName = filename;

		testFileName = helper.beforeAll(origTestFileName, 'impress');

		selectZoomLevel('50');

		cy.get('#toolbar-up .w2ui-scroll-right').click();

		cy.get('#tb_editbar_item_modifypage').click();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertData() {
		//select all the content of doc
		helper.typeIntoDocument('{ctrl}{a}');

		//assert image and size
		cy.get('.leaflet-overlay-pane g.Graphic image').should('exist')
		    .then($ele => {
		        const width = parseInt($ele.attr('width'));
		        const height = parseInt($ele.attr('height'));
		        expect(width).to.be.closeTo(18969, 10);
		        expect(height).to.be.closeTo(7397, 10);
		    });

		var selector = '.leaflet-pane.leaflet-overlay-pane g.Page';

		cy.get(selector + ' g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of table cells
		cy.get(selector + ' path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(6);
			});

		//assert text properties
		cy.get(selector + ' g')
			.should('have.class', 'com.sun.star.drawing.CustomShape');

		cy.get(selector + ' .TextParagraph')
			.should('have.attr', 'font-family', 'Calibri, sans-serif');

		cy.get(selector + ' .TextParagraph')
			.should('have.attr', 'font-size', '1552px');

		cy.get(selector + ' .TextParagraph .TextPosition tspan')
			.should('have.text', 'LibreOffice');
	}

	it('Open pptx file', function() {
		before('testfile.pptx');

		assertData();
	});

	it('Open ppt file', function() {
		before('testfile.ppt');

		assertData();
	});

	it('Open pptm file', function() {
		before('testfile.pptm');

		assertData();
	});

	it('Open pot file', function() {
		testFileName = openReadOnlyFile('impress', 'testfile.pot');
	});

	it('Open potx file', function() {
		testFileName = openReadOnlyFile('impress', 'testfile.potx');
	});

	it('Open potm file', function() {
		testFileName = openReadOnlyFile('impress', 'testfile.potm');
	});

	it('Open fodp file', function() {
		before('testfile.fodp');

		assertData();
	});

	it('Open ppsx file', function() {
		before('testfile.ppsx');

		assertData();
	});
});
