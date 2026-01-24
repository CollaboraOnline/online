/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test rendering of a cell on edit', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/cell_edit.fods');
		desktopHelper.selectZoomLevel(200); // make differences more significant

		cy.viewport(800,600);
		cy.window().then(win => { win.dispatchEvent(new Event('resize')); });
		cy.getFrameWindow().then((win) => {
			this.win = win;
		});
	});

	function selectInitialCell() {
		helper.typeIntoInputField(helper.addressInputSelector, 'CA980');
		cy.cGet(helper.addressInputSelector).should('have.value', 'CA980');
	}

	function checkTextContent(expected) {
		cy.cGet('#sc_input_window.formulabar .ui-custom-textarea-cursor-layer')
			.should('have.text', expected);
	}

	function checkVisualContent(win, expected) {
		helper.processToIdle(win);
		cy.cGet('#document-container').compareSnapshot(expected, 0.02);
	}

	it('Redraw after undo', function() {
		// setup initial state
		desktopHelper.assertScrollbarPosition('horizontal', 325, 355);
		desktopHelper.assertScrollbarPosition('vertical', 270, 330);

		selectInitialCell();
		checkTextContent('');
		checkVisualContent(this.win, 'empty');

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
		checkVisualContent(this.win, 'teststring');

		// undo
		desktopHelper.getNbIcon('Undo').click();

		// verify cell content
		selectInitialCell();
		checkTextContent('');
		checkVisualContent(this.win, 'empty_selected');
	});
});
