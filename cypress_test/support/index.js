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
		//debugger;
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

Cypress.Commands.add('cSetActiveFrame', function(frameID) {
	cy.cActiveFrame = frameID;
});

Cypress.Commands.add('cSetLevel', function(level) {
	cy.cLevel = level;
});

Cypress.Commands.add('cGet', function(selector, options) {
	if (cy.cLevel === '1') {
		if (selector)
			return cy.get(cy.cActiveFrame).its('0.contentDocument').should('exist').then(cy.wrap).find(selector, options);
		else
			return cy.get(cy.cActiveFrame, options).its('0.contentDocument').should('exist').then(cy.wrap);
	}
	else if (selector) // This is not cool frame and there is a selector.
		return cy.get(cy.cActiveFrame).its('0.contentDocument').find('#coolframe').its('0.contentDocument').then(cy.wrap).find(selector, options);
	else // Not cool frame without a selector.
		return cy.get(cy.cActiveFrame, options).its('0.contentDocument').find('#coolframe').its('0.contentDocument').then(cy.wrap);
});
