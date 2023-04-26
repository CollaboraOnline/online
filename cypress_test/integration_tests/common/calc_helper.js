/* global cy expect Cypress require expect */

var helper = require('./helper');

// Click on the formula bar.
// mouseover is triggered to avoid leaving the mouse on the Formula-Bar,
// which shows the tooltip and messes up tests.
function clickFormulaBar() {

	// The inputbar_container is 100% width, which
	// can extend behind the sidebar. So we can't
	// rely on its width. Instead, we rely on the
	// canvas, which is accurately sized.
	// N.B. Setting the width of the inputbar_container
	// is futile because it messes the size of the canvas.
	helper.doIfOnMobile(function() {
		helper.waitUntilIdle('#sc_input_window.formulabar');
	});

	cy.cGet('#sc_input_window.formulabar').focus();
	cy.cGet('body').trigger('mouseover');
}

// Click on the first cell of the sheet (A1), we use the document
// top left corner to achive that, so it work's if the view is at the
// start of the sheet.
// Parameters:
// firstClick - this is the first click on the cell. It matters on mobile only,
//              becasue on mobile, the first click/tap selects the cell, the second
//              one makes the document to step in cell editing.
// dblClick - to do a double click or not. The result of double click is that the cell
//            editing it triggered both on desktop and mobile.
function clickOnFirstCell(firstClick = true, dblClick = false) {
	cy.log('Clicking on first cell - start.');
	cy.log('Param - firstClick: ' + firstClick);
	cy.log('Param - dblClick: ' + dblClick);

	cy.wait(1000);
	// Use the tile's edge to find the first cell's position
	cy.cGet('#map')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().left + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			if (dblClick)
				cy.cGet('body').click(XPos, YPos).dblclick(XPos, YPos);
			else
				cy.cGet('body').click(XPos, YPos);
		});

	if (firstClick && !dblClick) {
		cy.cGet('#test-div-overlay-cell-cursor-border-0')
			.should(function (elem) {
				expect(helper.Bounds.parseBoundsJson(elem.text()).left).to.be.equal(0);
				expect(helper.Bounds.parseBoundsJson(elem.text()).top).to.be.equal(0);
			});
	} else {
		cy.cGet('.cursor-overlay .blinking-cursor').should('be.visible');

		helper.doIfOnDesktop(function() {
			cy.wait(500);
		});
	}

	cy.cGet('input#addressInput').should('have.prop', 'value', 'A1');

	cy.log('Clicking on first cell - end.');
}

// Double click on the A1 cell.
function dblClickOnFirstCell() {
	clickOnFirstCell(false, true);
}

// Type some text into the formula bar.
// Parameters:
// text - the text the method type into the formula bar's intput field.
function typeIntoFormulabar(text) {
	cy.log('Typing into formulabar - start.');

	cy.cGet('#calc-inputbar .lokdialog-cursor')
		.then(function(cursor) {
			if (!Cypress.dom.isVisible(cursor)) {
				clickFormulaBar();
			}
		});

		cy.cGet('#calc-inputbar .lokdialog-cursor').should('have.focus');

	helper.doIfOnMobile(function() {
		cy.cGet('#tb_actionbar_item_acceptformula').should('be.visible');
		cy.cGet('#tb_actionbar_item_cancelformula').should('be.visible');
	});

	helper.doIfOnDesktop(function() {
		cy.cGet('#acceptformula').should('be.visible');
		cy.cGet('#cancelformula').should('be.visible');
	});

	cy.cGet('body').type(text);

	cy.log('Typing into formulabar - end.');
}

// Remove exisiting text selection by clicking on
// row headers at the center position, until a
// a row is selected (and text seletion is removed).
function removeTextSelection() {
	cy.log('Removing text selection - start.');

	cy.cGet('[id="test-div-row header"]')
		.then(function(header) {
			expect(header).to.have.lengthOf(1);
			var rect = header[0].getBoundingClientRect();
			var posX = (rect.right + rect.left) / 2.0;
			var posY = (rect.top + rect.bottom) / 2.0;

			var moveY = 0.0;
			cy.waitUntil(function() {
				cy.cGet('body').click(posX, posY + moveY);

				moveY += 1.0;
				var regex = /A([0-9]+):(AMJ|XFD)\1$/;
				return cy.cGet('input#addressInput')
					.should('have.prop', 'value')
					.then(function(value) {
						return regex.test(value);
					});
			});
		});


	cy.log('Removing text selection - end.');
}

// Select the enitre sheet, using the select all button
// at the corner of the row and column headers.
// An additional thing, what this method do is remove
// preexisitng text selection. Otherwise with having the
// text selection, select all would select only the content
// of the currently edited cell instead of the whole table.
function selectEntireSheet() {
	cy.log('Selecting entire sheet - start.');

	removeTextSelection();

	cy.cGet('[id="test-div-corner header"]')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var corner = items[0];
			var XPos = (corner.getBoundingClientRect().right + items[0].getBoundingClientRect().left) / 2;
			var YPos = items[0].getBoundingClientRect().bottom - 10;
			cy.cGet('body').click(XPos, YPos);
		});

	helper.doIfOnMobile(function() {
		cy.cGet('.spreadsheet-cell-resize-marker').should('be.visible');
	});

	var regex = /^A1:(AMJ|XFD)1048576$/;
	cy.cGet('input#addressInput')
		.should('have.prop', 'value')
		.then(function(value) {
			return regex.test(value);
		});

	cy.log('Selecting entire sheet - end.');
}

// Select first column of a calc document.
// We try to achive this by clicking on the left end
// of the column headers. Of course if the first column
// has a very small width, then this might fail.
function selectFirstColumn() {
	cy.cGet('[id="test-div-column header"]')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);

			var bounds = items[0].getBoundingClientRect();
			var XPos = bounds.left + 10;
			var YPos = (bounds.top + bounds.bottom) / 2;
			cy.cGet('body').click(XPos, YPos);
		});

		cy.cGet('input#addressInput').should('have.prop', 'value', 'A1:A1048576');
}

function ensureViewContainsCellCursor() {
	var sheetViewBounds = new helper.Bounds();
	var sheetCursorBounds = new helper.Bounds();

	helper.getOverlayItemBounds('#test-div-overlay-cell-cursor-border-0', sheetCursorBounds);
	helper.getItemBounds('#test-div-tiles', sheetViewBounds);

	cy.wrap(true).should(function () {
		cy.log('ensureViewContainsCellCursor: cursor-area is ' + sheetCursorBounds.toString() + ' view-area is ' + sheetViewBounds.toString());
		expect(sheetViewBounds.contains(sheetCursorBounds)).to.equal(true, 'view-area must contain cursor-area');
	});
}

function assertDataClipboardTable(expectedData) {
	cy.cGet('#copy-paste-container table td')
		.should(function(cells) {
			expect(cells).to.have.lengthOf(expectedData.length);
		});

	var data = [];

	cy.cGet('#copy-paste-container tbody').find('td').each(($el) => {
		cy.wrap($el)
			.invoke('text')
			.then(text => {
				data.push(text);
			});
	}).then(() => expect(data).to.deep.eq(expectedData));
}

function selectCellsInRange(range) {
	cy.cGet('#tb_formulabar_item_address #addressInput')
		.clear()
		.type(range + '{enter}');
}

module.exports.clickOnFirstCell = clickOnFirstCell;
module.exports.dblClickOnFirstCell = dblClickOnFirstCell;
module.exports.clickFormulaBar = clickFormulaBar;
module.exports.typeIntoFormulabar = typeIntoFormulabar;
module.exports.removeTextSelection = removeTextSelection;
module.exports.selectEntireSheet = selectEntireSheet;
module.exports.selectFirstColumn = selectFirstColumn;
module.exports.ensureViewContainsCellCursor = ensureViewContainsCellCursor;
module.exports.assertDataClipboardTable = assertDataClipboardTable;
module.exports.selectCellsInRange = selectCellsInRange;
