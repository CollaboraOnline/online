/* global require */

var process = require('process');
var tasks = require('./tasks');
var blacklists = require('./blacklists');
var selectTests = require('cypress-select-tests');

function plugin(on, config) {
	if (config.env.COVERAGE_RUN)
		require('@cypress/code-coverage/task')(on, config);
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

	on('file:preprocessor', selectTests(config, pickTests));

	return config;
}

function getLOVersion(config) {
	var versionString = config.env.LO_CORE_VERSION;
	if (versionString.includes('Collabora')) {
		if (versionString.includes(' 6.2.')) {
			return 'cp-6-2';
		} else if (versionString.includes(' 6.4.')) {
			return 'cp-6-4';
		}
	}
	return 'master';
}

function pickTests(filename, foundTests, config) {

	var coreVersion = getLOVersion(config);
	var testsToRun = foundTests;
	if (!(coreVersion in blacklists.testBlackLists))
		return testsToRun;

	var blackList = blacklists.testBlackLists[coreVersion];
	for (var i = 0; i < blackList.length; i++) {
		if (filename.endsWith(blackList[i][0])) {
			if (blackList[i][1].length === 0) // skip the whole test suite
				return [];
			testsToRun = testsToRun.filter(fullTestName => !blackList[i][1].includes(fullTestName[1]));
		}
	}
	return testsToRun;
}

module.exports = plugin;
