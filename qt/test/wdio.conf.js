import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, execSync } from 'child_process';
import http from 'http';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = promisify(setTimeout);

// Remote debugging port for QtWebEngine
const REMOTE_DEBUGGING_PORT = process.env.REMOTE_DEBUGGING_PORT || 9222;
const CODA_QT_BINARY = process.env.CODA_QT_BINARY || join(__dirname, '..', 'coda-qt');

// AT-SPI Flask server configuration
const AT_SPI_PORT = process.env.AT_SPI_PORT || 4723;
const AT_SPI_DRIVER_PATH = process.env.AT_SPI_DRIVER_PATH || '/home/sarper/collabora/selenium-webdriver-at-spi/selenium-webdriver-at-spi.py';

// Find Qt's WebEngineDriver
let QT_WEBENGINE_DRIVER;
try {
    const qtLibExecDir = execSync('qmake -query QT_INSTALL_LIBEXECS').toString().trim();
    QT_WEBENGINE_DRIVER = join(qtLibExecDir, 'webenginedriver');
} catch (e) {
    console.error('Failed to find Qt installation. Make sure qmake is in your PATH.');
    throw e;
}

// Global variables to store processes
let codaQtProcess = null;
let atSpiServerProcess = null;
let codaQtPid = null;

// Helper to check if remote debugging is available
async function waitForRemoteDebugging(port, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:${port}/json/version`, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', reject);
                req.setTimeout(1000);
            });
            if (response) {
                console.log(`Remote debugging available on port ${port}`);
                return true;
            }
        } catch (e) {
            // Not ready yet, wait
        }
        await sleep(1000);
    }
    return false;
}

// Helper to check if AT-SPI Flask server is available
async function waitForAtSpiServer(port, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:${port}/status`, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', reject);
                req.setTimeout(1000);
            });
            if (response) {
                console.log(`AT-SPI server available on port ${port}`);
                return true;
            }
        } catch (e) {
            // Not ready yet, wait
        }
        await sleep(1000);
    }
    return false;
}

export const config = {
    //
    // ====================
    // Runner Configuration
    // ====================
    runner: 'local',

    //
    // ==================
    // Specify Test Files
    // ==================
    specs: [
        './specs/**/*.spec.js'
    ],

    // Patterns to exclude.
    exclude: [],

    //
    // ============
    // Capabilities (Multiremote)
    // ============
    // Using multiremote to control both WebEngineDriver and AT-SPI driver
    capabilities: {
        // WebEngineDriver for web content inside QtWebEngine
        webEngine: {
            capabilities: {
                browserName: 'chrome',
                'goog:chromeOptions': {
                    // Connect to QtWebEngine's remote debugging port
                    debuggerAddress: `localhost:${REMOTE_DEBUGGING_PORT}`
                }
            }
        },
        // AT-SPI driver for native Qt widgets (dialogs, etc.)
        native: {
            port: AT_SPI_PORT,
            capabilities: {
                // Not ideal but use 'Root' to access entire desktop accessibility tree for now.
                // We'll find coda-qt windows within the tree
                'appium:app': 'Root',
                'appium:timeouts': {
                    implicit: 10000
                }
            }
        }
    },

    //
    // ===================
    // WebDriver Services
    // ===================
    // Use Qt's WebEngineDriver instead of ChromeDriver
    // Note: AT-SPI Flask server is managed manually in hooks
    services: [[
        'chromedriver',
        {
            chromedriverCustomPath: QT_WEBENGINE_DRIVER
        }
    ]],

    //
    // ===================
    // Test Configurations
    // ===================
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    //
    // Test Framework
    // =====
    framework: 'mocha',

    //
    // Test reporter
    // =====
    reporters: ['spec'],

    //
    // Options to be passed to Mocha
    // =====
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000
    },

    //
    // =====
    // Hooks
    // =====
    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: async function (config, capabilities) {
        console.log('Starting AT-SPI Flask server...');

        // Start the AT-SPI Flask server
        atSpiServerProcess = spawn('flask', ['run', '--port', AT_SPI_PORT.toString()], {
            env: {
                ...process.env,
                FLASK_APP: AT_SPI_DRIVER_PATH,
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        atSpiServerProcess.stdout.on('data', (data) => {
            console.log(`[at-spi-server]: ${data.toString().trim()}`);
        });
        atSpiServerProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            // Flask logs to stderr by default
            if (msg) {
                console.log(`[at-spi-server]: ${msg}`);
            }
        });

        atSpiServerProcess.on('exit', (code, signal) => {
            console.log(`AT-SPI server exited with code: ${code}, signal: ${signal}`);
        });

        // Wait for AT-SPI server to be ready
        const atSpiReady = await waitForAtSpiServer(AT_SPI_PORT);
        if (!atSpiReady) {
            if (atSpiServerProcess) atSpiServerProcess.kill('SIGKILL');
            throw new Error(`AT-SPI server not available on port ${AT_SPI_PORT}`);
        }

        console.log('Starting coda-qt with remote debugging and accessibility...');

        // Start the coda-qt application with remote debugging and accessibility enabled
        codaQtProcess = spawn(CODA_QT_BINARY, [], {
            env: {
                ...process.env,
                QTWEBENGINE_REMOTE_DEBUGGING: REMOTE_DEBUGGING_PORT,
                // Enable Qt accessibility for AT-SPI
                QT_ACCESSIBILITY: '1',
                QT_LINUX_ACCESSIBILITY_ALWAYS_ON: '1',
                // Uncomment for headless CI:
                // QT_QPA_PLATFORM: 'offscreen',
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Log output for debugging
        codaQtProcess.stdout.on('data', (data) => {
            console.log(`[coda-qt]: ${data.toString().trim()}`);
        });
        codaQtProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            // Only log actual errors, not Qt warnings
            if (!msg.includes('ERROR:') || msg.includes('DevTools')) {
                console.log(`[coda-qt]: ${msg}`);
            }
        });

        codaQtProcess.on('exit', (code, signal) => {
            console.log(`coda-qt exited with code: ${code}, signal: ${signal}`);
        });

        // Wait for the process to start
        await sleep(2000);

        // Check if process is running
        if (!codaQtProcess.pid || codaQtProcess.killed) {
            if (atSpiServerProcess) atSpiServerProcess.kill('SIGKILL');
            throw new Error('coda-qt failed to start');
        }

        codaQtPid = codaQtProcess.pid;
        console.log(`coda-qt started with PID: ${codaQtPid}`);

        // Export PID globally so tests can access it
        global.codaQtPid = codaQtPid;

        // Wait for remote debugging to be available
        const debuggingAvailable = await waitForRemoteDebugging(REMOTE_DEBUGGING_PORT);

        if (!debuggingAvailable) {
            codaQtProcess.kill('SIGKILL');
            if (atSpiServerProcess) atSpiServerProcess.kill('SIGKILL');
            throw new Error(`Remote debugging not available on port ${REMOTE_DEBUGGING_PORT}`);
        }

        console.log('Both servers ready, tests will now run');
    },

    /**
     * Gets executed after all workers got shut down and the process is about to exit.
     */
    onComplete: function (exitCode, config, capabilities, results) {
        console.log('Stopping coda-qt...');

        if (codaQtProcess && codaQtProcess.pid && !codaQtProcess.killed) {
            console.log('Sending SIGTERM to coda-qt');
            codaQtProcess.kill('SIGTERM');

            // Give it a moment to exit gracefully
            setTimeout(() => {
                if (codaQtProcess && !codaQtProcess.killed) {
                    console.log('Forcing SIGKILL on coda-qt');
                    codaQtProcess.kill('SIGKILL');
                }
            }, 2000);
        }

        console.log('Stopping AT-SPI Flask server...');

        if (atSpiServerProcess && atSpiServerProcess.pid && !atSpiServerProcess.killed) {
            console.log('Sending SIGTERM to AT-SPI server');
            atSpiServerProcess.kill('SIGTERM');

            setTimeout(() => {
                if (atSpiServerProcess && !atSpiServerProcess.killed) {
                    console.log('Forcing SIGKILL on AT-SPI server');
                    atSpiServerProcess.kill('SIGKILL');
                }
            }, 2000);
        }
    }
}
