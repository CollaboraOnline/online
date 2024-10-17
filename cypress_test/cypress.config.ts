/* -*- typescript-indent-level: 8 -*- */
import { defineConfig } from 'cypress';
import plugin from './plugins/index.js';
import process from 'process';
import installLogsPrinter from 'cypress-terminal-report/src/installLogsPrinter';
import { configureVisualRegression } from 'cypress-visual-regression';

export default defineConfig({
	video: false,
	defaultCommandTimeout: 10000,
	modifyObstructiveCode: false,
	fixturesFolder: 'data',
	chromeWebSecurity: false,
	screenshotOnRunFailure: true,
	screenshotsFolder: './integration_tests/snapshots/actual',
	env: {
		USER_INTERFACE: process.env.USER_INTERFACE,
		visualRegressionType: 'regression',
		visualRegressionBaseDirectory: './integration_tests/snapshots/base',
	},
	retries: {
		runMode: 1,
		openMode: 0,
	},
	e2e: {
		baseUrl: 'http://' + process.env.COOLWSD_SERVER + ':' + process.env.FREE_PORT,
		setupNodeEvents(on, config) {
			installLogsPrinter(on, {
				printLogsToConsole: 'onFail', // 'always', 'onFail', 'never'
			});
			plugin(on, config);
			configureVisualRegression(on);
		},
		specPattern: 'integration_tests/**/*_spec.js',
	},
});
