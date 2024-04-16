/* -*- js-indent-level: 8 -*- */
/* global cy Cypress expect */

function copyFile(fileName, newFileName, subFolder) {
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

function getRandomFileName(noRename, noFileCopy, originalName) {
	if (noRename !== true && noFileCopy !== true) {
		var randomName = (Math.random() + 1).toString(36).substring(7);
		return Cypress.currentTest.title.replace(/[\/\\ ]/g, '-') + '-'+ randomName + '-' + originalName;
	}
	else {
		return originalName;
	}
}

function logError(event) {
	Cypress.log({ name:'error:', message: (event.error.message ? event.error.message : 'no message')
		      + '\n' + (event.error.stack ? event.error.stack : 'no stack') });
}

function logLoadingParameters(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename) {
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	if (noFileCopy !== undefined)
		cy.log('Param - noFileCopy: ' + noFileCopy);
	if (isMultiUser !== undefined)
		cy.log('Param - isMultiUser: ' + isMultiUser);
	if (subsequentLoad !== undefined)
		cy.log('Param - subsequentLoad: ' + subsequentLoad);
	if (hasInteractionBeforeLoad !== undefined)
		cy.log('Param - hasInteractionBeforeLoad: ' + hasInteractionBeforeLoad);
	if (noRename !== undefined)
		cy.log('Param - noRename: ' + noRename);
}

function generateDocumentURL() {
	var URI = '';
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		URI += 'http://' + Cypress.env('SERVER') + '/richproxy/proxy.php?req=';
	}

	return URI;
}

function generateDocumentURI(URL, subFolder, newFileName) {
	var URI = '';
	if (subFolder === undefined) {
		URI = URL + '/browser/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/debug.html?lang=en-US&file_path=' +
			Cypress.env('DATA_WORKDIR') + newFileName;
	} else {
		URI = URL + '/browser/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/debug.html?lang=en-US&file_path=' +
			Cypress.env('DATA_WORKDIR') + subFolder + '/' + newFileName;
	}
	return URI;
}

/*
Loading the test document directly in Collabora Online.
Parameters:
	fileName - test document file name (without path)
	subFolder - sub folder inside data folder (e.g. writer, calc, impress)
	noFileCopy - whether to create a copy of the test file before run the test.
					By default, we create a copy to have a clear test document but
					but when we test saving functionality we need to open same document
	isMultiUser - whether the test is for multiuser
	noRename - whether or not to give the file a unique name, if noFileCopy is false.
 */
function loadTestDocNoIntegration(fileName, subFolder, noFileCopy, isMultiUser, noRename) {
	cy.log('>> loadTestDocNoIntegration - start');

	var newFileName = getRandomFileName(noRename, noFileCopy, fileName);

	cy.log('Param - fileName: ' + fileName + ' -> ' + newFileName);

	// Get a clean test document, by creating a copy of it in the workdir. We overwrite this copy everytime we run a new test case.
	if (noFileCopy !== true)
		copyFile(fileName, newFileName, subFolder);

	var URL = generateDocumentURL();
	var URI = generateDocumentURI(URL, subFolder, newFileName);

	if (isMultiUser) {
		cy.viewport(2000,660);
		URI = URI.replace('debug.html', 'cypress-multiuser.html');
	}

	cy.visit(URI, {
		onBeforeLoad: function(win) {
			win.addEventListener('error', logError);
			win.addEventListener('DOMContentLoaded', function () {
				for (var i = 0; i < win.frames.length; i++) {
					win.frames[i].addEventListener('error', logError);
				}
			});
		}
	});

	cy.log('<< loadTestDocNoIntegration - end');

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
	cy.log('>> loadTestDocNextcloud - start');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	upLoadFileToNextCloud(fileName, subFolder, subsequentLoad);

	// Open test document
	cy.cGet('tr[data-file=\'' + fileName + '\']').click();

	cy.cGet('iframe#richdocumentsframe').should('be.visible', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	cy.wait(10000);

	// We create global aliases for iframes, so it's faster to reach them.
	cy.cGet('iframe#richdocumentsframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('richdocumentsIFrameGlobal');

	cy.cGet('@richdocumentsIFrameGlobal')
		.find('iframe#coolframe')
		.its('0.contentDocument').should('exist')
		.its('body').should('not.be.undefined')
		.then(cy.wrap).as('loleafletIFrameGlobal');

	// The IFRAME_LEVEL environment variable will indicate
	// in which iframe we have.
	cy.cGet('iframe#richdocumentsframe')
		.then(function() {
			Cypress.env('IFRAME_LEVEL', '2');
		});

	cy.log('<< loadTestDocNextcloud - end');
}

// Hide NC's first run wizard, which is opened by the first run of
// nextcloud. When we run cypress in headless mode, NC don't detect
// that we already used it and so it always opens this wizard.
function hideNCFirstRunWizard() {
	cy.log('>> hideNCFirstRunWizard - start');

	// Hide first run wizard if it's there
	cy.wait(2000); // Wait some time to the wizard become visible, if it's there.
	cy.cGet('body')
		.then(function(body) {
			if (body.find('#firstrunwizard').length !== 0) {
				cy.cGet('#firstrunwizard')
					.then(function(wizard) {
						wizard.hide();
					});
			}
		});

	cy.log('<< hideNCFirstRunWizard - end');
}

// Upload a test document into Nexcloud and open it.
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// subsequentLoad - whether we load a test document for the first time in the
//                  test case or not. It's important because we need to sign in
//                  with the username + password only for the first time.
function upLoadFileToNextCloud(fileName, subFolder, subsequentLoad) {
	cy.log('>> loadTestDocNextcloud - start');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - subsequentLoad: ' + subsequentLoad);

	// Open local nextcloud installation
	var url = 'http://' + Cypress.env('SERVER') + 'nextcloud/index.php/apps/files';
	cy.visit(url);

	// Log in with cypress test user / password (if this is the first time)
	if (subsequentLoad !== true) {
		cy.cGet('input#user').clear().type('cypress_test');

		cy.cGet('input#password').clear().type('cypress_test');

		cy.cGet('input#submit-form').click();

		cy.cGet('.button.new').should('be.visible');

		// Wait for free space calculation before uploading document
		cy.cGet('#free_space').should('not.have.attr', 'value', '');

		hideNCFirstRunWizard();

		// Remove all existing file, so we make sure the test document is removed
		// and then we can upload a new one.
		cy.cGet('#fileList')
			.then(function(filelist) {
				if (filelist.find('tr').length !== 0) {
					cy.waitUntil(function() {
						cy.cGet('#fileList tr:nth-of-type(1) .action-menu.permanent')
							.click();

						cy.cGet('.menuitem.action.action-delete.permanent')	.click();

						cy.cGet('#uploadprogressbar').should('not.be.visible');

						return cy.cGet('#fileList')
							.then(function(filelist) {
								return filelist.find('tr').length === 0;
							});
					}, {timeout: 60000});
				}
			});
	} else {
		// Wait for free space calculation before uploading document
		cy.cGet('#free_space').should('not.have.attr', 'value', '');

		hideNCFirstRunWizard();
	}

	cy.cGet('tr[data-file=\'' + fileName + '\']').should('not.exist');

	// Upload test document
	var fileURI = '';
	if (subFolder === undefined) {
		fileURI += fileName;
	} else {
		fileURI += subFolder + '/' + fileName;
	}
	doIfOnDesktop(function() {
		cy.cGet('input#file_upload_start')
			.attachFile({ filePath: 'desktop/' + fileURI, encoding: 'binary' });
	});
	doIfOnMobile(function() {
		cy.cGet('input#file_upload_start')
			.attachFile({ filePath: 'mobile/' + fileURI, encoding: 'binary' });
	});

	cy.cGet('#uploadprogressbar')
		.should('not.be.visible');

	cy.cGet('tr[data-file=\'' + fileName + '\']')
		.should('be.visible');

	cy.log('<< loadTestDocNextcloud - end');
}

// Used for interference testing. We wait until the interfering user loads
// its instance of the document and starts its interfering actions.
// So we can be sure the interference actions are made during the test
// user does the actual test steps.
function waitForInterferingUser() {
	cy.log('>> waitForInterferingUser - start');

	cy.cGet('#toolbar-up #userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
		.should('be.visible');

	cy.wait(10000);

	cy.log('<< waitForInterferingUser - end');
}

// Loading the test document inside Collabora Online (directly or via some integration).
// Parameters:
// fileName - test document file name (without path)
// subFolder - sub folder inside data folder (e.g. writer, calc, impress)
// noFileCopy - whether to create a copy of the test file before run the test.
//				By default, we create a copy to have a clear test document but
//				but when we test saving functionality we need to open same document
// isMultiUser - whether test is a multiuser test
// subsequentLoad - whether we load a test document for the first time in the
//                  test case or not. It's important for nextcloud because we need to sign in
//                  with the username + password only for the first time.
// noRename - whether or not to give the file a unique name, if noFileCopy is false.
function loadTestDoc(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename) {
	cy.log('>> loadTestDoc - start');

	var server = Cypress.env('SERVER');
	logLoadingParameters(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename);

	// We set the mobile screen size here. We could use any other phone type here.
	doIfOnMobile(function() {
		cy.viewport('iphone-6');
	});

	var destFileName = fileName;
	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		loadTestDocNextcloud(fileName, subFolder, subsequentLoad);
	} else {
		if (server !== 'localhost') {
			noFileCopy = noRename = true;
		}
		destFileName = loadTestDocNoIntegration(fileName, subFolder, noFileCopy, isMultiUser, noRename);
	}

	// When dialog appears before document load (eg. macro warning, csv import options)
	if (hasInteractionBeforeLoad === true)
		return;

	checkIfDocIsLoaded(isMultiUser);

	cy.log('<< loadTestDoc - end');
	return destFileName;
}

function documentChecks() {
	cy.log('>> documentChecks - start');

	cy.cframe().find('#document-canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	// With php-proxy the client is irresponsive for some seconds after load, because of the incoming messages.
	if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.wait(10000);
	}

	// Wait for the sidebar to open.
	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		doIfOnDesktop(function() {
			if (Cypress.env('pdf-view') !== true)
				cy.cframe().find('#sidebar-panel').should('be.visible');

			// Check that the document does not take the whole window width.
			cy.window()
				.then(function(win) {
					cy.cframe().find('#document-container')
						.should(function(doc) {
							expect(doc).to.have.lengthOf(1);
							if (Cypress.env('pdf-view') !== true)
								expect(doc[0].getBoundingClientRect().right).to.be.lessThan(win.innerWidth * 0.95);
						});
				});

			// Check also that the inputbar is drawn in Calc.
			doIfInCalc(function() {
				cy.cframe().find('#sc_input_window.formulabar');
			});
		});
	}

	if (Cypress.env('INTERFERENCE_TEST') === true) {
		waitForInterferingUser();
	}

	cy.log('<< documentChecks - end');
}

function checkIfDocIsLoaded(isMultiUser) {
	cy.log('>> checkIfDocIsLoaded - start');

	if (isMultiUser) {
		cy.cSetActiveFrame('#iframe1');
		cy.cframe('#iframe1').its('body').should('not.be.undefined');
		documentChecks();

		cy.cSetActiveFrame('#iframe2');
		cy.cframe('#iframe2').its('body').should('not.be.undefined');
		documentChecks();
	}
	else {
		cy.cSetActiveFrame('#coolframe');
		cy.cframe().its('body').should('not.be.undefined');
		documentChecks();
	}

	cy.log('<< checkIfDocIsLoaded - end');
}

// Assert that NO keyboard input is accepted (i.e. keyboard should be HIDDEN).
function assertNoKeyboardInput() {
	cy.log('>> assertNoKeyboardInput - start');

	cy.cGet('div.clipboard').should('have.attr', 'data-accept-input', 'false');

	cy.log('<< assertNoKeyboardInput - end');
}

// Assert that keyboard input is accepted (i.e. keyboard should be VISIBLE).
function assertHaveKeyboardInput() {
	cy.log('>> assertHaveKeyboardInput - start');

	cy.cGet('div.clipboard').should('have.attr', 'data-accept-input', 'true');

	cy.log('<< assertHaveKeyboardInput - end');
}

// Assert that we have cursor and focus on the text area of the document.
function assertCursorAndFocus() {
	cy.log('>> assertCursorAndFocus - start');

	if (Cypress.env('INTEGRATION') !== 'nextcloud') {
		// Active element must be the textarea named clipboard.
		assertFocus('className', 'clipboard');
	}

	// In edit mode, we should have the blinking cursor.
	cy.cGet('.leaflet-cursor.blinking-cursor').should('exist');
	cy.cGet('.leaflet-cursor-container').should('exist');

	assertHaveKeyboardInput();

	cy.log('<< assertCursorAndFocus - end');
}

// Select all text via CTRL+A shortcut.
function selectAllText() {
	cy.log('>> selectAllText - start');

	typeIntoDocument('{ctrl}a');

	textSelectionShouldExist();

	cy.log('<< selectAllText - end');
}

// Clear all text by selecting all and deleting.
function clearAllText() {
	cy.log('>> clearAllText - start');

	//assertCursorAndFocus();

	// Trigger select all
	selectAllText();

	// Then remove
	typeIntoDocument('{backspace}');

	textSelectionShouldNotExist();

	cy.log('<< clearAllText - end');
}

// Check that the clipboard text matches with the specified text.
// Parameters:
// expectedPlainText - a string, the clipboard container should have.
function expectTextForClipboard(expectedPlainText) {
	cy.log('>> expectTextForClipboard - start');

	cy.log('Text:' + expectedPlainText);
	doIfInWriter(function() {
		cy.cGet('#copy-paste-container p')
			.then(function(pItem) {
				if (pItem.children('font').length !== 0) {
					cy.cGet('#copy-paste-container p font')
						.should('have.text', expectedPlainText);
				} else {
					cy.cGet('#copy-paste-container p')
						.should('have.text', expectedPlainText);
				}
			});
	});

	doIfInCalc(function() {
		cy.cGet('#copy-paste-container pre')
			.should('have.text', expectedPlainText);
	});

	doIfInImpress(function() {
		cy.cGet('#copy-paste-container pre')
			.should('have.text', expectedPlainText);
	});

	cy.log('<< expectTextForClipboard - end');
}

// Check that the clipboard text matches with the
// passed regular expression.
// Parameters:
// regexp - a regular expression to match the content with.
//          https://docs.cypress.io/api/commands/contains.html#Regular-Expression
function matchClipboardText(regexp) {
	cy.log('>> matchClipboardText - start');

	doIfInWriter(function() {
		cy.cGet('body').contains('#copy-paste-container p font', regexp).should('exist');
	});
	doIfInCalc(function() {
		cy.cGet('body').contains('#copy-paste-container pre', regexp).should('exist');
	});
	doIfInImpress(function() {
		cy.cGet('body').contains('#copy-paste-container pre', regexp).should('exist');
	});

	cy.log('<< matchClipboardText - end');
}

function clipboardTextShouldBeDifferentThan(text) {
	cy.log('>> clipboardTextShouldBeDifferentThan - start');

	doIfInWriter(function() {
		cy.cGet('body').contains('#copy-paste-container p font', text).should('not.exist');
	});
	doIfInCalc(function() {
		cy.cGet('body').contains('#copy-paste-container pre', text).should('not.exist');
	});
	doIfInImpress(function() {
		cy.cGet('body').contains('#copy-paste-container pre', text).should('not.exist');
	});

	cy.log('<< clipboardTextShouldBeDifferentThan - end');
}

// This is called during a test to reload the same document after
// some modification. The purpose is typically to verify that
// said changes were preserved in the document upon closing.
function reload(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad) {
	cy.log('Reloading document: ' + subFolder + '/' + fileName);
	cy.log('Reloading document - noFileCopy: ' + noFileCopy);
	cy.log('Reloading document - subsequentLoad: ' + subsequentLoad);
	closeDocument(fileName);
	var noRename = true;
	return loadTestDoc(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename);
}

// noRename - whether or not to give the file a unique name, if noFileCopy is false.
function beforeAll(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename) {
	// Set defaults here in order to remove checks from cy.cGet function.
	cy.cSetActiveFrame('#coolframe');

	return loadTestDoc(fileName, subFolder, noFileCopy, isMultiUser, subsequentLoad, hasInteractionBeforeLoad, noRename);
}

// testState no longer used, but not removed from all calls to afterAll yet
// eslint-disable-next-line no-unused-vars
function afterAll(fileName, testState) {
	closeDocument(fileName);
}

// This method is intended to call after each test case.
// We use this method to close the document, before step
// on to the next test case.
// Parameters:
// fileName - test document name (we can check it on the admin console).
// testState - whether the test passed or failed before this method was called.
function closeDocument(fileName) {
	cy.log('>> closeDocument - start');

	if (Cypress.env('INTEGRATION') === 'nextcloud') {
		if (Cypress.env('IFRAME_LEVEL') === '2') {
			// Close the document, with the close button.
			doIfOnMobile(function() {
				cy.cGet('#toolbar-mobile-back').click();
				cy.cGet('#mobile-edit-button').should('be.visible');
				cy.cGet('#toolbar-mobile-back').then(function(item) {
						cy.wrap(item).click();
						Cypress.env('IFRAME_LEVEL', '');
					});
			});
			doIfOnDesktop(function() {
				cy.cGet('#closebutton').then(function(item) {
						cy.wrap(item).click();
						Cypress.env('IFRAME_LEVEL', '');
					});
			});

			cy.cGet('#filestable').should('be.visible');
			cy.cGet('#filestable').should('not.have.class', 'hidden');

			cy.wait(3000);

			// Remove the document
			cy.cGet('tr[data-file=\'' + fileName + '\'] .action-menu.permanent').click();
			cy.cGet('.menuitem.action.action-delete.permanent').click();
			cy.cGet('tr[data-file=\'' + fileName + '\']').should('not.exist');

		}
	// For php-proxy admin console does not work, so we just open
	// localhost and wait some time for the test document to be closed.
	} else if (Cypress.env('INTEGRATION') === 'php-proxy') {
		cy.visit('http://' + Cypress.env('SERVER') + '/', {failOnStatusCode: false});

		cy.wait(5000);
	} else {
		if (Cypress.env('INTERFERENCE_TEST') === true) {
			typeIntoDocument('{ctrl}s');

			cy.wait(2000);
		}

		// Make sure that the document is closed
		cy.visit('http://admin:admin@' + Cypress.env('SERVER') + ':' +
			Cypress.env('SERVER_PORT') +
			'/browser/dist/admin/admin.html');

		cy.get('#uptime').its('text').should('not.eq', '0');

		// We have all lines of document infos as one long string.
		// We have PID number before the file names, with matching
		// also on the PID number we can make sure to match on the
		// whole file name, not on a suffix of a file name.
		var regex = new RegExp('[0-9]' + fileName);
		// Saving may take much longer now to ensure no unsaved data exists.
		// This is not an issue on a fast machine, but on the CI we do timeout often.
		const options = {timeout : Cypress.config('defaultCommandTimeout') * 2.0};
		cy.get('#doclist', options)
			.invoke(options, 'text')
			.should('not.match', regex);
	}

	cy.log('<< closeDocument - end');
}

// Initialize an alias to a negative number value. It can be useful
// when we use an alias as a variable and later we intend to set it
// to a non-negative value.
// Parameters:
// aliasName - a string, expected to be used as alias.
function initAliasToNegative(aliasName) {
	cy.log('>> initAliasToNegative - start');
	cy.log('Param - aliasName: ' + aliasName);

	cy.cGet('#copy-paste-container')
		.invoke('offset')
		.its('top')
		.as(aliasName);

	cy.get('@' + aliasName).should('be.lessThan', 0);

	cy.log('<< initAliasToNegative - end');
}

// Run a code snippet if we are inside Calc.
function doIfInCalc(callback) {
	cy.cframe().find('#document-container', {log: false})
		.then(function(doc) {
		if (doc.hasClass('spreadsheet-doctype')) {
			callback();
		}
	});
}

// Run a code snippet if we are *NOT* inside Calc.
function doIfNotInCalc(callback) {
	cy.cframe().find('#document-container', {log: false})
		.then(function(doc) {
			if (!doc.hasClass('spreadsheet-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are inside Impress.
function doIfInImpress(callback) {
	cy.cframe().find('#document-container', {log: false})
		.then(function(doc) {
			if (doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are *NOT* inside Impress.
function doIfNotInImpress(callback) {
	cy.cframe().find('#document-container', {log: false})
		.then(function(doc) {
			if (!doc.hasClass('presentation-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are inside Writer.
function doIfInWriter(callback) {
	cy.cframe().find('#document-container', {log: false})
		.then(function(doc) {
			if (doc.hasClass('text-doctype')) {
				callback();
			}
		});
}

// Run a code snippet if we are *NOT* inside Writer.
function doIfNotInWriter(callback) {
	cy.cframe().find('#document-container', {log: false})
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
function typeText(selector, text, delayMs = 0) {
	cy.log('>> typeText - start');

	for (var i = 0; i < text.length; i++) {
		cy.cGet(selector).type(text.charAt(i));
		if (delayMs > 0)
			cy.wait(delayMs);
	}

	cy.log('<< typeText - end');
}

// Check whether an img DOM element has only white colored pixels or not.
function isImageWhite(selector, expectWhite = true) {
	cy.log('>> isImageWhite - start');

	expect(selector).to.have.string('img');

	cy.cGet(selector)
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

			var result = true;
			for (var i = 0; i < pixelData.length; ++i) {
				if (pixelData[i] !== 255) {
					result = false;
					break;
				}
			}
			if (expectWhite)
				expect(result).to.be.true;
			else
				expect(result).to.be.false;
		});

	cy.log('<< isImageWhite - end');
}

function isCanvasWhite(expectWhite = true) {
	cy.log('>> isCanvasWhite - start');

	cy.wait(300);
	cy.cGet('#document-canvas').should('exist').then(function(canvas) {
		var result = true;
		var context = canvas[0].getContext('2d');
		var pixelData = context.getImageData(0, 0, canvas[0].width, canvas[0].height).data;
		for (var i = 0; i < pixelData.length; i++) {
			if (pixelData[i] !== 255) {
				result = false;
				break;
			}
		}

		if (expectWhite)
			expect(result).to.be.true;
		else
			expect(result).to.be.false;
	});

	cy.log('<< isCanvasWhite - end');
}

// Waits until a DOM element becomes idle (does not change for a given time).
// It's useful to handle flickering on the UI, which might make cypress
// tests unstable. If the UI flickers, we can use this method to wait
// until it settles and the move on with the test.
// Parameters:
// selector - a CSS selector to query a DOM element to wait on to be idle.
// content - a string, a content selector used by cy.contains() to select the correct DOM element.
// waitingTime - how much time to wait before we say the item is idle.
function waitUntilIdle(selector, content) {
	// waitUntilIdle has been stubbed in order to reduce the number of calls to cy.wait().
	// Find a specific condition to wait for using waitUntil, or even better use Cypress's
	// built-in retrying functionality on find, should, and other functions.
	cy.log('waitUntilIdle stubbed');
	if (content) {
		cy.cGet(selector, content);
	} else {
		cy.cGet(selector);
	}
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
function clickOnIdle(selector, content) {
	// waitUntilIdle has been stubbed and clickOnIdle will be removed soon.
	// Find a specific condition to wait for using waitUntil, or even better use Cypress's
	// built-in retrying functionality on find, should, and other functions.
	// Then call .click() directly from the test
	cy.log('clickOnIdle stubbed');
	if (content) {
		cy.cGet(selector, content).should('not.have.attr', 'disabled');
		cy.cGet(selector, content).click();
	} else {
		cy.cGet(selector).should('not.have.attr', 'disabled');
		cy.cGet(selector).click();
	}
}

// Waits for the DOM element to be idle and types into it afterward.
// See also the comments at clickOnIdle() method.
// Parameters:
// selector - a CSS selector to query a DOM element to wait on to be idle.
// input - text to be typed into the selected DOM element.
// waitingTime - how much time to wait before we say the item is idle.
function inputOnIdle(selector, input) {
	// waitUntilIdle has been stubbed and inputOnIdle will be removed soon.
	// Find a specific condition to wait for using waitUntil, or even better use Cypress's
	// built-in retrying functionality on find, should, and other functions.
	// Then call .type() directly from the test
	cy.log('inputOnIdle stubbed');

	cy.cGet(selector)
		.clear()
		.type(input)
		.type('{enter}');
}

// Run a code snippet if we are in a mobile test.
function doIfOnMobile(callback) {
	cy.window({log: false})
		.then(function(win) {
			if (win.navigator.userAgent === 'cypress-mobile') {
				callback();
			}
		});
}

// Run a code snippet if we are in a desktop test.
function doIfOnDesktop(callback) {
	cy.window({log: false})
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
	cursorSelector = '.cursor-overlay .blinking-cursor') {
	cy.log('>> moveCursor - start');
	cy.log('Param - direction: ' + direction);
	cy.log('Param - modifier: ' + modifier);
	cy.log('Param - checkCursorVis: ' + checkCursorVis);
	cy.log('Param - cursorSelector: ' + cursorSelector);

	// Get the original cursor position.
	var origCursorPos = 0;
	cy.cGet(cursorSelector)
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

	typeIntoDocument(key);

	// Make sure the cursor position was changed.
	cy.cGet(cursorSelector)
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
		cy.cGet(cursorSelector).should('be.visible');
	}

	cy.log('<< moveCursor - end');
}

// Type something into the document. It can be some text or special characters too.
function typeIntoDocument(text) {
	cy.log('>> typeIntoDocument - start');

	cy.cGet('div.clipboard').type(text, {force: true});

	cy.log('<< typeIntoDocument - end');
}

// Get cursor's current position.
// Parameters:
// offsetProperty - which offset position we need (e.g. 'left' or 'top').
// aliasName - we create an alias with the queried position.
// cursorSelector - selector to find the correct cursor element in the DOM.
function getCursorPos(offsetProperty, aliasName, cursorSelector = '.cursor-overlay .blinking-cursor') {
	cy.log('>> getCursorPos - start');

	initAliasToNegative(aliasName);

	cy.cGet(cursorSelector)
		.invoke('offset')
		.its(offsetProperty)
		.as(aliasName);

	cy.get('@' + aliasName).then(aliasValue => {
		var value = aliasValue;
		cy.wrap(value).as(aliasName);
	});

	cy.get('@' + aliasName)
		.should('be.greaterThan', 0);

	cy.log('<< getCursorPos - end');
}

// We make sure we have a text selection..
function textSelectionShouldExist() {
	cy.log('>> textSelectionShouldExist - start');

	cy.cGet('.leaflet-selection-marker-start').should('exist');
	cy.cGet('.leaflet-selection-marker-end').should('exist');

	// One of the marker should be visible at least (if not both).
	cy.cGet('.leaflet-selection-marker-start, .leaflet-selection-marker-end').should('be.visible');

	cy.log('<< textSelectionShouldExist - end');
}

// We make sure we don't have a text selection..
function textSelectionShouldNotExist() {
	cy.log('>> textSelectionShouldNotExist - start');

	cy.cGet('.leaflet-selection-marker-start').should('not.exist');
	cy.cGet('.leaflet-selection-marker-end').should('not.exist');

	cy.log('<< textSelectionShouldNotExist - end');
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
	cy.log('>> getItemBounds - start');

	cy.cGet(itemDivId)
		.should(function (itemDiv) {
			bounds.parseSetJson(itemDiv.text());
			expect(bounds.isValid()).to.be.true;
		});

	cy.log('<< getItemBounds - end');
}

var getOverlayItemBounds = getItemBounds;

// This ensures that the overlay item has the expected bounds via its test div element.
// Parameters:
// itemDivId - The id of the test div element corresponding to the overlay item.
// bounds - A Bounds object with the expected bounds data.
//          The bounds unit should be core pixels in document coordinates.
function overlayItemHasBounds(itemDivId, expectedBounds) {
	cy.log('>> overlayItemHasBounds - start');

	cy.cGet(itemDivId)
		.should(function (elem) {
			expect(Bounds.parseBoundsJson(elem.text()))
				.to.deep.equal(expectedBounds, 'Bounds of ' + itemDivId);
		});

	cy.log('<< overlayItemHasBounds - end');
}

// This ensures that the overlay item has different bounds from the given one
// via its test div element.
// Parameters:
// itemDivId - The id of the test div element corresponding to the overlay item.
// bounds - A Bounds object with the bounds data to compare.
function overlayItemHasDifferentBoundsThan(itemDivId, bounds) {
	cy.log('>> overlayItemHasDifferentBoundsThan - start');
	cy.log(bounds.toString());

	cy.cGet(itemDivId)
		.should(function (elem) {
			expect(elem.text()).to.not.equal(bounds.toString());
		});

	cy.log('<< overlayItemHasDifferentBoundsThan - end');
}

// Type some text into an input DOM item.
// Parameters:
// selector - selector to find the correct input item in the DOM.
// text - string to type in (can contain cypress command strings).
// clearBefore - whether clear the existing content or not.
function typeIntoInputField(selector, text, clearBefore = true)
{
	cy.log('>> typeIntoInputField - start');

	cy.cGet(selector).as('input');
	if (clearBefore) {
		cy.get('@input').focus();
		cy.get('@input').clear();
	}
	cy.get('@input').type(text + '{enter}');
	cy.get('@input').should('have.value', text);

	cy.log('<< typeIntoInputField - end');
}

function getVisibleBounds(domRect) {
	return new Bounds(
		Math.max(0, domRect.top),
		Math.max(0, domRect.left),
		domRect.width,
		domRect.height);
}

function assertFocus(selectorType, selector) {
	cy.log('>> assertFocus - start');

	cy.cGet().its('activeElement.'+selectorType).should('be.eq', selector);

	cy.log('<< assertFocus - end');
}

// Create an alias to a point whose coordinate are the middle point of the blinking cursor
// It should be used with clickAt (see function below)
function getBlinkingCursorPosition(aliasName) {
	cy.log('>> getBlinkingCursorPosition - start');

	var cursorSelector = '.cursor-overlay .blinking-cursor';
	cy.cGet(cursorSelector).then(function(cursor) {
		var boundRect = cursor[0].getBoundingClientRect();
		var xPos = boundRect.right;
		var yPos = (boundRect.top + boundRect.bottom) / 2;
		cy.wrap({x: xPos, y: yPos}).as(aliasName);
	});

	cy.get('@' + aliasName).then(point => {
		expect(point.x).to.be.greaterThan(0);
		expect(point.y).to.be.greaterThan(0);
	});

	cy.log('<< getBlinkingCursorPosition - end');
}

// Simulate a click at the point referenced by the passed alias.
// If the 'double' parameter is true, a double click is simulated.
// To be used in pair with getBlinkingCursorPosition (see function above)
function clickAt(aliasName, double = false) {
	cy.log('>> clickAt - start');

	cy.get('@' + aliasName).then(point => {
		expect(point.x).to.be.greaterThan(0);
		expect(point.y).to.be.greaterThan(0);
		if (double) {
			cy.cGet('body').dblclick(point.x, point.y);
		} else {
			cy.cGet('body').click(point.x, point.y);
		}
	});

	cy.log('<< clickAt - end');
}

// Replaces the system clipboard with a dummy one for copy purposes. The copy content for the
// specified type will be injected into the DOM, so the caller can assert it.
function setDummyClipboardForCopy(type) {
	if (type === undefined) {
		type = 'text/html';
	}
	cy.window().then(win => {
		const app = win['0'].app;
		const clipboard = app.map._clip;
		clipboard._dummyClipboard = {
			write: function(clipboardItems) {
				const clipboardItem = clipboardItems[0];
				clipboardItem.getType(type).then(blob => blob.text())
				.then(function (text) {
					if (type === 'text/html') {
						clipboard._dummyDiv.innerHTML = text;
					} else if (type == 'text/plain') {
						clipboard._dummyPlainDiv.innerHTML = text;
					}
				});
				return {
					then: function(resolve/*, reject*/) {
						resolve();
					},
				};
			},

			useAsyncWrite: true,
		};
	});
}

// Clicks the Copy button on the UI.
function copy() {
	cy.window().then(win => {
		const app = win['0'].app;
		const clipboard = app.map._clip;
		clipboard.filterExecCopyPaste('.uno:Copy');
	});
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
module.exports.clipboardTextShouldBeDifferentThan = clipboardTextShouldBeDifferentThan;
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
module.exports.isImageWhite = isImageWhite;
module.exports.isCanvasWhite = isCanvasWhite;
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
module.exports.loadTestDocNoIntegration = loadTestDocNoIntegration;
module.exports.getBlinkingCursorPosition = getBlinkingCursorPosition;
module.exports.clickAt = clickAt;
module.exports.setDummyClipboardForCopy = setDummyClipboardForCopy;
module.exports.copy = copy;
