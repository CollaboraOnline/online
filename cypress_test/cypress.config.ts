/* global process */
import { defineConfig } from 'cypress';
import plugin from './plugins/index.js';
import 'process';

export default defineConfig({
  video: false,
  defaultCommandTimeout: 10000,
  modifyObstructiveCode: false,
  fixturesFolder: 'data',
  chromeWebSecurity: false,
  screenshotOnRunFailure: false,
  env: { USER_INTERFACE: process.env.USER_INTERFACE },
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    setupNodeEvents(on, config) {
      plugin(on, config);
    },
    specPattern: 'integration_tests/**/*_spec.js',
  },
});
