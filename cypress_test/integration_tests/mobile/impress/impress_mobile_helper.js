/* globals cy expect require */

require('cypress-wait-until');

var helper = require('../../common/helper');

function selectTextOfShape() {
	cy.log('Selecting text of shape - start.');

	// Double click onto the selected shape
	cy.waitUntil(function() {
		cy.get('svg g .leaflet-interactive')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.wait(2000);

		return cy.get('.leaflet-overlay-pane')
			.then(function(overlay) {
				return overlay.children('.leaflet-cursor-container').length !== 0;
			});
	});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');

	helper.selectAllText(false);

	cy.log('Selecting text of shape - end.');
}

function dblclickOnSelectedShape() {
	cy.get('.transform-handler--rotate')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = items[0].getBoundingClientRect().bottom + 50;
			cy.get('body')
				.dblclick(XPos, YPos);
		});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
}

module.exports.selectTextOfShape = selectTextOfShape;
module.exports.dblclickOnSelectedShape = dblclickOnSelectedShape;
