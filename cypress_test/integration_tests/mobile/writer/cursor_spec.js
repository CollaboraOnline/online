/* global describe it require afterEach cy */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Text cursor tests.', function() {
	var testFileName;

	function before(fileName) {
		testFileName = helper.beforeAll(fileName, 'writer');

		mobileHelper.enableEditingMobile();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Extensive cursor movements.', function() {
		before('cursor.odt');

		for (var i = 0; i < 5; i++) {
			helper.moveCursor('right');
		}
		for (var j = 0; j < 5; j++) {
			helper.moveCursor('left');
		}
	});

	it('View jumps by cursor movement.', function() {
		before('cursor.odt');

		for (var i = 0; i < 5; i++) {
			helper.moveCursor('end');
			helper.moveCursor('home');
		}
	});

	it('Cursor is visible after text selection.', function() {
		before('cursor.odt');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('.blinking-cursor').should('be.visible');
		// Blinking cursor and so the view should be at the end of the text selection.
		cy.cGet('.leaflet-selection-marker-end').should('be.visible');
		cy.cGet('.leaflet-selection-marker-start').should('not.be.visible');
	});

	it('Move cursor through table.', function() {
		before('cursor_in_table.odt');

		for (var i = 0; i < 5; i++) {
			helper.moveCursor('down');
		}

		for (var j = 0; j < 5; j++) {
			helper.moveCursor('up');
		}
	});
});
