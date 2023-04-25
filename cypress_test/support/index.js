/* global require cy Cypress */

require('cypress-failed-log');
require('cypress-wait-until');
require('cypress-file-upload');
require('cypress-iframe');

if (Cypress.env('INTEGRATION') === 'php-proxy') {
	Cypress.Server.defaults({
		ignore: function() {
			return true;
		}
	});
}

var COMMAND_DELAY = 1000;

if (Cypress.browser.isHeaded) {
	// To debug exceptions more easily - enable this:
	Cypress.on('fail', () => {
		// eslint-disable-next-line no-debugger
		debugger;
	});
}

if (Cypress.browser.isHeaded) {
	const runCommand = cy.queue.runCommand.bind(cy.queue);
	cy.queue.runCommand = function slowRunCommand(cmd) {
		if (cmd != 'get' && cmd != 'contains')
			return runCommand(cmd);
		else
			return Cypress.Promise.delay(COMMAND_DELAY).then(() => runCommand(cmd));
	};
}

// reduce poll interval when waiting.
Cypress.Commands.overwrite('waitUntil', function(originalFn, subject, checkFunction, originalOptions) {
	var options = originalOptions;
	if (!options)
		options = {};
	if (!options.interval)
		options.interval = 10; // ms
	return originalFn(subject, checkFunction, options);
});

Cypress.Commands.add('customGet', function(selector, frameId, options) {
	if (typeof frameId === 'undefined') {
		return cy.get(selector, options);
	} else {
		return cy.iframe(frameId).find(selector,options);
	}
});
