/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test rendering of a cell on edit', function() {

	beforeEach(function() {
		cy.viewport(800,600);
		helper.setupAndLoadDocument('calc/cell_edit.fods');
		desktopHelper.selectZoomLevel(200);
	});

	function selectInitialCell() {
		helper.typeIntoInputField(helper.addressInputSelector, 'CA980');
		cy.cGet(helper.addressInputSelector).should('have.value', 'CA980');
	}

	function checkTextContent(expected) {
		cy.cGet('#sc_input_window.formulabar .ui-custom-textarea-cursor-layer')
			.should('have.text', expected);
	}

	function checkVisualContent(expected) {
		cy.wait(500);
		cy.cGet('#document-container').compareSnapshot(expected, 0.01);
	}

	it('Redraw after undo', function() {
		// setup initial state
		desktopHelper.assertScrollbarPosition('horizontal', 325, 355);
		desktopHelper.assertScrollbarPosition('vertical', 270, 330);

		selectInitialCell();
		checkTextContent('');
		checkVisualContent('empty');

		// type something
		const testString = 'TEST STRING';

		desktopHelper.getNbIconArrow('Grow').click();
		desktopHelper.getNbIcon('Bold').click();
		desktopHelper.getNbIcon('Underline').click();
		cy.cGet('.jsdialog-overlay').click();

		helper.typeIntoDocument(testString + '{enter}');
		checkTextContent('');

		// verify cell content
		selectInitialCell();
		checkTextContent(testString);
		checkVisualContent('teststring');

		// undo
		desktopHelper.getNbIcon('Undo').click();

		// verify cell content
		selectInitialCell();
		checkTextContent('');
		checkVisualContent('empty_selected');
	});
});
