/* -*- js-indent-level: 8 -*- */
/* global require __dirname */
var process = require('process');
var tasks = require('./tasks');
var tagify = require('cypress-tags');
var path = require('path');
var webpackPreprocessor = require('@cypress/webpack-preprocessor');

function plugin(on, config) {
	if (config.env.COVERAGE_RUN)
		require('@cypress/code-coverage/task')(on, config);

	on('task', {
		copyFile: tasks.copyFile,
		getSelectors: tasks.getSelectors,
	});

	if (process.env.ENABLE_VIDEO_REC) {
		config.video = true;
	}

	on('before:browser:launch', function(browser, launchOptions) {

		if (process.env.ENABLE_CONSOLE_LOG) {
			const logToOutput = require('cypress-log-to-output')

			logToOutput.install(on, function(type, event) {
				if (event.level === 'error' || event.type === 'error') {
					return true;
				}
				return false;
			});

			launchOptions = logToOutput.browserLaunchHandler(browser, launchOptions);
		}

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

	var options = {};
	if (process.env.NODE_PATH) {
		options.webpackOptions = {
			resolve: { modules:[ path.resolve(__dirname, process.env.NODE_PATH)] }
		};
	}
	var tagsFunc = tagify.tagify(config);
	var webpackFunc = webpackPreprocessor(options);

	on('file:preprocessor', function(file) {
		if (file.filePath.includes('integration')) {
			return tagsFunc(file);
		}
		return webpackFunc(file);
	});

	return config;
}

module.exports = plugin;
