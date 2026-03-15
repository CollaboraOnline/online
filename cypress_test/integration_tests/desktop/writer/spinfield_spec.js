/* global describe it cy require beforeEach expect */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Spinfield unit and button tests', function () {
	var win;

	beforeEach(function () {
		helper.setupAndLoadDocument('writer/help_dialog.odt');
		cy.getFrameWindow().then(function (w) {
			win = w;
		});
	});

	function getUnit(val) {
		return val.replace(/[\d.\-]/g, '').trim();
	}

	function openDialogAndSwitchToBorder() {
		cy.then(function () {
			win.app.map.sendUnoCommand('.uno:FontDialog');
		});

		cy.cGet('.ui-dialog[role="dialog"]').should('have.length', 1);
		cy.then(function () {
			return helper.processToIdle(win);
		});

		cy.cGet('button.ui-tab').contains('Border').click();

		cy.then(function () {
			return helper.processToIdle(win);
		});

		cy.cGet('#leftmf-input').should('be.visible');
	}

	it('Unit persists after clicking up button', function () {
		openDialogAndSwitchToBorder();

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
		openDialogAndSwitchToBorder();

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

	it('Buttons and arrow keys increment and decrement the value', function () {
		cy.then(function () {
			win.app.map.sendUnoCommand('.uno:FootnoteDialog');
		});

		cy.cGet('.ui-dialog[role="dialog"]').should('have.length', 1);
		cy.then(function () {
			return helper.processToIdle(win);
		});

		var input = '.jsdialog-window .spinfieldcontainer input';

		cy.cGet(input).first().should('be.visible');

		// Up button increments
		cy.cGet(input).first().invoke('val').then(function (val) {
			var num = parseFloat(val);

			cy.cGet('.jsdialog-window .spinfieldbutton-up').first().click();

			cy.cGet(input).first().should(function ($el) {
				expect(parseFloat($el.val())).to.be.greaterThan(num);
			});
		});

		// Down button decrements
		cy.cGet(input).first().invoke('val').then(function (val) {
			var num = parseFloat(val);

			cy.cGet('.jsdialog-window .spinfieldbutton-down').first().click();

			cy.cGet(input).first().should(function ($el) {
				expect(parseFloat($el.val())).to.be.lessThan(num);
			});
		});

		// Arrow up key increments
		cy.cGet(input).first().invoke('val').then(function (val) {
			var num = parseFloat(val);

			cy.cGet(input).first().focus();
			cy.cGet(input).first().type('{uparrow}');

			cy.cGet(input).first().should(function ($el) {
				expect(parseFloat($el.val())).to.be.greaterThan(num);
			});
		});

		// Arrow down key decrements
		cy.cGet(input).first().invoke('val').then(function (val) {
			var num = parseFloat(val);

			cy.cGet(input).first().type('{downarrow}');

			cy.cGet(input).first().should(function ($el) {
				expect(parseFloat($el.val())).to.be.lessThan(num);
			});
		});
	});

	it('Buttons enabled after re-enabling spinfield in columns dialog', function () {
		cy.then(function () {
			win.app.map.sendUnoCommand('.uno:FormatColumns');
		});

		cy.cGet('.ui-dialog[role="dialog"]').should('have.length', 1);
		cy.then(function () {
			return helper.processToIdle(win);
		});

		// Set columns to 2
		cy.cGet('#colsnf-input').should('be.visible');
		cy.cGet('#colsnf .spinfieldbutton-up').click();
		cy.then(function () {
			return helper.processToIdle(win);
		});

		// Select a separator line style via the menubutton popup
		cy.cGet('#linestylelb').should('be.visible');
		cy.cGet('#linestylelb').click();
		cy.then(function () {
			return helper.processToIdle(win);
		});

		cy.cGet('#iconview_lines .ui-iconview-entry').first().click();
		cy.then(function () {
			return helper.processToIdle(win);
		});

		// The line width spinfield and its buttons should be enabled
		cy.cGet('#linewidthmf-input').should('be.visible');
		cy.cGet('#linewidthmf-input').should('not.have.attr', 'disabled');
		cy.cGet('#linewidthmf .spinfieldbutton-up').should('not.have.attr', 'disabled');
		cy.cGet('#linewidthmf .spinfieldbutton-down').should('not.have.attr', 'disabled');

		cy.cGet('#linewidthmf-input').invoke('val').then(function (initialVal) {
			var initialNum = parseFloat(initialVal);

			cy.cGet('#linewidthmf .spinfieldbutton-up').click();

			cy.cGet('#linewidthmf-input').should(function ($el) {
				var newNum = parseFloat($el.val());
				expect(newNum).to.be.greaterThan(initialNum);
			});
		});
	});
});
