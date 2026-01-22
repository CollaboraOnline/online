/* -*- js-indent-level: 8 -*- */
/* global cy Cypress expect require */

var ceHelper = require('./contenteditable_helper');
var desktopHelper = require('./desktop_helper');

/**
 * Enable UICoverage tracking. Call this in the `before` hook after getting the frame window.
 * @param {Object} win - The frame window object
 */
function enableUICoverage(win) {
	const enableUICoverage = {
		'Track': { 'type': 'boolean', 'value': true }
	};
	win.app.map.sendUnoCommand('.uno:UICoverage', enableUICoverage);
}

/**
 * Report UICoverage and verify results. Call this in the `after` hook.
 * Returns the result object via a Cypress alias '@uicoverageResult' for additional assertions.
 * @param {Object} win - The frame window object
 */
function reportUICoverage(win) {
	cy.spy(win.app.socket, '_onMessage').as('onMessage').log(false);

	cy.then(() => {
		const endUICoverage = {
			'Report': { 'type': 'boolean', 'value': true },
			'Track': { 'type': 'boolean', 'value': false }
		};
		win.app.map.sendUnoCommand('.uno:UICoverage', endUICoverage);
	});

	var coverageResult = null;

	function findUICoverageCall(onMessage) {
		return onMessage.getCalls().find(call => {
			const evt = call.args && call.args[0]
			const textMsg = evt && evt.textMsg;
			if (!textMsg || !textMsg.startsWith('unocommandresult:')) {
				return false;
			}
			const jsonPart = textMsg.replace('unocommandresult:', '').trim();
			const data = JSON.parse(jsonPart);
			return data.commandName === '.uno:UICoverage';
		});
	}

	// Use should() for retry until the message arrives
	cy.get('@onMessage').should(onMessage => {
		const matchingCall = findUICoverageCall(onMessage);
		expect(matchingCall, '.uno:UICoverage result').to.be.an('object');

		const textMsg = matchingCall.args[0].textMsg;
		const jsonPart = textMsg.replace('unocommandresult:', '').trim();
		coverageResult = JSON.parse(jsonPart).result;

		Cypress.log({name: 'UICoverage Message: ', message: JSON.stringify(coverageResult)});
	}).then(() => {
		cy.wrap(coverageResult).as('uicoverageResult');
	});
}

/**
 * Reset document state after each test.
 */
function resetState() {
	desktopHelper.undoAll();
	cy.cGet('div.clipboard').as('clipboard');
	ceHelper.moveCaret('home', 'ctrl');
}

/**
 * Check for a11y errors in spy calls and throw if any found.
 * @param {Object} win - The frame window object
 * @param {Object} spy - Sinon spy on console.error
 */
function checkA11yErrors(win, spy) {
	cy.then(() => {
		const a11yValidatorExceptionText = win.app.A11yValidatorException.PREFIX;
		const a11yErrors = spy.getCalls().filter(call =>
			String(call.args[0]).includes(a11yValidatorExceptionText)
		);

		if (a11yErrors.length > 0) {
			const errorMessages = a11yErrors.map(call =>
				call.args.map(arg => String(arg)).join(' ')
			).join('\n\n');

			throw new Error(`Found A11y errors:\n${errorMessages}`);
		}
	});
}

/**
 * Run a11y validation via dispatcher command and check for errors.
 * @param {Object} win - The frame window object
 * @param {string} dispatchCommand - The dispatch command (e.g., 'validatedialogsa11y')
 */
function runA11yValidation(win, dispatchCommand) {
	cy.then(() => {
		var spy = Cypress.sinon.spy(win.console, 'error');
		win.app.dispatcher.dispatch(dispatchCommand);

		checkA11yErrors(win, spy);

		if (spy && spy.restore) {
			spy.restore();
		}
	});
}

module.exports.enableUICoverage = enableUICoverage;
module.exports.reportUICoverage = reportUICoverage;
module.exports.resetState = resetState;
module.exports.checkA11yErrors = checkA11yErrors;
module.exports.runA11yValidation = runA11yValidation;
