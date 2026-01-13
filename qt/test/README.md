# coda-qt WebdriverIO Tests

This directory contains automated tests for the coda-qt application using WebdriverIO.

coda-qt uses QtWebEngine, which is based on Chromium. These tests use WebdriverIO to connect to coda-qt's remote debugging interface, allowing us to test the application just like we would test a web application.

## Dual-Driver Architecture

The test framework uses a **multiremote** setup with two drivers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Spec (Mocha)                        │
│                                                             │
│   browser.webEngine          browser.native                 │
│   (WebEngineDriver)          (AT-SPI via Flask)             │
│         │                           │                       │
│         ▼                           ▼                       │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                     coda-qt                         │  │
│   │  ┌───────────────────────────────────────────────┐ │  │
│   │  │      QtWebEngine (BackstageView, Editor)      │◄┼──webEngine
│   │  └───────────────────────────────────────────────┘ │  │
│   │  ┌───────────────────────────────────────────────┐ │  │
│   │  │      Native Qt (QMessageBox, QFileDialog)     │◄┼──native
│   │  └───────────────────────────────────────────────┘ │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **`browser.webEngine`**: Controls web content inside QtWebEngine via Chrome DevTools Protocol
- **`browser.native`**: Controls native Qt widgets (dialogs, alerts) via AT-SPI accessibility interface

## Prerequisites

- Node.js (version 18 or higher)
- npm (comes with Node.js)
- A built `coda-qt` binary in the parent directory
- Python 3 with Flask (`pip install flask`)
- AT-SPI driver: `selenium-webdriver-at-spi.py` (for native Qt widget automation)
- Python dependencies: `pyatspi`, `lxml`, `numpy` (for AT-SPI driver)

### Installing AT-SPI Driver Dependencies

```bash
# Install Flask for the AT-SPI WebDriver server
pip install flask

# Install AT-SPI Python bindings (usually available via system package manager)
# On Fedora:
sudo dnf install python3-pyatspi python3-lxml python3-numpy

# On Ubuntu/Debian:
sudo apt install python3-pyatspi python3-lxml python3-numpy
```

## How It Works

The tests work by:
1. Starting the AT-SPI Flask server for native widget automation
2. Starting coda-qt with:
   - `QTWEBENGINE_REMOTE_DEBUGGING` for web content access
   - `QT_ACCESSIBILITY=1` for AT-SPI accessibility support
3. Using Qt's WebEngineDriver (found via `qmake -query QT_INSTALL_LIBEXECS`)
4. Connecting WebdriverIO multiremote to both drivers
5. Running tests that can interact with both web and native content
6. Terminating both servers

## Setup

Install the test dependencies:

```bash
cd qt/test
npm install
```

Or from the qt directory:

```bash
make test-install-deps
```

## Running Tests

### From the test directory

```bash
npm test
```

### From the qt directory using make

```bash
make test
```

This will:
1. Build the coda-qt binary if needed
2. Install test dependencies
3. Start AT-SPI Flask server
4. Start coda-qt with remote debugging and accessibility enabled
5. Run all tests in the `specs/` directory

### From the project root

If ENABLE_QTAPP is configured, you can run:

```bash
make check
```

## Environment Variables

- `CODA_QT_BINARY`: Path to the coda-qt binary (defaults to `../coda-qt`)
- `REMOTE_DEBUGGING_PORT`: Port for QtWebEngine remote debugging (defaults to 9222)
- `AT_SPI_PORT`: Port for AT-SPI Flask server (defaults to 4723)
- `AT_SPI_DRIVER_PATH`: Path to `selenium-webdriver-at-spi.py` (defaults to `/home/sarper/collabora/selenium-webdriver-at-spi/selenium-webdriver-at-spi.py`)

Example:
```bash
CODA_QT_BINARY=/path/to/coda-qt REMOTE_DEBUGGING_PORT=9223 npm test
```

## Test Structure

- `wdio.conf.js` - WebdriverIO configuration file with multiremote setup
- `specs/` - Test specification files
  - `basic.spec.js` - Basic application tests (web content only)
  - `document-lifecycle.spec.js` - E2E test demonstrating dual-driver usage:
    - Creates a new document via BackstageView
    - Types text in the document
    - Closes with Ctrl+W
    - Handles native "Unsaved Changes" dialog via AT-SPI

## Writing New Tests

### Web-only tests

For tests that only interact with web content:

```javascript
describe('My web test', () => {
    it('should interact with web content', async function() {
        // Use browser.webEngine for web content
        await browser.webEngine.execute(() => {
            document.querySelector('.my-element').click();
        });
    });
});
```

### Tests with native Qt dialogs

For tests that need to interact with native Qt widgets:

```javascript
describe('My E2E test', () => {
    it('should handle native dialogs', async function() {
        // Web content interaction
        await browser.webEngine.execute(() => {
            // Trigger action that opens a native dialog
        });

        // Native dialog interaction via AT-SPI
        // Find element by accessible name
        const button = await browser.native.$('name=OK');
        await button.click();
    });
});
```

### AT-SPI Element Selectors

The AT-SPI driver supports these selector strategies:

- `name=ButtonText` - Find by accessible name
- `description=Some description` - Find by accessible description
- `accessibility id=someId` - Find by accessibility ID
- XPath expressions for complex queries

## Troubleshooting

### Tests fail to start coda-qt

Make sure the binary is built:
```bash
cd qt
make
```

### AT-SPI server fails to start

1. Ensure Flask is installed: `pip install flask`
2. Check the AT-SPI driver path in environment variables
3. Verify Python dependencies are installed

### Native elements not found

1. Ensure `QT_ACCESSIBILITY=1` is set (done automatically by test framework)
2. Check that the element's accessible name matches your selector
3. Use the AT-SPI driver's `/session/{id}/sourceRaw` endpoint to inspect the accessibility tree

### Display issues

The tests can run with `QT_QPA_PLATFORM=offscreen` for CI environments.
Edit `wdio.conf.js` to uncomment the offscreen platform setting.

### Dependencies not installed

Run:
```bash
make test-install-deps
```

## CI Integration

These tests are integrated into the build system and will run when:
- Running `make check` in the qt directory
- The build system's test suite is executed

For CI environments, ensure:
1. AT-SPI daemon is running (usually automatic on Linux desktops)
2. A display server or virtual framebuffer is available
3. All Python dependencies for AT-SPI driver are installed
