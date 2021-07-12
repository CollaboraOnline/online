/* global require cy Cypress Promise */

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
	Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
		return new Promise(function(resolve) {
			setTimeout(function() {
				resolve(originalFn(selector, options));
			}, COMMAND_DELAY);
		});
	});

	Cypress.Commands.overwrite('contains', function(originalFn, selector, content, options) {
		return new Promise(function(resolve) {
			setTimeout(function() {
				resolve(originalFn(selector, content, options));
			}, COMMAND_DELAY);
		});
	});
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
