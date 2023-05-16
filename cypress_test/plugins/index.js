/* global require */

var process = require('process');
var tasks = require('./tasks');
var tagify = require('cypress-tags');

function plugin(on, config) {
	if (config.env.COVERAGE_RUN)
		require('@cypress/code-coverage/task')(on, config);

	on('task', {
		copyFile: tasks.copyFile,
		failed: require('cypress-failed-log/src/failed')(),
		getSelectors: tasks.getSelectors,
	});

	if (process.env.ENABLE_VIDEO_REC) {
		config.video = true;
	}

	if (process.env.ENABLE_CONSOLE_LOG) {
		require('cypress-log-to-output').install(on, function(type, event) {
			if (event.level === 'error' || event.type === 'error') {
				return true;
			}

			return false;
		});
	}

	on('before:browser:launch', function(browser, launchOptions) {
		if (browser.family === 'chromium') {
			if (process.env.ENABLE_LOGGING) {
				launchOptions.args.push('--enable-logging=stderr');
				launchOptions.args.push('--v=2');
			}
			launchOptions.args.push('--simulate-outdated-no-au=\'2099-12-31T23:59:59.000000+00:00\'');
		}

		return launchOptions;
	});

	if (process.env.CYPRESS_INTEGRATION === 'php-proxy') {
		config.defaultCommandTimeout = 10000;
	}

	on('file:preprocessor', tagify.tagify(config));

	return config;
}

module.exports = plugin;
