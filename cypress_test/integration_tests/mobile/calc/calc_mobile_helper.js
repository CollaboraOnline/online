/* global cy expect */

function selectFirstRow() {
	cy.get('[id="test-div-row header"]')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);

			var XPos = (items[0].getBoundingClientRect().right + items[0].getBoundingClientRect().left) / 2;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.click(XPos, YPos);
		});

	cy.get('.spreadsheet-cell-resize-marker:nth-of-type(1)')
		.should('be.visible');

	cy.get('.spreadsheet-cell-resize-marker:nth-of-type(2)')
		.should('not.be.visible');

	var regex = /^A1:(AMJ|XFD)1$/;
	cy.get('input#addressInput')
		.should('have.prop', 'value')
		.then(function(value) {
			return regex.test(value);
		});
}

module.exports.selectFirstRow = selectFirstRow;
