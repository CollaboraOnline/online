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
		config.retries.runMode = 0;
		config.retries.openMode = 0;
	}

	if (process.env.CYPRESS_INTEGRATION === 'nextcloud') {
		config.retries.runMode = 0;
		config.retries.openMode = 0;
	}

	on('file:preprocessor', selectTests(config, pickTests));

	return config;
}

function getLOVersion(config) {
	var versionString = config.env.LO_CORE_VERSION;
	if (versionString.includes('Collabora')) {
		if (versionString.includes('_6.2.')) {
			return 'cp-6-2';
		} else if (versionString.includes('_6.4.')) {
			return 'cp-6-4';
		}
	}
	return 'master';
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

function pickTests(filename, foundTests, config) {
	var coreVersion = getLOVersion(config);
	var testsToRun = foundTests;
	if (!(coreVersion in blacklists.coreBlackLists))
		return testsToRun;

	var coreblackList = blacklists.coreBlackLists[coreVersion];
	testsToRun = removeBlacklistedTest(filename, testsToRun, coreblackList);

	if (process.env.CYPRESS_INTEGRATION === 'nextcloud') {
		testsToRun = removeBlacklistedTest(filename, testsToRun, blacklists.nextcloudBlackList);
	} else {
		testsToRun = removeBlacklistedTest(filename, testsToRun, blacklists.nextcloudOnlyList);
	}

	if (process.env.CYPRESS_INTEGRATION === 'php-proxy') {
		var ProxyblackList = blacklists.phpProxyBlackList;
		testsToRun = removeBlacklistedTest(filename, testsToRun, ProxyblackList);
	}

	return testsToRun;
}

module.exports = plugin;
