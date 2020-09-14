/* global require Cypress */

require('cypress-failed-log');

if (Cypress.env('INTEGRATION') === 'php-proxy') {
	Cypress.Server.defaults({
		whitelist: function() {
			return true;
		}
	});
}
