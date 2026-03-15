/* global describe it cy require beforeEach expect */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Spinfield visual and functional test', function () {
	beforeEach(function () {
		helper.setupAndLoadDocument('writer/help_dialog.odt');
	});

	it('Unit persists after clicking up button', function () {
		cy.getFrameWindow().then(function (win) {
			win.app.map.sendUnoCommand('.uno:FontDialog');
		});

		cy.cGet('.ui-dialog-title').contains('Character').should('be.visible');
		cy.cGet('button.ui-tab').contains('Border').click();

		cy.cGet('#leftmf-input').should('be.visible');

		function getUnit(val) {
			return val.replace(/[\d.\-]/g, '').trim();
		}

		cy.cGet('#leftmf-input').invoke('val').then(function (initialVal) {
			var initialUnit = getUnit(initialVal);
			expect(initialUnit.length).to.be.greaterThan(0);

			cy.cGet('#leftmf .spinfieldbutton-up').click();

			cy.cGet('#leftmf-input').should('be.visible');
			cy.cGet('#leftmf-input').should(function ($el) {
				expect(getUnit($el.val())).to.equal(initialUnit);
			});
		});
	});

	it('Unit persists after arrow key change', function () {
		cy.getFrameWindow().then(function (win) {
			win.app.map.sendUnoCommand('.uno:FontDialog');
		});

		cy.cGet('.ui-dialog-title').contains('Character').should('be.visible');
		cy.cGet('button.ui-tab').contains('Border').click();

		cy.cGet('#leftmf-input').should('be.visible');

		function getUnit(val) {
			return val.replace(/[\d.\-]/g, '').trim();
		}

		cy.cGet('#leftmf-input').invoke('val').then(function (initialVal) {
			var initialUnit = getUnit(initialVal);
			expect(initialUnit.length).to.be.greaterThan(0);

			cy.cGet('#leftmf-input').focus();
			cy.cGet('#leftmf-input').type('{uparrow}');

			cy.cGet('#leftmf-input').should('be.visible');
			cy.cGet('#leftmf-input').should(function ($el) {
				expect(getUnit($el.val())).to.equal(initialUnit);
			});
		});
	});

	it('Custom up/down buttons change the value', function () {
		cy.getFrameWindow().then(function (win) {
			win.app.map.sendUnoCommand('.uno:FootnoteDialog');
		});

		cy.cGet('.ui-dialog-title').contains('Footnotes').should('be.visible');

		cy.cGet('.jsdialog-window .spinfieldcontainer input').first().should('be.visible');

		cy.cGet('.jsdialog-window .spinfieldcontainer input').first().invoke('val').then(function (initialVal) {
			cy.cGet('.jsdialog-window .spinfieldbutton-up').first().click();

			cy.cGet('.jsdialog-window .spinfieldcontainer input').first().should(function ($el) {
				expect($el.val()).to.not.equal(initialVal);
			});
		});
	});
});
