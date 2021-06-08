/* global require */

var process = require('process');
var uuid = require('uuid');

var tasks = require('./tasks');
var blacklists = require('./blacklists');
var whitelists = require('./whitelists');
var selectTests = require('cypress-select-tests');

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

	if (process.env.ENABLE_LOGGING) {
		on('before:browser:launch', function(browser, launchOptions) {
			if (browser.family === 'chromium') {
				launchOptions.args.push('--enable-logging=stderr');
				launchOptions.args.push('--v=2');
				return launchOptions;
			}
		});
	}

	if (process.env.CYPRESS_INTEGRATION === 'php-proxy') {
		config.defaultCommandTimeout = 10000;
	}

	if (process.env.USER_INTERFACE === 'notebookbar') {
		config.env.USER_INTERFACE = 'notebookbar';
	}

	on('file:preprocessor', (file) => {
		if (file.outputPath.endsWith('support/index.js')) {
			var runUuid = uuid.v4();
			var truncLength = file.outputPath.length - ('index.js').length;
			file.outputPath = file.outputPath.substring(0, truncLength);
			file.outputPath += runUuid + 'index.js';
		}

		return selectTests(config, pickTests)(file);
	});

	return config;
}

function removeBlacklistedTest(filename, testsToRun, blackList) {
	for (var i = 0; i < blackList.length; i++) {
		if (filename.endsWith(blackList[i][0])) {
			if (blackList[i][1].length === 0) // skip the whole test suite
				return [];
			return testsToRun.filter(fullTestName => !blackList[i][1].includes(fullTestName[1]));
		}
	}
	return testsToRun;
}

function isNotebookbarTest(filename, whitelist) {
	for (var i =0 ; i < whitelist.length; i++) {
		if (filename.endsWith(whitelist[i])) {
			return true;
		}
	}
}

function pickTests(filename, foundTests) {
	var testsToRun = foundTests;

	if (process.env.CYPRESS_INTEGRATION === 'nextcloud') {
		testsToRun = removeBlacklistedTest(filename, testsToRun, blacklists.nextcloudBlackList);
	} else {
		testsToRun = removeBlacklistedTest(filename, testsToRun, blacklists.nextcloudOnlyList);
	}

	if (process.env.CYPRESS_INTEGRATION === 'php-proxy') {
		var ProxyblackList = blacklists.phpProxyBlackList;
		testsToRun = removeBlacklistedTest(filename, testsToRun, ProxyblackList);
	}

	if (process.env.USER_INTERFACE === 'notebookbar') {
		if (!isNotebookbarTest(filename,whitelists.notebookbarOnlyList)) {
			testsToRun = [];
		}
	}
	return testsToRun;
}

module.exports = plugin;
