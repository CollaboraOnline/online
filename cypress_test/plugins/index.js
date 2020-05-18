/* global require */

var process = require('process');
var tasks = require('./tasks');

function plugin(on, config) {
	on('task', {
		copyFile: tasks.copyFile,
		failed: require('cypress-failed-log/src/failed')()
	});

	on('before:browser:launch', function(browser, launchOptions) {
		if (browser.family === 'chromium' && process.env.ENABLE_LOGGING) {
			launchOptions.args.push('--enable-logging=stderr');
			launchOptions.args.push('--v=2');
			return launchOptions;
		}
	});

	return config;
}

module.exports = plugin;
