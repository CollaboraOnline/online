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
        await new Promise(r => setTimeout(r, 500));
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

describe('Document lifecycle E2E test', () => {

    it('should create, edit, and close document handling unsaved changes dialog', async function() {
        this.timeout(120000);

        // ============================================================
        // PHASE 1: BackstageView - Click on "Blank Document"
        // ============================================================

        // Wait for the BackstageView to be ready
        await browser.webEngine.waitUntil(
            async () => {
                const ready = await browser.webEngine.execute(() => {
                    return document.readyState === 'complete';
                });
                return ready;
            },
            { timeout: 30000, timeoutMsg: 'Page did not load in time' }
        );

        // Give the BackstageView time to render
        await browser.webEngine.pause(3000);

        // Verify Blank Document card exists
        const cardFound = await browser.webEngine.execute(() => {
            const cards = document.querySelectorAll('.backstage-template-card');
            for (const card of cards) {
                const nameEl = card.querySelector('.template-name');
                if (nameEl && nameEl.textContent.includes('Blank Document')) {
                    return true;
                }
            }
            return document.querySelector('.backstage-template-card.is-blank') !== null;
        });

        if (!cardFound) {
            throw new Error('Blank Document card not found in BackstageView');
        }

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

        // Wait for the new window to appear
        await new Promise(r => setTimeout(r, 5000));
        await waitForPageTarget();

        // Switch to the new window
        let connected = false;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                const handles = await browser.webEngine.getWindowHandles();
                for (const handle of handles) {
                    try {
                        await browser.webEngine.switchToWindow(handle);
                        await browser.webEngine.getTitle();
                        connected = true;
                        break;
                    } catch (e) {
                        // Try next handle
                    }
                }
                if (connected) break;
            } catch (e) {
                // Retry
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!connected) {
            throw new Error('Failed to connect to new document window');
        }

        // ============================================================
        // PHASE 3: Wait for document editor to be ready
        // ============================================================

        await browser.webEngine.waitUntil(
            async () => {
                const status = await browser.webEngine.execute(() => {
                    const backstage = document.querySelector('.backstage-container');
                    const backstageVisible = backstage &&
                        getComputedStyle(backstage).display !== 'none';
                    const hasMap = document.getElementById('map') !== null;
                    const hasToolbar = document.querySelector('.notebookbar') !== null ||
                                       document.querySelector('#toolbar-up') !== null;
                    return !backstageVisible && (hasMap || hasToolbar);
                });
                return status;
            },
            { timeout: 60000, interval: 2000, timeoutMsg: 'Document editor did not load' }
        );

        // Give the document time to fully initialize
        await browser.webEngine.pause(5000);

        // ============================================================
        // PHASE 4: Type text in the document
        // ============================================================

        const loremIpsum = 'Lorem ipsum dolor sit amet.';

        // Focus the document
        await browser.webEngine.execute(() => {
            const map = document.getElementById('map');
            if (map) {
                map.focus();
                map.click();
            }
        });

        await browser.webEngine.pause(1000);

        // Type text
        await browser.webEngine.keys(loremIpsum);
        await browser.webEngine.pause(2000);

        // ============================================================
        // PHASE 5: Close document with Ctrl+W
        // ============================================================

        // Send Ctrl+W (use timeout since dialog might block)
        const ctrlWPromise = browser.webEngine.keys(['Control', 'w']);
        await Promise.race([
            ctrlWPromise,
            new Promise(r => setTimeout(r, 5000))
        ]);

        await new Promise(r => setTimeout(r, 1000));

        // ============================================================
        // PHASE 6: Handle native "Unsaved Changes" dialog via AT-SPI
        // ============================================================

        await new Promise(r => setTimeout(r, 3000));

        const nativeSessionId = browser.native.sessionId;

        // Find and click "Close without Saving" button using direct AT-SPI API
        const result = await findAtSpiElementByName(nativeSessionId, 'Close without Saving');

        if (result.value && result.value['element-6066-11e4-a52e-4f735466cecf']) {
            const elementId = result.value['element-6066-11e4-a52e-4f735466cecf'];
            await clickAtSpiElement(nativeSessionId, elementId);
        } else {
            throw new Error('Could not find "Close without Saving" button in dialog');
        }

        await new Promise(r => setTimeout(r, 2000));
    });
});
