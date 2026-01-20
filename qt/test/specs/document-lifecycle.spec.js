/**
 * E2E Test: Document Lifecycle
 *
 * This test demonstrates the dual-driver architecture:
 * - browser.webEngine: Controls web content inside QtWebEngine
 * - browser.native: Controls native Qt widgets via AT-SPI
 *
 * Test flow:
 * 1. Open coda-qt (handled by wdio.conf.js)
 * 2. Click "Blank Document" in BackstageView (webEngine)
 * 3. Handle window switch (BackstageView closes, new document window opens)
 * 4. Wait for document to load and type text (webEngine)
 * 5. Close document with Ctrl+W (webEngine)
 * 6. Handle "Unsaved Changes" dialog (native AT-SPI)
 */

import http from 'http';

const REMOTE_DEBUGGING_PORT = process.env.REMOTE_DEBUGGING_PORT || 9222;
const AT_SPI_PORT = process.env.AT_SPI_PORT || 4723;

// Helper to get available debug targets from Chrome DevTools Protocol
async function getDebugTargets(port = REMOTE_DEBUGGING_PORT) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json/list`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Wait for a page target to be available
async function waitForPageTarget(port = REMOTE_DEBUGGING_PORT, maxWaitMs = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const targets = await getDebugTargets(port);
            const pageTargets = targets.filter(t => t.type === 'page');
            if (pageTargets.length > 0) {
                return pageTargets[0];
            }
        } catch (e) {
            // Ignore, retry
        }
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Timeout waiting for page target');
}

// Helper to find element using AT-SPI's native 'name' strategy
async function findAtSpiElementByName(sessionId, name) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ using: 'name', value: name });
        const options = {
            hostname: 'localhost',
            port: AT_SPI_PORT,
            path: `/session/${sessionId}/element`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Helper to click an AT-SPI element
async function clickAtSpiElement(sessionId, elementId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: AT_SPI_PORT,
            path: `/session/${sessionId}/element/${elementId}/click`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.end();
    });
}

// Wait for AT-SPI element to appear
async function waitForAtSpiElement(sessionId, name, maxWaitMs = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const result = await findAtSpiElementByName(sessionId, name);
            if (result.value && result.value['element-6066-11e4-a52e-4f735466cecf']) {
                return result.value['element-6066-11e4-a52e-4f735466cecf'];
            }
        } catch (e) {
            // Ignore, retry
        }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for AT-SPI element: ${name}`);
}

describe('Document lifecycle E2E test', () => {

    it('should create, edit, and close document handling unsaved changes dialog', async function() {
        this.timeout(120000);

        // ============================================================
        // PHASE 1: BackstageView - Click on "Blank Document"
        // ============================================================

        // Wait for the BackstageView to be ready and Blank Document card to be visible
        await browser.webEngine.waitUntil(
            async () => {
                return await browser.webEngine.execute(() => {
                    if (document.readyState !== 'complete') return false;
                    const cards = document.querySelectorAll('.backstage-template-card');
                    for (const card of cards) {
                        const nameEl = card.querySelector('.template-name');
                        if (nameEl && nameEl.textContent.includes('Blank Document')) {
                            return true;
                        }
                    }
                    return document.querySelector('.backstage-template-card.is-blank') !== null;
                });
            },
            { timeout: 30000, interval: 200, timeoutMsg: 'Blank Document card not found' }
        );

        // Click the Blank Document card using setTimeout to return before window closes
        await browser.webEngine.execute(() => {
            setTimeout(() => {
                const cards = document.querySelectorAll('.backstage-template-card');
                for (const card of cards) {
                    const nameEl = card.querySelector('.template-name');
                    if (nameEl && nameEl.textContent.includes('Blank Document')) {
                        card.click();
                        return;
                    }
                }
                const blankCard = document.querySelector('.backstage-template-card.is-blank');
                if (blankCard) blankCard.click();
            }, 50);
        });

        // ============================================================
        // PHASE 2: Wait for new document window
        // ============================================================

        // Wait for a new page target to appear
        await waitForPageTarget();

        // Wait until we can successfully switch to a window and execute in it
        await browser.webEngine.waitUntil(
            async () => {
                try {
                    const handles = await browser.webEngine.getWindowHandles();
                    for (const handle of handles) {
                        try {
                            await browser.webEngine.switchToWindow(handle);
                            await browser.webEngine.getTitle();
                            return true;
                        } catch (e) {
                            // Try next handle
                        }
                    }
                } catch (e) {
                    // Retry
                }
                return false;
            },
            { timeout: 30000, interval: 500, timeoutMsg: 'Failed to connect to new document window' }
        );

        // ============================================================
        // PHASE 3: Wait for document editor to be ready
        // ============================================================

        // Wait until backstage is gone and editor elements are present
        await browser.webEngine.waitUntil(
            async () => {
                return await browser.webEngine.execute(() => {
                    const backstage = document.querySelector('.backstage-container');
                    const backstageVisible = backstage &&
                        getComputedStyle(backstage).display !== 'none';
                    const hasMap = document.getElementById('map') !== null;
                    const hasToolbar = document.querySelector('.notebookbar') !== null ||
                                       document.querySelector('#toolbar-up') !== null;
                    return !backstageVisible && (hasMap || hasToolbar);
                });
            },
            { timeout: 60000, interval: 500, timeoutMsg: 'Document editor did not load' }
        );

        // Wait for the document to be fully interactive (can receive input)
        await browser.webEngine.waitUntil(
            async () => {
                return await browser.webEngine.execute(() => {
                    const map = document.getElementById('map');
                    if (!map) return false;
                    // Check if the map has tiles loaded (indicates document is ready)
                    const hasTiles = document.querySelector('.leaflet-tile-loaded') !== null;
                    // Or check if there's a cursor/caret
                    const hasCursor = document.querySelector('.leaflet-cursor') !== null ||
                                      document.querySelector('.blinking-cursor') !== null;
                    return hasTiles || hasCursor;
                });
            },
            { timeout: 30000, interval: 500, timeoutMsg: 'Document not ready for input' }
        );

        // ============================================================
        // PHASE 4: Type text in the document
        // ============================================================

        const loremIpsum = 'Lorem ipsum dolor sit amet.';

        // Focus the document and wait for focus to be confirmed
        await browser.webEngine.execute(() => {
            const map = document.getElementById('map');
            if (map) {
                map.focus();
                map.click();
            }
        });

        // Wait for focus to be established
        await browser.webEngine.waitUntil(
            async () => {
                return await browser.webEngine.execute(() => {
                    const map = document.getElementById('map');
                    return map && (document.activeElement === map ||
                                   map.contains(document.activeElement));
                });
            },
            { timeout: 10000, interval: 100, timeoutMsg: 'Could not focus document' }
        );

        // Type text
        await browser.webEngine.keys(loremIpsum);

        // Wait for the document to register as modified
        await browser.webEngine.waitUntil(
            async () => {
                return await browser.webEngine.execute(() => {
                    // Check various indicators that the document was modified
                    const title = document.title;
                    // Title might contain asterisk or "modified"
                    if (title.includes('*')) return true;
                    // Or check if there's content in the document
                    const textLayer = document.querySelector('.leaflet-pane');
                    return textLayer !== null;
                });
            },
            { timeout: 10000, interval: 200, timeoutMsg: 'Document did not register modification' }
        );

        // ============================================================
        // PHASE 5: Close document with Ctrl+W
        // ============================================================

        // Send Ctrl+W - this will trigger the native dialog which blocks WebDriver
        // Use Promise.race to handle the blocking behavior
        const ctrlWPromise = browser.webEngine.keys(['Control', 'w']);
        await Promise.race([
            ctrlWPromise,
            new Promise(r => setTimeout(r, 5000))  // Fallback timeout if dialog blocks
        ]);

        // ============================================================
        // PHASE 6: Handle native "Unsaved Changes" dialog via AT-SPI
        // ============================================================

        const nativeSessionId = browser.native.sessionId;

        // Wait for the "Close without Saving" button to appear in AT-SPI
        const elementId = await waitForAtSpiElement(nativeSessionId, 'Close without Saving', 30000);

        // Click the button
        await clickAtSpiElement(nativeSessionId, elementId);

        // Wait for the dialog to close (element should no longer exist)
        await browser.webEngine.waitUntil(
            async () => {
                try {
                    const result = await findAtSpiElementByName(nativeSessionId, 'Close without Saving');
                    // If we get an error or no element, dialog is closed
                    return !result.value || result.value.error === 'no such element';
                } catch (e) {
                    return true;  // Error likely means dialog closed
                }
            },
            { timeout: 10000, interval: 200, timeoutMsg: 'Dialog did not close' }
        );
    });
});
