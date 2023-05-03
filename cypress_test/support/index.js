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

Cypress.Commands.add('cSetActiveFrame', function(frameID) {
	cy.cActiveFrame = frameID;
	// ensure it is also set logically when we execute the test
	cy.then(function() { cy.cActiveFrame = frameID; });
});

Cypress.Commands.add('cGet', function(selector, options) {
	if (!cy.cActiveFrame)
		cy.cActiveFrame = '#coolframe';
	//cy.frameLoaded(cy.cActiveFrame);
	if (cy.cActiveFrame === '#coolframe')
		if (true) {
			if (selector)
				return cy.get(cy.cActiveFrame, options).its('0.contentDocument').should('exist').then(cy.wrap).find(selector);
			else
				return cy.get(cy.cActiveFrame, options).its('0.contentDocument').should('exist').then(cy.wrap);
		}
		else {
			return cy.waitUntil(() => {
				// 'document' in this context is the near empty document of the
				// first cypress window near the top of the stack. Nothing
				// visible, and that has nothing in it. So we need to be more
				// adventurous to find our real iframe:
				//
				// document.getElementById('coolframe') - returns nothing
				// Cypress.$('coolframe') - returns nothing
				var cooldocument = window.top.document.getElementsByClassName('aut-iframe')[0].contentDocument.getElementById('coolframe').contentDocument;
				console.log('Try to get ' + selector + ' on ' + cooldocument);
				if (!cooldocument)
					return false;
				var elem = Cypress.$(cooldocument).find(selector);
				console.log('got ' + elem + ' of length ' + elem.length + ' from selector ' + selector);
				if (!elem || elem.length < 1)
					return false;
				return cy.wrap(elem);
			});
		}
//		return cy.waitUntil(() => cy.iframe(cy.cActiveFrame).its('0.contentDocument').get(selector,options));
	else
		return cy.get(cy.cActiveFrame).its('0.contentDocument').find('#coolframe').its('0.contentDocument').then(cy.wrap);
		//return cy.iframe(cy.cActiveFrame).find('#coolframe').its('0.contentDocument').get(selector,options);
});

Cypress.Commands.add('customGet', function(selector, frameId, options) {
	if (typeof frameId === 'undefined') {
		return cy.cGet(selector, options);
	} else {
		cy.cActiveFrame = frameId;
		return cy.cGet(selector,options);
	}
});
