/* global cy Cypress expect require */

require('cypress-wait-until');
require('cypress-file-upload');

var mobileWizardIdleTime = 1250;

function loadTestDocLocal(fileName, subFolder, noFileCopy) {
	cy.log('Loading test document with a local build - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - noFileCopy: ' + noFileCopy);

	// Get a clean test document
	if (noFileCopy !== true) {
		if (subFolder === undefined) {
			cy.task('copyFile', {
				sourceDir: Cypress.env('DATA_FOLDER'),
				destDir: Cypress.env('WORKDIR'),
				fileName: fileName,
			});
		} else {
			cy.task('copyFile', {
				sourceDir: Cypress.env('DATA_FOLDER') + subFolder + '/',
				destDir: Cypress.env('WORKDIR') + subFolder + '/',
				fileName: fileName,
			});
		}
	}

	doIfOnMobile(function() {
		cy.viewport('iphone-6');
	});

	// Open test document
	var URI = 'http://localhost';
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		URI += '/richproxy/proxy.php?req=';
	} else {
		URI += ':' + Cypress.env('SERVER_PORT');
	}

	if (subFolder === undefined) {
		URI += '/loleaflet/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/loleaflet.html?lang=en-US&file_path=file://' +
			Cypress.env('WORKDIR') + fileName;
	} else {
		URI += '/loleaflet/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/loleaflet.html?lang=en-US&file_path=file://' +
			Cypress.env('WORKDIR') + subFolder + '/' + fileName;
	}

	cy.log('Loading: ' + URI);
	cy.visit(URI, {
		onLoad: function(win) {
			win.onerror = cy.onUncaughtException;
		}});

	cy.log('Loading test document with a local build - end.');
}

function loadTestDocNextcloud(fileName, subFolder, subsequentLoad) {
	cy.log('Loading test document with nextcloud - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	// Ignore exceptions comming from nextlcoud.
	Cypress.on('uncaught:exception', function() {
		return false;
	});

	loadFileToNextCloud(fileName, subFolder, subsequentLoad);

	// Open test document
	cy.get('tr[data-file=\'' + fileName + '\']')
		.click();

	cy.get('iframe#richdocumentsframe')
		.should('be.visible', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	cy.wait(10000);

	cy.get('iframe#richdocumentsframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('richdocumentsIFrameGlobal');

	cy.get('@richdocumentsIFrameGlobal')
		.find('iframe#loleafletframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('loleafletIFrameGlobal');

	var getIframeBody = function(level) {
		if (level === 1) {
			return cy.get('@richdocumentsIFrameGlobal');
		} else if (level === 2) {
			return cy.get('@loleafletIFrameGlobal');
		}
	};

	cy.get('iframe#richdocumentsframe')
		.then(function() {
			Cypress.env('IFRAME_LEVEL', '2');
		});

	Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
		var iFrameLevel = Cypress.env('IFRAME_LEVEL');
		if ((iFrameLevel === '1' || iFrameLevel === '2') && !selector.startsWith('@'))
			if (selector === 'body')
				return getIframeBody(parseInt(iFrameLevel));
			else
				return getIframeBody(parseInt(iFrameLevel)).find(selector, options);
		else
			return originalFn(selector, options);
	});

	Cypress.Commands.overwrite('contains', function(originalFn, selector, content, options) {
		if (Cypress.env('IFRAME_LEVEL') === '2')
			return cy.get('#document-container').parent().wrap(originalFn(selector, content, options));
		else
			return originalFn(selector, content, options);
	});


	cy.log('Loading test document with nextcloud - end.');
}

function hideNCFirstRunWizard() {
	// Hide first run wizard if it's there
	cy.wait(2000); // Wait some time to the wizard become visible, if it's there.
	cy.get('body')
		.then(function(body) {
			if (body.find('#firstrunwizard').length !== 0) {
				cy.get('#firstrunwizard')
					.then(function(wizard) {
						wizard.hide();
					});
			}
		});
}

function loadFileToNextCloud(fileName, subFolder, subsequentLoad) {
	cy.log('Loading test document with nextcloud - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	// Open local nextcloud installation
	cy.visit('http://localhost/nextcloud/index.php/apps/files');

	// Log in with cypress test user / password
	if (subsequentLoad !== true) {
		cy.get('input#user')
			.clear()
			.type('cypress_test');

		cy.get('input#password')
			.clear()
			.type('cypress_test');

		cy.get('input#submit-form')
			.click();

		cy.get('.button.new')
			.should('be.visible');

		// Wait for free space calculation before uploading document
		cy.get('#free_space')
			.should('not.have.attr', 'value', '');

		hideNCFirstRunWizard();

		cy.get('#fileList')
			.then(function(filelist) {
				if (filelist.find('tr').length !== 0) {
					cy.waitUntil(function() {
						cy.get('#fileList tr:nth-of-type(1) .action-menu.permanent')
							.click();

						cy.get('.menuitem.action.action-delete.permanent')
							.click();

						cy.get('#uploadprogressbar')
							.should('not.be.visible');

						return cy.get('#fileList')
							.then(function(filelist) {
								return filelist.find('tr').length === 0;
							});
					}, {timeout: 60000});
				}
			});
	} else {
		// Wait for free space calculation before uploading document
		cy.get('#free_space')
			.should('not.have.attr', 'value', '');

		hideNCFirstRunWizard();
	}

	cy.get('tr[data-file=\'' + fileName + '\']')
		.should('not.exist');

	// Upload test document
	var fileURI = '';
	if (subFolder === undefined) {
		fileURI += fileName;
	} else {
		fileURI += subFolder + '/' + fileName;
	}
	doIfOnDesktop(function() {
		cy.get('input#file_upload_start')
			.attachFile({ filePath: 'desktop/' + fileURI, encoding: 'binary' });
	});
	doIfOnMobile(function() {
		cy.get('input#file_upload_start')
			.attachFile({ filePath: 'mobile/' + fileURI, encoding: 'binary' });
	});

	cy.get('#uploadprogressbar')
		.should('not.be.visible');

	cy.get('tr[data-file=\'' + fileName + '\']')
		.should('be.visible');
}

function waitForInterferingUser() {
	cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
		.should('be.visible');

	// Make sure that the interfering user is loaded, before we start the actual test.
	cy.wait(10000);
}

function loadTestDoc(fileName, subFolder, noFileCopy, subsequentLoad) {
	cy.log('Loading test document - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - noFileCopy: ' + noFileCopy);

	doIfOnMobile(function() {
		cy.viewport('iphone-6');
	});

	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		loadTestDocNextcloud(fileName, subFolder, subsequentLoad);
	} else {
		loadTestDocLocal(fileName, subFolder, noFileCopy);
	}

	// Wait for the document to fully load
	cy.get('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	// Wait until anything is drawn on tile canvas.
	canvasShouldBeFullWhiteOrNot('.leaflet-canvas-container canvas', false);

	// The client is irresponsive for some seconds after load, because of the incoming messages.
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.wait(10000);
	}

	// Wait for the sidebar to open.
	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		doIfOnDesktop(function() {
			cy.get('#sidebar-panel')
				.should('be.visible');

			// Check that the document does not take the whole window width.
			cy.window()
				.then(function(win) {
					cy.get('#document-container')
						.should(function(doc) {
							expect(doc).to.have.lengthOf(1);
							expect(doc[0].getBoundingClientRect().right).to.be.lessThan(win.innerWidth * 0.95);
						});
				});
		});
	}

	if (Cypress.env('INTERFERENCE_TEST') === true) {
		waitForInterferingUser();
	}

	cy.log('Loading test document - end.');
}

// Assert that NO keyboard input is accepted (i.e. keyboard should be HIDDEN).
function assertNoKeyboardInput() {
	cy.get('textarea.clipboard')
		.should('have.attr', 'data-accept-input', 'false');
}

// Assert that keyboard input is accepted (i.e. keyboard should be VISIBLE).
function assertHaveKeyboardInput() {
	cy.get('textarea.clipboard')
		.should('have.attr', 'data-accept-input', 'true');
}

// Assert that we have cursor and focus.
function assertCursorAndFocus() {
	cy.log('Verifying Cursor and Focus.');


	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		// Active element must be the textarea named clipboard.
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	}

	// In edit mode, we should have the blinking cursor.
	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
	cy.get('.leaflet-cursor-container')
		.should('exist');

	assertHaveKeyboardInput();

	cy.log('Cursor and Focus verified.');
}

// Select all text via CTRL+A shortcut.
function selectAllText(assertFocus = true) {
	if (assertFocus)
		assertCursorAndFocus();

	cy.log('Select all text');

	// Trigger select all
	typeIntoDocument('{ctrl}a');

	textSelectionShouldExist();
}

// Clear all text by selecting all and deleting.
function clearAllText() {
	assertCursorAndFocus();

	cy.log('Clear all text');

	// Trigger select all
	typeIntoDocument('{ctrl}a');

	textSelectionShouldExist();

	// Then remove
	typeIntoDocument('{del}');

	textSelectionShouldNotExist();
}

// Check that the clipboard text matches with the specified text.
function expectTextForClipboard(expectedPlainText) {
	doIfInWriter(function() {
		cy.get('#copy-paste-container p')
			.then(function(pItem) {
				if (pItem.children('font').length !== 0) {
					cy.get('#copy-paste-container p font')
						.should('have.text', expectedPlainText);
				} else {
					cy.get('#copy-paste-container p')
						.should('have.text', expectedPlainText);
				}
			});
	});
	doIfInCalc(function() {
		cy.get('#copy-paste-container pre')
			.should('have.text', expectedPlainText);
	});
	doIfInImpress(function() {
		cy.get('#copy-paste-container pre')
			.should('have.text', expectedPlainText);
	});
}

// Check that the clipboard text matches with the
// passed regular expression.
function matchClipboardText(regexp) {
	doIfInWriter(function() {
		cy.contains('#copy-paste-container p font', regexp)
			.should('exist');
	});
	doIfInCalc(function() {
		cy.contains('#copy-paste-container pre', regexp)
			.should('exist');
	});
	doIfInImpress(function() {
		cy.contains('#copy-paste-container pre', regexp)
			.should('exist');
	});
}

function beforeAll(fileName, subFolder, noFileCopy, subsequentLoad) {
	loadTestDoc(fileName, subFolder, noFileCopy, subsequentLoad);
}

function afterAll(fileName, testState) {
	cy.log('Waiting for closing the document - start.');

	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		if (testState === 'failed')
			return;

		if (Cypress.env('IFRAME_LEVEL') === '2') {
			// Close the document
			doIfOnMobile(function() {
				cy.get('#tb_actionbar_item_closemobile')
					.click();

				cy.get('#mobile-edit-button')
					.should('be.visible');

				cy.get('#tb_actionbar_item_closemobile')
					.then(function(item) {
						cy.wrap(item)
							.click();
						Cypress.env('IFRAME_LEVEL', '');
					});
			});
			doIfOnDesktop(function() {
				cy.get('#closebutton')
					.then(function(item) {
						cy.wrap(item)
							.click();
						Cypress.env('IFRAME_LEVEL', '');
					});
			});

			cy.get('#filestable')
				.should('be.visible');

			cy.get('#filestable')
				.should('not.have.class', 'hidden');

			cy.wait(3000);

			// Remove the document
			cy.get('tr[data-file=\'' + fileName + '\'] .action-menu.permanent')
				.click();

			cy.get('.menuitem.action.action-delete.permanent')
				.click();

			cy.get('tr[data-file=\'' + fileName + '\']')
				.should('not.exist');

		}
	} else if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.visit('http://localhost/', {failOnStatusCode: false});

		cy.wait(5000);
	} else {
		// Make sure that the document is closed
		cy.visit('http://admin:admin@localhost:' +
			Cypress.env('SERVER_PORT') +
			'/loleaflet/dist/admin/admin.html');

		// https://github.com/cypress-io/cypress/issues/9207
		if (testState === 'failed') {
			cy.wait(5000);
			return;
		}

		cy.get('#uptime')
			.should('not.have.text', '0');

		// We have all lines of document infos as one long string.
		// We have PID number before the file names, with matching
		// also on the PID number we can make sure to match on the
		// whole file name, not on a suffix of a file name.
		var regex = new RegExp('[0-9]' + fileName);
		cy.get('#docview', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
			.invoke('text')
			.should('not.match', regex);
	}

	cy.log('Waiting for closing the document - end.');
}


function initAliasToNegative(aliasName) {
	cy.log('Initializing alias to a negative value - start.');
	cy.log('Param - aliasName: ' + aliasName);

	cy.get('#copy-paste-container')
		.invoke('offset')
		.its('top')
		.as(aliasName);

	cy.get('@' + aliasName)
		.should('be.lessThan', 0);

	cy.log('Initializing alias to a negative value - end.');
}

function initAliasToEmptyString(aliasName) {
	cy.log('Initializing alias to empty string - start.');
	cy.log('Param - aliasName: ' + aliasName);

	// Do an empty slice to generate empty string
	cy.get('#copy-paste-container')
		.invoke('css', 'display')
		.invoke('slice', '0', '0')
		.as(aliasName);

	cy.get('@' + aliasName)
		.should('be.equal', '');

	cy.log('Initializing alias to empty string - end.');
}

function doIfInCalc(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (doc.hasClass('spreadsheet-doctype')) {
				callback();
			}
		});
}

function doIfNotInCalc(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (!doc.hasClass('spreadsheet-doctype')) {
				callback();
			}
		});
}

function doIfInImpress(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}
function doIfNotInImpress(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (!doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}

function doIfInWriter(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (doc.hasClass('text-doctype')) {
				callback();
			}
		});
}

function doIfNotInWriter(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (!doc.hasClass('text-doctype')) {
				callback();
			}
		});
}

// Types text into elem with a delay in between characters.
// Sometimes cy.type results in random character insertion,
// this avoids that, which is not clear why it happens.
function typeText(selector, text, delayMs=0) {
	for (var i = 0; i < text.length; i++) {
		cy.get(selector)
			.type(text.charAt(i));
		if (delayMs > 0)
			cy.wait(delayMs);
	}
}

function getLOVersion() {
	var versionString = Cypress.env('LO_CORE_VERSION');
	if (versionString.includes('Collabora')) {
		if (versionString.includes('_6.2.')) {
			return 'cp-6-2';
		} else if (versionString.includes('_6.4.')) {
			return 'cp-6-4';
		}
	}
	return 'master';
}

function imageShouldBeFullWhiteOrNot(selector, fullWhite = true) {
	cy.get(selector)
		.should(function(images) {
			var img = images[0];

			// Create an offscreen canvas to check the image's pixels
			var canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
			var context = canvas.getContext('2d');

			// Ignore a small zone on the edges, to ignore border.
			var ignoredPixels = 2;
			var pixelData = context.getImageData(ignoredPixels, ignoredPixels,
				img.width - 2 * ignoredPixels,
				img.height - 2 * ignoredPixels).data;

			var allIsWhite = true;
			for (var i = 0; i < pixelData.length; ++i) {
				allIsWhite = allIsWhite && pixelData[i] == 255;
			}
			if (fullWhite)
				expect(allIsWhite).to.be.true;
			else
				expect(allIsWhite).to.be.false;
		});
}

function canvasShouldBeFullWhiteOrNot(selector, fullWhite = true) {
	cy.get(selector)
		.should(function(canvas) {
			var context = canvas[0].getContext('2d');
			var pixelData = context.getImageData(0, 0, canvas[0].width, canvas[0].height).data;

			var allIsWhite = true;
			for (var i = 0; i < pixelData.length; ++i) {
				allIsWhite = allIsWhite && pixelData[i] == 255;
			}
			if (fullWhite)
				expect(allIsWhite).to.be.true;
			else
				expect(allIsWhite).to.be.false;
		});
}

function waitUntilIdle(selector, content, waitingTime = mobileWizardIdleTime) {
	cy.log('Waiting item to be idle - start.');
	cy.log('Param - selector: ' + selector);
	cy.log('Param - content: ' + content);
	cy.log('Param - waitingTime: ' + waitingTime);

	var item;
	var waitOnce = 250;
	var idleSince = 0;
	if (content) {
		cy.contains(selector, content, { log: false })
			.then(function(itemToIdle) {
				item = itemToIdle;
			});

		cy.waitUntil(function() {
			cy.wait(waitOnce, { log: false });

			return cy.contains(selector, content, { log: false })
				.then(function(itemToIdle) {
					if (Cypress.dom.isDetached(item[0])) {
						cy.log('Item is detached after ' + (idleSince + waitOnce).toString() + ' ms.');
						item = itemToIdle;
						idleSince = 0;
					} else {
						idleSince += waitOnce;
					}
					return idleSince > waitingTime;
				});
		});
	} else {
		cy.get(selector, { log: false })
			.then(function(itemToIdle) {
				item = itemToIdle;
			});

		cy.waitUntil(function() {
			cy.wait(waitOnce, { log: false });

			return cy.get(selector, { log: false })
				.then(function(itemToIdle) {
					if (Cypress.dom.isDetached(item[0])) {
						cy.log('Item is detached after ' + (idleSince + waitOnce).toString() + ' ms.');
						item = itemToIdle;
						idleSince = 0;
					} else {
						idleSince += waitOnce;
					}
					return idleSince > waitingTime;
				});
		});
	}

	cy.log('Waiting item to be idle - end.');
}

// This is a workaround for avoid 'item detached from DOM'
// failures caused by GUI flickering.
// GUI flickering might mean bad design, but
// until it's fixed we can use this method.
// Known GUI flickering:
// * mobile wizard
// IMPORTANT: don't use this if there is no
// flickering. Use simple click() instead. This method
// is much slower.
function clickOnIdle(selector, content, waitingTime = mobileWizardIdleTime) {
	cy.log('Clicking on item when idle - start.');

	waitUntilIdle(selector, content, waitingTime);
	if (content) {
		cy.contains(selector, content)
			.click();
	} else {
		cy.get(selector)
			.click();
	}

	cy.log('Clicking on item when idle - end.');
}

// See comments at clickOnIdle() method.
function inputOnIdle(selector, input, waitingTime = mobileWizardIdleTime) {
	cy.log('Type into an input item when idle - start.');

	waitUntilIdle(selector, undefined, waitingTime);

	cy.get(selector)
		.clear()
		.type(input)
		.type('{enter}');

	cy.log('Type into an input item when idle - end.');
}

function doIfOnMobile(callback) {
	cy.window()
		.then(function(win) {
			if (win.navigator.userAgent === 'cypress-mobile') {
				callback();
			}
		});
}

function doIfOnDesktop(callback) {
	cy.window()
		.then(function(win) {
			if (win.navigator.userAgent === 'cypress') {
				callback();
			}
		});
}

function moveCursor(direction, modifier, checkCursorVis = true) {
	cy.log('Moving text cursor - start.');
	cy.log('Param - direction: ' + direction);
	cy.log('Param - modifier: ' + modifier);
	cy.log('Param - checkCursorVis: ' + checkCursorVis);

	if (direction === 'up' ||
		direction === 'down' ||
		(direction === 'home' && modifier === 'ctrl') ||
		(direction === 'end' && modifier === 'ctrl')) {
		getCursorPos('top', 'origCursorPos');
	} else if (direction === 'left' ||
		direction === 'right' ||
		direction === 'home' ||
		direction === 'end') {
		getCursorPos('left', 'origCursorPos');
	}

	var key = '';
	if (modifier === 'ctrl') {
		key = '{ctrl}';
	} else if (modifier === 'shift') {
		key = '{shift}';
	}

	if (direction === 'up') {
		key += '{uparrow}';
	} else if (direction === 'down') {
		key += '{downarrow}';
	} else if (direction === 'left') {
		key += '{leftarrow}';
	} else if (direction === 'right') {
		key += '{rightarrow}';
	} else if (direction === 'home') {
		key += '{home}';
	} else if (direction === 'end') {
		key += '{end}';
	}

	typeIntoDocument(key);

	if (checkCursorVis === true) {
		cy.get('.blinking-cursor')
			.should('be.visible');
	}

	cy.get('@origCursorPos')
		.then(function(origCursorPos) {
			cy.get('.blinking-cursor')
				.should(function(cursor) {
					if (direction === 'up' ||
						(direction === 'home' && modifier === 'ctrl')) {
						expect(cursor.offset().top).to.be.lessThan(origCursorPos);
					} else if (direction === 'down' ||
						(direction === 'end' && modifier === 'ctrl')) {
						expect(cursor.offset().top).to.be.greaterThan(origCursorPos);
					} else if (direction === 'left' || direction === 'home') {
						expect(cursor.offset().left).to.be.lessThan(origCursorPos);
					} else if (direction === 'right' || direction === 'end') {
						expect(cursor.offset().left).to.be.greaterThan(origCursorPos);
					}
				});
		});

	cy.log('Moving text cursor - end.');
}

function typeIntoDocument(text) {
	cy.log('Typing into document - start.');

	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		cy.document()
			.then(function(doc) {
				if (doc.activeElement.className !== 'clipboard') {
					cy.get('textarea.clipboard')
						.focus();

					cy.document().its('activeElement.className')
						.should('be.eq', 'clipboard');
				}
			});
	}

	cy.get('textarea.clipboard')
		.type(text, {force: true});

	cy.log('Typing into document - end.');
}

function getCursorPos(offsetProperty, aliasName) {
	initAliasToNegative(aliasName);

	cy.get('.leaflet-pane')
		.then(function(pane) {
			// We try document's blinking cursor first if exists.
			if (pane.find('.blinking-cursor').length !== 0) {
				cy.get('.leaflet-pane .blinking-cursor')
					.invoke('offset')
					.its(offsetProperty)
					.as(aliasName);
			} else {
				cy.get('.blinking-cursor')
					.invoke('offset')
					.its(offsetProperty)
					.as(aliasName);
			}
		});

	cy.get('@' + aliasName)
		.should('be.greaterThan', 0);
}

function textSelectionShouldExist() {
	cy.log('Make sure text selection exists - start.');

	cy.get('.leaflet-selection-marker-start')
		.should('exist');

	cy.get('.leaflet-selection-marker-end')
		.should('exist');

	// One of the marker should be visible at least (if not both).
	cy.get('.leaflet-selection-marker-start, .leaflet-selection-marker-end')
		.should('be.visible');

	cy.log('Make sure text selection exists - end.');
}

function textSelectionShouldNotExist() {
	cy.log('Make sure there is no text selection - start.');

	cy.get('.leaflet-selection-marker-start')
		.should('not.exist');

	cy.get('.leaflet-selection-marker-end')
		.should('not.exist');

	cy.log('Make sure there is no text selection - end.');
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.assertCursorAndFocus = assertCursorAndFocus;
module.exports.assertNoKeyboardInput = assertNoKeyboardInput;
module.exports.assertHaveKeyboardInput = assertHaveKeyboardInput;
module.exports.selectAllText = selectAllText;
module.exports.clearAllText = clearAllText;
module.exports.expectTextForClipboard = expectTextForClipboard;
module.exports.matchClipboardText = matchClipboardText;
module.exports.afterAll = afterAll;
module.exports.initAliasToNegative = initAliasToNegative;
module.exports.initAliasToEmptyString = initAliasToEmptyString;
module.exports.doIfInCalc = doIfInCalc;
module.exports.doIfInImpress = doIfInImpress;
module.exports.doIfInWriter = doIfInWriter;
module.exports.doIfNotInCalc = doIfNotInCalc;
module.exports.doIfNotInImpress = doIfNotInImpress;
module.exports.doIfNotInWriter = doIfNotInWriter;
module.exports.beforeAll = beforeAll;
module.exports.typeText = typeText;
module.exports.getLOVersion = getLOVersion;
module.exports.imageShouldBeFullWhiteOrNot = imageShouldBeFullWhiteOrNot;
module.exports.canvasShouldBeFullWhiteOrNot = canvasShouldBeFullWhiteOrNot;
module.exports.clickOnIdle = clickOnIdle;
module.exports.inputOnIdle = inputOnIdle;
module.exports.waitUntilIdle = waitUntilIdle;
module.exports.doIfOnMobile = doIfOnMobile;
module.exports.doIfOnDesktop = doIfOnDesktop;
module.exports.moveCursor = moveCursor;
module.exports.typeIntoDocument = typeIntoDocument;
module.exports.loadFileToNextCloud = loadFileToNextCloud;
module.exports.getCursorPos = getCursorPos;
module.exports.textSelectionShouldExist = textSelectionShouldExist;
module.exports.textSelectionShouldNotExist = textSelectionShouldNotExist;
