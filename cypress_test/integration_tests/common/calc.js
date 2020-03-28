/* global cy expect */

// Click on the formula bar.
// moveMouse is set to avoid leaving the mouse on the Formula-Bar,
// which shows the tooltip and messes up tests.
function clickFormulaBar(XPos = -1, moveMouse = true) {

	// The inputbar_container is 100% width, which
	// can extend behind the sidebar. So we can't
	// rely on its width. Instead, we rely on the
	// canvas, which is accurately sized.
	// N.B. Setting the width of the inputbar_container
	// is futile because it messes the size of the canvas.
	cy.get('.inputbar_canvas')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			if (XPos < 0) // Click in the center if undefined.
				XPos = items[0].getBoundingClientRect().width / 2;
			var YPos = items[0].getBoundingClientRect().height / 2;
			cy.get('.inputbar_container')
				.click(XPos, YPos);
		});

	if (moveMouse)
		cy.get('body').trigger('mouseover');
}

// Click on the first cell.
function clickOnFirstCell() {
	cy.get('.leaflet-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().left + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.click(XPos, YPos);
		});

	cy.wait(500);

	cy.get('.leaflet-marker-icon')
		.should('be.visible');

}

module.exports.clickOnFirstCell = clickOnFirstCell;
module.exports.clickFormulaBar = clickFormulaBar;
