import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,
  defaultCommandTimeout: 6000,
  modifyObstructiveCode: false,
  fixturesFolder: 'data',
  chromeWebSecurity: false,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      //require('@cypress/grep/src/plugin')(config);
      //return config;
      /*eslint-disable-next-line*/
      return require('./plugins/index.js')(on, config);
    },
    specPattern: 'integration_tests/**/*_spec.js',
  },
});
