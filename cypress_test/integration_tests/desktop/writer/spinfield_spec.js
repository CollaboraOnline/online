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

	function getUnit(val, decimal) {
		var pattern = new RegExp('[\\d\\-\\' + decimal + ']', 'g');
		return val.replace(pattern, '').trim();
	}

	function openDialogAndSwitchToBorder() {
		cy.then(function () {
			win.app.map.sendUnoCommand('.uno:FontDialog');
		});

		cy.cGet('.ui-dialog[role="dialog"]').should('have.length', 1);
		cy.then(function () {
			return helper.processToIdle(win);
		});

		cy.cGet('button#borders.ui-tab').click();

		cy.then(function () {
			return helper.processToIdle(win);
		});

		cy.cGet('#leftmf-input').should('be.visible');
	}

	function parseLocaleNumber(val, decimal) {
		if (decimal !== '.')
			val = val.replace(decimal, '.');
		return parseFloat(val);
	}

	function testUnitPersistence(decimal, expectedUnit) {
		openDialogAndSwitchToBorder();

		// Unit is correct and persists after clicking up button
		cy.cGet('#leftmf-input').invoke('val').then(function (initialVal) {
			var initialUnit = getUnit(initialVal, decimal);
			expect(initialUnit).to.equal(expectedUnit);

			cy.cGet('#leftmf .spinfieldbutton-up').click();

			cy.cGet('#leftmf-input').should('be.visible');
			cy.cGet('#leftmf-input').should(function ($el) {
				expect(getUnit($el.val(), decimal)).to.equal(expectedUnit);
			});
		});

		// Unit persists after arrow key change
		cy.cGet('#leftmf-input').invoke('val').then(function (val) {
			cy.cGet('#leftmf-input').focus();
			cy.cGet('#leftmf-input').type('{uparrow}');

			cy.cGet('#leftmf-input').should('be.visible');
			cy.cGet('#leftmf-input').should(function ($el) {
				expect(getUnit($el.val(), decimal)).to.equal(expectedUnit);
			});
		});

		// Typing a value with the locale's decimal separator is accepted
		cy.cGet('#leftmf-input').focus();
		cy.cGet('#leftmf-input').clear();
		cy.cGet('#leftmf-input').type('0' + decimal + '5');
		cy.cGet('#leftmf-input').should(function ($el) {
			expect(parseLocaleNumber($el.val(), decimal)).to.equal(0.5);
		});
	}

	it('Unit persists after button click and arrow key', function () {
		testUnitPersistence('.', '\u2033');
	});

	it('Unit persists with German locale', function () {
		helper.setupAndLoadDocument('writer/help_dialog.odt', false, false, 'de-DE');
		cy.getFrameWindow().then(function (w) {
			win = w;
		});

		testUnitPersistence(',', 'cm');
	});

	function testButtonsAndArrowKeys(decimal) {
		openDialogAndSwitchToBorder();

		var input = '#leftmf-input';
		var upBtn = '#leftmf .spinfieldbutton-up';
		var downBtn = '#leftmf .spinfieldbutton-down';

		// Up button increments
		cy.cGet(input).invoke('val').then(function (val) {
			var num = parseLocaleNumber(val, decimal);

			cy.cGet(upBtn).click();

			cy.cGet(input).should(function ($el) {
				expect(parseLocaleNumber($el.val(), decimal)).to.be.greaterThan(num);
			});
		});

		// Down button decrements
		cy.cGet(input).invoke('val').then(function (val) {
			var num = parseLocaleNumber(val, decimal);

			cy.cGet(downBtn).click();

			cy.cGet(input).should(function ($el) {
				expect(parseLocaleNumber($el.val(), decimal)).to.be.lessThan(num);
			});
		});

		// Arrow up key increments
		cy.cGet(input).invoke('val').then(function (val) {
			var num = parseLocaleNumber(val, decimal);

			cy.cGet(input).focus();
			cy.cGet(input).type('{uparrow}');

			cy.cGet(input).should(function ($el) {
				expect(parseLocaleNumber($el.val(), decimal)).to.be.greaterThan(num);
			});
		});

		// Arrow down key decrements
		cy.cGet(input).invoke('val').then(function (val) {
			var num = parseLocaleNumber(val, decimal);

			cy.cGet(input).type('{downarrow}');

			cy.cGet(input).should(function ($el) {
				expect(parseLocaleNumber($el.val(), decimal)).to.be.lessThan(num);
			});
		});
	}

	it('Buttons and arrow keys increment and decrement the value', function () {
		testButtonsAndArrowKeys('.');
	});

	it('Buttons and arrow keys work with German locale', function () {
		helper.setupAndLoadDocument('writer/help_dialog.odt', false, false, 'de-DE');
		cy.getFrameWindow().then(function (w) {
			win = w;
		});

		testButtonsAndArrowKeys(',');
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
