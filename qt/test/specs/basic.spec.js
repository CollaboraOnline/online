/**
 * Basic tests for coda-qt application.
 *
 * These tests use browser.webEngine for web content inside QtWebEngine.
 * For native Qt widget tests, see document-lifecycle.spec.js which also uses browser.native.
 */
describe('coda-qt basic tests', () => {
    describe('Application lifecycle', () => {
        it('should connect to coda-qt via WebDriver', async function() {
            this.timeout(10000);

            // browser.webEngine is automatically connected via WebDriver config (multiremote)
            // WebDriver connects to the coda-qt instance started in wdio.conf.js

            // Get page title
            const title = await browser.webEngine.getTitle();
            console.log(`Page title: ${title}`);

            // Verify we can execute JavaScript in the page
            const readyState = await browser.webEngine.execute(() => {
                return document.readyState;
            });
            console.log(`Document ready state: ${readyState}`);

            // Basic assertion - we should be able to interact with the page
            if (!readyState) {
                throw new Error('Could not interact with the page via WebDriver');
            }
        });

        it('should be able to get page dimensions', async function() {
            this.timeout(5000);

            // Get page dimensions via JavaScript (since getWindowSize is not supported)
            const dimensions = await browser.webEngine.execute(() => {
                return {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    documentWidth: document.documentElement.clientWidth,
                    documentHeight: document.documentElement.clientHeight
                };
            });
            console.log(`Page dimensions: ${dimensions.width}x${dimensions.height}`);

            // Verify we got valid dimensions
            if (!dimensions.width || !dimensions.height) {
                throw new Error('Invalid page dimensions');
            }
        });

        it('should be able to execute custom JavaScript', async function() {
            this.timeout(5000);

            // Execute some custom JavaScript and get the result
            const userAgent = await browser.webEngine.execute(() => {
                return navigator.userAgent;
            });
            console.log(`User agent: ${userAgent}`);

            // Verify the user agent contains expected values
            if (!userAgent.includes('QtWebEngine')) {
                throw new Error('User agent does not indicate QtWebEngine');
            }
        });
    });
});
