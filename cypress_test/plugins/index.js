/* -*- js-indent-level: 8 -*- */
/* global require __dirname */
var process = require('process');
var tasks = require('./tasks');
var tagify = require('cypress-tags');
var path = require('path');
var webpackPreprocessor = require('@cypress/webpack-preprocessor');
const { lighthouse, prepareAudit } = require("@cypress-audit/lighthouse");


function plugin(on, config) {
	if (config.env.COVERAGE_RUN)
		require('@cypress/code-coverage/task')(on, config);

	on('task', {
		copyFile: tasks.copyFile,
		getSelectors: tasks.getSelectors,
		lighthouse: lighthouse(),
	});

	if (process.env.ENABLE_VIDEO_REC) {
		config.video = true;
	}

	on('before:browser:launch', function(browser, launchOptions) {

		if (process.env.ENABLE_CONSOLE_LOG) {
			const logToOutput = require('cypress-log-to-output')

			// Log levels matching CDP Runtime.consoleAPICalled type values
			// (highest to lowest)
			const logLevels = ['error', 'warning', 'log', 'info', 'debug'];
			let configuredLevel = process.env.ENABLE_CONSOLE_LOG.toLowerCase();
			// 'verbose' is an alias for the most verbose level
			if (configuredLevel === 'verbose') configuredLevel = 'debug';
			// Find the index of the configured level, default to 'error' if not found
			let maxLevelIndex = logLevels.indexOf(configuredLevel);
			if (maxLevelIndex === -1) {
				// If value is just truthy (e.g., "1" or "true"), default to error
				maxLevelIndex = 0;
			}

			logToOutput.install(on, function(type, event) {
				// For console.X calls (type === 'console'), event.type is the CDP method name
				// For browser log entries (type === 'browser'), event.level is the severity
				const level = type === 'console' ? event.type : event.level;
				const levelIndex = logLevels.indexOf(level);
				return levelIndex !== -1 && levelIndex <= maxLevelIndex;
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
		prepareAudit(launchOptions);

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
