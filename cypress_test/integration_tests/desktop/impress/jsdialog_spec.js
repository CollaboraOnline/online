/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'JSDialog Tests', function() {
	var testFileName = 'jsdialog.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Check disabled state in animation sidebar', function() {
		// open animation deck
		cy.cGet('#options-custom-animation-button').should('not.have.class', 'selected');
		cy.cGet('#options-custom-animation-button').click();
		cy.cGet('#options-custom-animation-button').should('have.class', 'selected');

		// all options are disabled
		cy.cGet('#start_effect_list-input').should('be.disabled');
		cy.cGet('#combo-input').should('be.disabled');
		cy.cGet('#anim_duration-input').should('be.disabled');
		cy.cGet('#delay_value-input').should('be.disabled');

		// select animation entry
		cy.cGet('#custom_animation_list').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Shape 1').click();
		cy.wait(500);

		// some options are enabled
		cy.cGet('#start_effect_list-input').should('not.be.disabled');
		cy.cGet('#combo-input').should('be.disabled');
		cy.cGet('#anim_duration-input').should('not.be.disabled');
		cy.cGet('#delay_value-input').should('not.be.disabled');

		// use different type of animation
		cy.cGet('#categorylb-input').select('Entrance');
		cy.cGet('#effect_list').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Fly In').click();

		// all options are enabled
		cy.cGet('#start_effect_list-input').should('not.be.disabled');
		cy.cGet('#combo-input').should('not.be.disabled');
		cy.cGet('#anim_duration-input').should('not.be.disabled');
		cy.cGet('#delay_value-input').should('not.be.disabled');
	});
});
