/* global cy Cypress expect */

var mobileWizardIdleTime = 1250;
// Loading the test document directly in Collabora Online.
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// noFileCopy - whether to create a copy of the test file before run the test.
//				By default, we create a copy to have a clear test document but
//				but when we test saving functionality we need to open same docuement
// isMultiUser - whether the test is for multiuser
// noRename - whether or not to give the file a unique name, if noFileCopy is false.
function loadTestDocNoIntegration(fileName, subFolder, noFileCopy, isMultiUser, noRename) {
	cy.log('Loading test document with a local build - start.');

	var newFileName = fileName;
	if (noRename !== true && noFileCopy !== true) {
		var randomName = (Math.random() + 1).toString(36).substring(7);
		newFileName = randomName + '_' + fileName;
	}

	cy.log('Param - fileName: ' + fileName + ' -> ' + newFileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - noFileCopy: ' + noFileCopy);
	cy.log('Param - isMultiUser: ' + isMultiUser);

	// Get a clean test document, by creating a copy of it in the workdir
	// We overwrite this copy everytime we run a new test case.
	if (noFileCopy !== true) {
		if (subFolder === undefined) {
			cy.task('copyFile', {
				sourceDir: Cypress.env('DATA_FOLDER'),
				destDir: Cypress.env('DATA_WORKDIR'),
				fileName: fileName,
				destFileName: newFileName,
			});
		} else {
			cy.task('copyFile', {
				sourceDir: Cypress.env('DATA_FOLDER') + subFolder + '/',
				destDir: Cypress.env('DATA_WORKDIR') + subFolder + '/',
				fileName: fileName,
				destFileName: newFileName,
			});
		}
	}

	// We generate the URI of the document.
	var URI = 'http://localhost';
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		URI += '/richproxy/proxy.php?req=';
	} else {
		URI += ':' + Cypress.env('SERVER_PORT');
	}

	if (subFolder === undefined) {
		URI += '/browser/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/debug.html?lang=en-US&file_path=' +
			Cypress.env('DATA_WORKDIR') + newFileName;
	} else {
		URI += '/browser/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/debug.html?lang=en-US&file_path=' +
			Cypress.env('DATA_WORKDIR') + subFolder + '/' + newFileName;
	}

	if (isMultiUser) {
		cy.viewport(2000,660);
		URI = URI.replace('debug.html', 'cypress-multiuser.html');
	}

	cy.visit(URI, {
		onLoad: function(win) {
			win.onerror = cy.onUncaughtException;
		}});

	if (!isMultiUser) {
		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			if (selector === '@coolIFrameGlobal' || selector == 'body')
				return cy.iframe('#coolframe');
			if (!selector.startsWith('@') && !selector.includes('#coolframe')) {
				return cy.iframe('#coolframe').find(selector, options);
			}
			return originalFn(selector, options);
		});

		Cypress.Commands.overwrite('contains', function(originalFn, selector, content, options) {
			return cy.get('#document-container').parent().wrap(originalFn(selector, content, options));
		});
	}
	cy.log('Loading test document with a local build - end.');
	return newFileName;
}

// Loading the test document inside a Nextcloud integration.
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// subsequentLoad - whether we load a test document for the first time in the
//                  test case or not. It's important because we need to sign in
//                  with the username + password only for the first time.
function loadTestDocNextcloud(fileName, subFolder, subsequentLoad) {
	cy.log('Loading test document with nextcloud - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	// Ignore exceptions coming from nextcloud.
	Cypress.on('uncaught:exception', function() {
		return false;
	});

	upLoadFileToNextCloud(fileName, subFolder, subsequentLoad);

	// Open test document
	cy.get('tr[data-file=\'' + fileName + '\']')
		.click();

	cy.get('iframe#richdocumentsframe')
		.should('be.visible', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	cy.wait(10000);

	// We create global aliases for iframes, so it's faster to reach them.
	cy.get('iframe#richdocumentsframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('richdocumentsIFrameGlobal');

	cy.get('@richdocumentsIFrameGlobal')
		.find('iframe#coolframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('loleafletIFrameGlobal');

	// Let's overwrite get() and contains() methods, because they don't work
	// inside iframes. We need to find the iframes first and find the related
	// DOM elements under them.
	// https://www.cypress.io/blog/2020/02/12/working-with-iframes-in-cypress/
	var getIframeBody = function(level) {
		if (level === 1) {
			return cy.get('@richdocumentsIFrameGlobal');
		} else if (level === 2) {
			return cy.get('@loleafletIFrameGlobal');
		}
	};

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

	// The IFRAME_LEVEL environment variable will indicate
	// in which iframe we have.
	cy.get('iframe#richdocumentsframe')
		.then(function() {
			Cypress.env('IFRAME_LEVEL', '2');
		});

	cy.log('Loading test document with nextcloud - end.');
}

// Hide NC's first run wizard, which is opened by the first run of
// nextcloud. When we run cypress in headless mode, NC don't detect
// that we already used it and so it always opens this wizard.
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

// Upload a test document into Nexcloud and open it.
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// subsequentLoad - whether we load a test document for the first time in the
//                  test case or not. It's important because we need to sign in
//                  with the username + password only for the first time.
function upLoadFileToNextCloud(fileName, subFolder, subsequentLoad) {
	cy.log('Uploading test document into nextcloud - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	// Open local nextcloud installation
	cy.visit('http://localhost/nextcloud/index.php/apps/files');

	// Log in with cypress test user / password (if this is the first time)
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

		// Remove all existing file, so we make sure the test document is removed
		// and then we can upload a new one.
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

	cy.log('Uploading test document into nextcloud - end.');
}

// Used for interference testing. We wait until the interfering user loads
// its instance of the document and starts its interfering actions.
// So we can be sure the interference actions are made during the test
// user does the actual test steps.
function waitForInterferingUser() {
	cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
		.should('be.visible');

	cy.wait(10000);
}

// Loading the test document inside Collabora Online (directly or via some integration).
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// noFileCopy - whether to create a copy of the test file before run the test.
//				By default, we create a copy to have a clear test document but
//				but when we test saving functionality we need to open same docueme
// isMultiUser - whether test is a multiuser test
// subsequentLoad - whether we load a test document for the first time in the
//                  test case or not. It's important for nextcloud because we need to sign in
//                  with the username + password only for the first time.
// noRename - whether or not to give the file a unique name, if noFileCopy is false.
function loadTestDoc(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename) {
	cy.log('Loading test document - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - noFileCopy: ' + noFileCopy);
	cy.log('Param - isMultiUser: ' + isMultiUser);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);
	cy.log('Param - hasInteractionBeforeLoad: ' + hasInteractionBeforeLoad);

	// We set the mobile screen size here. We could use any other phone type here.
	doIfOnMobile(function() {
		cy.viewport('iphone-6');
	});

	var destFileName = fileName;
	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		loadTestDocNextcloud(fileName, subFolder, subsequentLoad);
	} else {
		destFileName = loadTestDocNoIntegration(fileName, subFolder, noFileCopy, isMultiUser, noRename);
	}

	// When dialog appears before document load (eg. macro warning, csv import options)
	if (hasInteractionBeforeLoad === true)
		return;

	if (!isMultiUser) {
		checkIfDocIsLoaded();
	} else {
		checkIfBothDocIsLoaded();
	}

	return destFileName;
}

function checkIfBothDocIsLoaded() {

	//assert both the frames are loaded
	cy.frameLoaded('#iframe1');
	cy.frameLoaded('#iframe2');

	checkIfDocIsLoaded('#iframe1');
	checkIfDocIsLoaded('#iframe2');
}

function checkIfDocIsLoaded(frameId) {
	// Wait for the document to fully load
	cy.customGet('.leaflet-canvas-container canvas', frameId, {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	// Wait until anything is drawn on tile canvas.
	canvasShouldNotBeFullWhite('.leaflet-canvas-container canvas',frameId);

	// With php-proxy the client is irresponsive for some seconds after load, because of the incoming messages.
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.wait(10000);
	}

	// Wait for the sidebar to open.
	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		doIfOnDesktop(function() {
			if (Cypress.env('pdf-view') !== true)
				cy.customGet('#sidebar-panel', frameId).should('be.visible');

			// Check that the document does not take the whole window width.
			cy.window()
				.then(function(win) {
					cy.customGet('#document-container', frameId)
						.should(function(doc) {
							expect(doc).to.have.lengthOf(1);
							if (Cypress.env('pdf-view') !== true)
								expect(doc[0].getBoundingClientRect().right).to.be.lessThan(win.innerWidth * 0.95);
						});
				});

			// Check also that the inputbar is drawn in Calc.
			doIfInCalc(function() {
				cy.customGet('#sc_input_window.formulabar', frameId)
					.should('exist');
			}, frameId);
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
function assertHaveKeyboardInput(frameId) {
	cy.customGet('textarea.clipboard', frameId)
		.should('have.attr', 'data-accept-input', 'true');
}

// Assert that we have cursor and focus on the text area of the document.
function assertCursorAndFocus(frameId) {
	cy.log('Verifying Cursor and Focus - start');

	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		// Active element must be the textarea named clipboard.
		assertFocus('className', 'clipboard');
	}

	// In edit mode, we should have the blinking cursor.
	cy.customGet('.leaflet-cursor.blinking-cursor', frameId)
		.should('exist');
	cy.customGet('.leaflet-cursor-container', frameId)
		.should('exist');

	assertHaveKeyboardInput(frameId);

	cy.log('Verifying Cursor and Focus - end');
}

// Select all text via CTRL+A shortcut.
function selectAllText(frameId) {
	cy.log('Select all text - start');

	typeIntoDocument('{ctrl}a',frameId);

	textSelectionShouldExist(frameId);

	cy.log('Select all text - end');
}

// Clear all text by selecting all and deleting.
function clearAllText(frameId) {
	cy.log('Clear all text - start');

	//assertCursorAndFocus(frameId);

	// Trigger select all
	selectAllText(frameId);

	// Then remove
	typeIntoDocument('{backspace}',frameId);

	textSelectionShouldNotExist(frameId);

	cy.log('Clear all text - end');
}

// Check that the clipboard text matches with the specified text.
// Parameters:
// expectedPlainText - a string, the clipboard container should have.
function expectTextForClipboard(expectedPlainText, frameId) {
	cy.log('Text:' + expectedPlainText ,  'FrameID:' + frameId);
	doIfInWriter(function() {
		// for backward compatibility allow '/nTEXT' and 'TEXT'
		const expectedRegex = RegExp('/^(\n' + expectedPlainText + ')|(' + expectedPlainText + ')$/');
		cy.customGet('#copy-paste-container p', frameId)
			.then(function(pItem) {
				if (pItem.children('font').length !== 0) {
					cy.customGet('#copy-paste-container p font', frameId)
						.invoke('text')
						.then(function(value) {
							return expectedRegex.test(value);
						});
				} else {
					cy.customGet('#copy-paste-container p', frameId)
						.invoke('text')
						.then(function(value) {
							return expectedRegex.test(value);
						});
				}
			});
	}, frameId);

	doIfInCalc(function() {
		cy.customGet('#copy-paste-container pre', frameId)
			.should('have.text', expectedPlainText);
	}, frameId);

	doIfInImpress(function() {
		cy.customGet('#copy-paste-container pre', frameId)
			.should('have.text', expectedPlainText);
	}, frameId);
}

// Check that the clipboard text matches with the
// passed regular expression.
// Parameters:
// regexp - a regular expression to match the content with.
//          https://docs.cypress.io/api/commands/contains.html#Regular-Expression
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


// This is called during a test to reload the same document after
// some modification. The purpose is typically to verify that
// said changes were preserved in the document upon closing.
function reload(fileName, subFolder, noFileCopy, subsequentLoad) {
	cy.log('Reloading document: ' + subFolder + '/' + fileName);
	cy.log('Reloading document - noFileCopy: ' + noFileCopy);
	cy.log('Reloading document - subsequentLoad: ' + subsequentLoad);
	closeDocument(fileName, '');
	var noRename = true;
	return loadTestDoc(fileName, subFolder, noFileCopy, subsequentLoad, noRename);
}

// noRename - whether or not to give the file a unique name, if noFileCopy is false.
function beforeAll(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename) {
	return loadTestDoc(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename);
}

function afterAll(fileName, testState) {
	closeDocument(fileName, testState);
}

// This method is intended to call after each test case.
// We use this method to close the document, before step
// on to the next test case.
// Parameters:
// fileName - test document name (we can check it on the admin console).
// testState - whether the test passed or failed before this method was called.
function closeDocument(fileName, testState) {
	cy.log('Waiting for closing the document - start.');

	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		if (testState === 'failed') {
			Cypress.env('IFRAME_LEVEL', '');
			return;
		}

		if (Cypress.env('IFRAME_LEVEL') === '2') {
			// Close the document, with the close button.
			doIfOnMobile(function() {
				cy.get('#toolbar-mobile-back')
					.click();

				cy.get('#mobile-edit-button')
					.should('be.visible');

				cy.get('#toolbar-mobile-back')
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
	// For php-proxy admin console does not work, so we just open
	// localhost and wait some time for the test document to be closed.
	} else if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.visit('http://localhost/', {failOnStatusCode: false});

		cy.wait(5000);
	} else {
		if (Cypress.env('INTERFERENCE_TEST') === true) {
			typeIntoDocument('{ctrl}s');

			cy.wait(2000);
		}

		Cypress.Commands.overwrite('get', function(originalFn, selector, options) {
			return originalFn(selector, options);
		});
		// Make sure that the document is closed
		cy.visit('http://admin:admin@localhost:' +
			Cypress.env('SERVER_PORT') +
			'/browser/dist/admin/admin.html');

		// https://github.com/cypress-io/cypress/issues/9207
		if (testState === 'failed') {
			cy.wait(5000);
			return;
		}

		cy.get('#uptime').its('text')
			.should('not.eq', '0');

		// We have all lines of document infos as one long string.
		// We have PID number before the file names, with matching
		// also on the PID number we can make sure to match on the
		// whole file name, not on a suffix of a file name.
		var rexname = '[0-9]' + fileName;
		var regex = new RegExp(rexname);
		cy.log('closeDocument - waiting not.match: ' + rexname);
		// Saving may take much longer now to ensure no unsaved data exists.
		// This is not an issue on a fast machine, but on the CI we do timeout often.
		const options = {timeout : Cypress.config('defaultCommandTimeout') * 2.0};
		cy.get('#docview', options)
			.invoke(options, 'text')
			.should('not.match', regex);
	}

	cy.log('Waiting for closing the document - end.');
}

// Initialize an alias to a negative number value. It can be useful
// when we use an alias as a variable and later we intend to set it
// to a non-negative value.
// Parameters:
// aliasName - a string, expected to be used as alias.
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

// Run a code snippet if we are inside Calc.
function doIfInCalc(callback, frameId) {
	cy.customGet('#document-container',frameId)
		.then(function(doc) {
			if (doc.hasClass('spreadsheet-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are *NOT* inside Calc.
function doIfNotInCalc(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (!doc.hasClass('spreadsheet-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are inside Impress.
function doIfInImpress(callback, frameId) {
	cy.customGet('#document-container', frameId)
		.then(function(doc) {
			if (doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are *NOT* inside Impress.
function doIfNotInImpress(callback) {
	cy.get('#document-container')
		.then(function(doc) {
			if (!doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are inside Writer.
function doIfInWriter(callback, frameId) {
	cy.customGet('#document-container', frameId)
		.then(function(doc) {
			if (doc.hasClass('text-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are *NOT* inside Writer.
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
// Parameters:
// selector - a CSS selector to query a DOM element to type in.
// text - a text, what we'll type char-by-char.
// delayMs - delay in ms between the characters.
function typeText(selector, text, delayMs=0, frameId) {
	for (var i = 0; i < text.length; i++) {
		cy.customGet(selector, frameId)
			.type(text.charAt(i));
		if (delayMs > 0)
			cy.wait(delayMs);
	}
}



// Check whether an img DOM element has only white colored pixels or not.
// Parameters:
// selector - a CSS selector to query the img DOM element.
// fullWhite - this specifies what we expect here, that the image is full white
//             or on the contrary.
function imageShouldNotBeFullWhiteOrNot(selector, fullWhite = true) {
	cy.log('Check whether an image is full white or not - start.');
	cy.log('Param - selector: ' + selector);
	cy.log('Param - fullWhite: ' + fullWhite);

	expect(selector).to.have.string('img');

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

	cy.log('Check whether an image is full white or not - end.');
}

// Check whether an img DOM element consist of only white pixels.
function imageShouldBeFullWhite(selector) {
	imageShouldNotBeFullWhiteOrNot(selector, true);
}

// Check whether an img DOM element has any non-white pixels.
function imageShouldNotBeFullWhite(selector) {
	imageShouldNotBeFullWhiteOrNot(selector, false);
}

// Check whether a canvas DOM element has only white colored pixels or not.
// Parameters:
// selector - a CSS selector to query the canvas DOM element.
// fullWhite - this specifies what we expect here, that the canvas is full white
//             or on the contrary.
// frameId - this specifies which frame to look into, in multiuser tests
function canvasShouldBeFullWhiteOrNot(selector, fullWhite = true,frameId) {
	cy.log('Check whether a canvas is full white or not - start.');
	cy.log('Param - selector: ' + selector);
	cy.log('Param - fullWhite: ' + fullWhite);

	expect(selector).to.have.string('canvas');

	cy.customGet(selector,frameId)
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

	cy.log('Check whether a canvas is full white or not - end.');
}

// Check whether a canvas DOM element consist of only white pixels.
function canvasShouldBeFullWhite(selector) {
	canvasShouldBeFullWhiteOrNot(selector, true);
}

// Check whether a canvas DOM element has any non-white pixels.
function canvasShouldNotBeFullWhite(selector,frameId) {
	canvasShouldBeFullWhiteOrNot(selector, false, frameId);
}

// Waits until a DOM element becomes idle (does not change for a given time).
// It's useful to handle flickering on the UI, which might make cypress
// tests unstable. If the UI flickers, we can use this method to wait
// until it settles and the move on with the test.
// Parameters:
// selector - a CSS selector to query a DOM element to wait on to be idle.
// content - a string, a content selector used by cy.contains() to select the correct DOM element.
// waitingTime - how much time to wait before we say the item is idle.
function waitUntilIdle(selector, content, waitingTime = mobileWizardIdleTime) {
	cy.log('Waiting item to be idle - start.');
	cy.log('Param - selector: ' + selector);
	cy.log('Param - content: ' + content);
	cy.log('Param - waitingTime: ' + waitingTime);

	var item;
	// We check every 'waitOnce' time whether we are idle.
	var waitOnce = 250;
	// 'idleSince' variable counts the idle time so far.
	var idleSince = 0;
	if (content) {
		// We get the initial DOM item first.
		cy.contains(selector, content, { log: false })
			.then(function(itemToIdle) {
				item = itemToIdle;
			});

		cy.waitUntil(function() {
			cy.wait(waitOnce, { log: false });

			return cy.contains(selector, content, { log: false })
				.then(function(itemToIdle) {
					if (Cypress.dom.isDetached(item[0])) {
						cy.log('Item was detached after ' + (idleSince + waitOnce).toString() + ' ms.');
						item = itemToIdle;
						idleSince = 0;
					} else {
						idleSince += waitOnce;
					}
					return idleSince > waitingTime;
				});
		});
	} else {
		// We get the initial DOM item first.
		cy.get(selector, { log: false })
			.then(function(itemToIdle) {
				item = itemToIdle;
			});

		cy.waitUntil(function() {
			cy.wait(waitOnce, { log: false });

			return cy.get(selector, { log: false })
				.then(function(itemToIdle) {
					if (Cypress.dom.isDetached(item[0])) {
						cy.log('Item was detached after ' + (idleSince + waitOnce).toString() + ' ms.');
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

// Waits for the DOM element to be idle and clicks on it afterward.
// This is a workaround to avoid 'item detached from DOM'
// failures caused by GUI flickering.
// GUI flickering might mean bad design, but
// until it's fixed we can use this method.
// Known GUI flickering:
// * mobile wizard
// IMPORTANT: don't use this if there is no flickering.
// Use simple click() instead. This method is much slower.
// Parameters:
// selector - a CSS selector to query a DOM element to wait on to be idle.
// content - a string, a content selector used by cy.contains() to select the correct DOM element.
// waitingTime - how much time to wait before we say the item is idle.
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

// Waits for the DOM element to be idle and types into it afterward.
// See also the comments at clickOnIdle() method.
// Parameters:
// selector - a CSS selector to query a DOM element to wait on to be idle.
// input - text to be typed into the selected DOM element.
// waitingTime - how much time to wait before we say the item is idle.
function inputOnIdle(selector, input, waitingTime = mobileWizardIdleTime) {
	cy.log('Type into an input item when idle - start.');

	waitUntilIdle(selector, undefined, waitingTime);

	cy.get(selector)
		.clear()
		.type(input)
		.type('{enter}');

	cy.log('Type into an input item when idle - end.');
}

// Run a code snippet if we are in a mobile test.
function doIfOnMobile(callback) {
	cy.window()
		.then(function(win) {
			if (win.navigator.userAgent === 'cypress-mobile') {
				callback();
			}
		});
}

// Run a code snippet if we are in a desktop test.
function doIfOnDesktop(callback) {
	cy.window()
		.then(function(win) {
			if (win.navigator.userAgent === 'cypress') {
				callback();
			}
		});
}

// Move the cursor in the given direction and wait until it moves.
// Parameters:
// direction - the direction the cursor should be moved.
//			   possible valude: up, down, left, right, home, end
// modifier - a modifier to the cursor movement keys (e.g. 'shift' or 'ctrl').
// checkCursorVis - whether to check the cursor visibility after movement.
// cursorSelector - selector for the cursor DOM element (document cursor is the default).
function moveCursor(direction, modifier,
	checkCursorVis = true,
	cursorSelector = '.cursor-overlay .blinking-cursor', frameId) {
	cy.log('Moving text cursor - start.');
	cy.log('Param - direction: ' + direction);
	cy.log('Param - modifier: ' + modifier);
	cy.log('Param - checkCursorVis: ' + checkCursorVis);
	cy.log('Param - cursorSelector: ' + cursorSelector);

	// Get the original cursor position.
	var origCursorPos = 0;
	cy.customGet(cursorSelector, frameId)
		.should(function(cursor) {
			if (direction === 'up' ||
				direction === 'down' ||
				(direction === 'home' && modifier === 'ctrl') ||
				(direction === 'end' && modifier === 'ctrl')) {
				origCursorPos = cursor.offset().top;
			} else if (direction === 'left' ||
				direction === 'right' ||
				direction === 'home' ||
				direction === 'end') {
				origCursorPos = cursor.offset().left;
			}
			expect(origCursorPos).to.not.equal(0);
		});

	// Move the cursor using keyboard input.
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

	typeIntoDocument(key, frameId);

	// Make sure the cursor position was changed.
	cy.customGet(cursorSelector, frameId)
		.should(function(cursor) {
			if (direction === 'up' ||
				direction === 'down' ||
				(direction === 'home' && modifier === 'ctrl') ||
				(direction === 'end' && modifier === 'ctrl')) {
				expect(cursor.offset().top).to.not.equal(origCursorPos);
			} else if (direction === 'left' ||
					direction === 'right' ||
					direction === 'end' ||
					direction === 'home') {
				expect(cursor.offset().left).to.not.equal(origCursorPos);
			}
		});

	// Cursor should be visible after move, because the view always follows it.
	if (checkCursorVis === true) {
		cy.customGet(cursorSelector, frameId)
			.should('be.visible');
	}

	cy.log('Moving text cursor - end.');
}

// Type something into the document. It can be some text or special characters too.
function typeIntoDocument(text, frameId) {
	cy.log('Typing into document - start.');

	cy.customGet('textarea.clipboard', frameId)
		.type(text, {force: true});

	cy.log('Typing into document - end.');
}

// Get cursor's current position.
// Parameters:
// offsetProperty - which offset position we need (e.g. 'left' or 'top').
// aliasName - we create an alias with the queried position.
// cursorSelector - selector to find the correct cursor element in the DOM.
function getCursorPos(offsetProperty, aliasName, cursorSelector = '.cursor-overlay .blinking-cursor') {
	initAliasToNegative(aliasName);

	cy.get(cursorSelector)
		.invoke('offset')
		.its(offsetProperty)
		.as(aliasName);

	cy.get('@' + aliasName)
		.should('be.greaterThan', 0);
}

// We make sure we have a text selection..
function textSelectionShouldExist(frameId) {
	cy.log('Make sure text selection exists - start.');

	cy.customGet('.leaflet-selection-marker-start', frameId)
		.should('exist');

	cy.customGet('.leaflet-selection-marker-end', frameId)
		.should('exist');

	// One of the marker should be visible at least (if not both).
	cy.customGet('.leaflet-selection-marker-start, .leaflet-selection-marker-end', frameId)
		.should('be.visible');

	cy.log('Make sure text selection exists - end.');
}

// We make sure we don't have a text selection..
function textSelectionShouldNotExist(frameId) {
	cy.log('Make sure there is no text selection - start.');

	cy.customGet('.leaflet-selection-marker-start', frameId)
		.should('not.exist');

	cy.customGet('.leaflet-selection-marker-end', frameId)
		.should('not.exist');

	cy.log('Make sure there is no text selection - end.');
}

// Used to represent the bounds of overlays like cell-cursor, document selections etc.
class Bounds {
	constructor(top, left, width, height) {
		this.set(top, left, width, height);
	}

	set(top, left, width, height) {
		/** @type {number} */
		this.top = top;
		/** @type {number} */
		this.left = left;
		/** @type {number} */
		this.width = width;
		/** @type {number} */
		this.height = height;
	}

	isValid() {
		return (this.top !== undefined
			&& this.left !== undefined
			&& this.width !== undefined
			&& this.height !== undefined);
	}

	/**
	 * Checks whether "other" bounds lies within self bounds.
	 * @param {Bounds} other
	 */
	contains(other) {
		return (other.top >= this.top && other.bottom <= this.bottom &&
			other.left >= this.left && other.right <= this.right);
	}

	get right() {
		return this.left + this.width;
	}

	get bottom() {
		return this.top + this.height;
	}

	static parseBoundsJson(boundsJsonString) {
		var jsonObject = JSON.parse(boundsJsonString);
		return new Bounds(jsonObject.top, jsonObject.left, jsonObject.width, jsonObject.height);
	}

	parseSetJson(boundsJsonString) {
		var jsonObject = JSON.parse(boundsJsonString);
		this.set(jsonObject.top, jsonObject.left, jsonObject.width, jsonObject.height);
	}

	toString() {
		return '{"top":' + this.top + ',"left":' + this.left
			+ ',"width":' + this.width + ',"height":' + this.height + '}';
	}
}

// Used to get the bounds of canvas section/overlay items from the JSON text inside its
// test div element.
// Parameters:
// itemDivId - The id of the test div element corresponding to the overlay item.
// bounds - A Bounds object in which this function stores the bounds of the overlay item.
//          The bounds unit is core pixels in document coordinates.
function getItemBounds(itemDivId, bounds) {
	cy.get(itemDivId)
		.should(function (itemDiv) {
			bounds.parseSetJson(itemDiv.text());
			expect(bounds.isValid()).to.be.true;
		});
}

var getOverlayItemBounds = getItemBounds;

// This ensures that the overlay item has the expected bounds via its test div element.
// Parameters:
// itemDivId - The id of the test div element corresponding to the overlay item.
// bounds - A Bounds object with the expected bounds data.
//          The bounds unit should be core pixels in document coordinates.
function overlayItemHasBounds(itemDivId, expectedBounds) {
	cy.get(itemDivId)
		.should(function (elem) {
			expect(Bounds.parseBoundsJson(elem.text()))
				.to.deep.equal(expectedBounds, 'Bounds of ' + itemDivId);
		});
}

// This ensures that the overlay item has different bounds from the given one
// via its test div element.
// Parameters:
// itemDivId - The id of the test div element corresponding to the overlay item.
// bounds - A Bounds object with the bounds data to compare.
function overlayItemHasDifferentBoundsThan(itemDivId, bounds) {
	cy.log(bounds.toString());
	cy.get(itemDivId)
		.should(function (elem) {
			expect(elem.text()).to.not.equal(bounds.toString());
		});
}

// Type some text into an input DOM item.
// Parameters:
// selector - selector to find the correct input item in the DOM.
// text - string to type in (can contain cypress command strings).
// clearBefore - whether clear the existing content or not.
function typeIntoInputField(selector, text, clearBefore = true)
{
	cy.log('Typing into input field - start.');

	if (clearBefore) {
		cy.get(selector)
			.focus()
			.clear()
			.type(text + '{enter}');
	} else {
		cy.get(selector)
			.type(text + '{enter}');
	}

	cy.get(selector)
		.should('have.value', text);

	cy.log('Typing into input field - end.');
}

function getVisibleBounds(domRect) {
	return new Bounds(
		Math.max(0, domRect.top),
		Math.max(0, domRect.left),
		domRect.width,
		domRect.height);
}

function assertFocus(selectorType, selector) {
	cy.get('#coolframe')
		.its('0.contentDocument')
		.its('activeElement.'+selectorType)
		.should('be.eq', selector);
}

function getCoolFrameWindow() {
	return cy.get('#coolframe')
		.its('0.contentWindow')
		.should('exist');
}
module.exports.loadTestDoc = loadTestDoc;
module.exports.checkIfDocIsLoaded = checkIfDocIsLoaded;
module.exports.assertCursorAndFocus = assertCursorAndFocus;
module.exports.assertNoKeyboardInput = assertNoKeyboardInput;
module.exports.assertHaveKeyboardInput = assertHaveKeyboardInput;
module.exports.selectAllText = selectAllText;
module.exports.clearAllText = clearAllText;
module.exports.expectTextForClipboard = expectTextForClipboard;
module.exports.matchClipboardText = matchClipboardText;
module.exports.closeDocument = closeDocument;
module.exports.reload = reload;
module.exports.afterAll = afterAll;
module.exports.initAliasToNegative = initAliasToNegative;
module.exports.doIfInCalc = doIfInCalc;
module.exports.doIfInImpress = doIfInImpress;
module.exports.doIfInWriter = doIfInWriter;
module.exports.doIfNotInCalc = doIfNotInCalc;
module.exports.doIfNotInImpress = doIfNotInImpress;
module.exports.doIfNotInWriter = doIfNotInWriter;
module.exports.beforeAll = beforeAll;
module.exports.typeText = typeText;
module.exports.imageShouldBeFullWhite = imageShouldBeFullWhite;
module.exports.imageShouldNotBeFullWhite = imageShouldNotBeFullWhite;
module.exports.canvasShouldBeFullWhite = canvasShouldBeFullWhite;
module.exports.canvasShouldNotBeFullWhite = canvasShouldNotBeFullWhite;
module.exports.clickOnIdle = clickOnIdle;
module.exports.inputOnIdle = inputOnIdle;
module.exports.waitUntilIdle = waitUntilIdle;
module.exports.doIfOnMobile = doIfOnMobile;
module.exports.doIfOnDesktop = doIfOnDesktop;
module.exports.moveCursor = moveCursor;
module.exports.typeIntoDocument = typeIntoDocument;
module.exports.upLoadFileToNextCloud = upLoadFileToNextCloud;
module.exports.getCursorPos = getCursorPos;
module.exports.textSelectionShouldExist = textSelectionShouldExist;
module.exports.textSelectionShouldNotExist = textSelectionShouldNotExist;
module.exports.Bounds = Bounds;
module.exports.getItemBounds = getItemBounds;
module.exports.getOverlayItemBounds = getOverlayItemBounds;
module.exports.overlayItemHasBounds = overlayItemHasBounds;
module.exports.overlayItemHasDifferentBoundsThan = overlayItemHasDifferentBoundsThan;
module.exports.typeIntoInputField = typeIntoInputField;
module.exports.getVisibleBounds = getVisibleBounds;
module.exports.assertFocus = assertFocus;
module.exports.getCoolFrameWindow = getCoolFrameWindow;
module.exports.loadTestDocNoIntegration = loadTestDocNoIntegration;
