/* -*- js-indent-level: 8 -*- */
/* global require cy Cypress */

require('cypress-wait-until');
require('cypress-file-upload');
require('cypress-iframe');
import installLogsCollector from 'cypress-terminal-report/src/installLogsCollector';

installLogsCollector();

if (Cypress.env('INTEGRATION') === 'php-proxy') {
	Cypress.Server.defaults({
		ignore: function() {
			return true;
		}
	});
}

var COMMAND_DELAY = 1000;

// Ignore exceptions coming from nextcloud.
if (Cypress.env('INTEGRATION') === 'nextcloud') {
	Cypress.on('uncaught:exception', function() {
		return false;
	});
} else {
	Cypress.on('window:before:load', function(appWindow) {
		appWindow.addEventListener('error', function(event) {
			Cypress.log({ name:'error:',
				      message: (event.error.message ? event.error.message : 'no message')
				      + '\n' + (event.error.stack ? event.error.stack : 'no stack') });
		});

	});
}

Cypress.on('fail', function(error) {
	Cypress.log({ name:'fail:',
		      message: error.codeFrame.absoluteFile + ':'
		      + error.codeFrame.line + ':'
		      + error.codeFrame.column + '\n'
		      + error.codeFrame.frame });

	//https://stackoverflow.com/a/63519375/1592055
	//returning false here prevents Cypress from failing the test */
	if (error.message.includes('ResizeObserver loop limit exceeded')) {
		return false;
	}

	throw error;
});

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

/**
 * Set the current iFrame
 * Example: cy.cSetActiveFrame('#coolframe');
 */
Cypress.Commands.add('cSetActiveFrame', function(frameID) {
	Cypress.log();
	cy.cActiveFrame = frameID;
});

Cypress.Commands.add('cSetLevel', function(level) {
	Cypress.log();
	cy.cLevel = level;
});

/**
 * Get the current iFrame body to be chained with other queries.
 * Example: cy.cframe().find('#my-item');
 * It is not necessary to chain .should('exist') after this.
 */
Cypress.Commands.add('cframe', function(frameID, options) {
	// Set frameID
	if (!frameID) {
		if (!cy.cActiveFrame) {
			throw new Error('getFrame: Active frame not set');
		}
		frameID = cy.cActiveFrame;
	}

	// Log
	if (options && options.log) {
		Cypress.log({message: frameID});
	}

	// Execute
	return cy.get(frameID, {log: false})
		.its('0.contentDocument', {log: false});
});

/**
 * Get the current iFrame window to be chained with other queries.
 */
Cypress.Commands.add('getFrameWindow', function(frameID) {
	// Set frameID
	if (!frameID) {
		if (!cy.cActiveFrame) {
			throw new Error('getFrame: Active frame not set');
		}
		frameID = cy.cActiveFrame;
	}

	// Log
	Cypress.log({message: frameID});

	// Execute
	return cy.get(frameID, {log: false})
		.its('0.contentWindow', {log: false});
});

/**
 * Find an element within the current iFrame
 * Note: Use cy.cframe().find() instead, which offers better logging on failure
 */
Cypress.Commands.add('cGet', function(selector, options) {
	if (options) {
		if (options.log != false) {
			Cypress.log();
		}
	} else {
		Cypress.log();
	}

	var optionsWithLogFalse;
	if (options) {
		optionsWithLogFalse = options;
		optionsWithLogFalse.log = false;
	} else {
		optionsWithLogFalse = {log: false};
	}

	if (cy.cLevel === '1') {
		if (selector)
			return cy.get(cy.cActiveFrame, {log: false})
				.its('0.contentDocument', {log: false})
				.find(selector, optionsWithLogFalse);
		else
			return cy.get(cy.cActiveFrame, optionsWithLogFalse)
				.its('0.contentDocument', {log: false});
	}
	else if (selector) // This is not cool frame and there is a selector.
		return cy.get(cy.cActiveFrame, {log: false})
			.its('0.contentDocument', {log: false})
			.find('#coolframe', {log: false})
			.its('0.contentDocument', {log: false})
			.find(selector, optionsWithLogFalse);
	else // Not cool frame without a selector.
		return cy.get(cy.cActiveFrame, optionsWithLogFalse)
			.its('0.contentDocument', {log: false})
			.find('#coolframe', {log: false})
			.its('0.contentDocument', {log: false});
});
