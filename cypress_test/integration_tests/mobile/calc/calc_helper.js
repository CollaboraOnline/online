/* global cy expect*/

function clickOnFirstCell() {
	// Enable editing if it's in read-only mode
	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {
				cy.get('#mobile-edit-button')
					.click();
			}
		});

	// Use the tile's edge to find the first cell's position
	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.click(XPos, YPos);
		});
}

module.exports.clickOnFirstCell = clickOnFirstCell;
