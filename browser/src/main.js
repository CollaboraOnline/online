/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global errorMessages accessToken accessTokenTTL accessHeader createOnlineModule */
/* global app $ L host idleTimeoutSecs outOfFocusTimeoutSecs _ */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function (global) {


var wopiParams = {};
var wopiSrc = global.coolParams.get('WOPISrc');

if (wopiSrc !== '' && accessToken !== '') {
	wopiParams = { 'access_token': accessToken, 'access_token_ttl': accessTokenTTL };
}
else if (wopiSrc !== '' && accessHeader !== '') {
	wopiParams = { 'access_header': accessHeader };
}

if (window.ThisIsTheEmscriptenApp)
	// Temporary hack
	var filePath = 'file:///sample.docx';
else
	var filePath = global.coolParams.get('file_path');

app.file.permission = global.coolParams.get('permission') || 'edit';

var timestamp = global.coolParams.get('timestamp');
var target = global.coolParams.get('target') || '';
// Should the document go inactive or not
var alwaysActive = global.coolParams.get('alwaysactive');
// Cool Debug mode
var debugMode = global.coolParams.get('debug');

var docURL, docParams;
var isWopi = false;
if (wopiSrc != '') {
	docURL = decodeURIComponent(wopiSrc);
	docParams = wopiParams;
	isWopi = true;
} else {
	docURL = filePath;
	docParams = {};
}

var notWopiButIframe = global.coolParams.get('NotWOPIButIframe') != '';
var map = L.map('map', {
	server: host,
	doc: docURL,
	docParams: docParams,
	timestamp: timestamp,
	docTarget: target,
	documentContainer: 'document-container',
	debug: debugMode,
	// the wopi and wopiSrc properties are in sync: false/true : empty/non-empty
	wopi: isWopi,
	wopiSrc: wopiSrc,
	notWopiButIframe: notWopiButIframe,
	alwaysActive: alwaysActive,
	idleTimeoutSecs: idleTimeoutSecs,  // Dim when user is idle.
	outOfFocusTimeoutSecs: outOfFocusTimeoutSecs, // Dim after switching tabs.
});

////// Controls /////

map.uiManager = L.control.uiManager();
map.addControl(map.uiManager);

map.uiManager.initializeBasicUI();

if (wopiSrc === '' && filePath === '' && !window.ThisIsAMobileApp) {
	map.uiManager.showInfoModal('wrong-wopi-src-modal', '', errorMessages.wrongwopisrc, '', _('OK'), null, false);
}
if (host === '' && !window.ThisIsAMobileApp) {
	map.uiManager.showInfoModal('empty-host-url-modal', '', errorMessages.emptyhosturl, '', _('OK'), null, false);
}

if (L.Map.versionBar)
	map.addControl(L.Map.versionBar);

L.Map.THIS = map;
app.map = map;
app.idleHandler.map = map;

if (window.ThisIsTheEmscriptenApp) {
	var docParamsString = $.param(docParams);
	// The URL may already contain a query (e.g., 'http://server.tld/foo/wopi/files/bar?desktop=baz') - then just append more params
	var docParamsPart = docParamsString ? (docURL.includes('?') ? '&' : '?') + docParamsString : '';
	var encodedWOPI = encodeURIComponent(docURL + docParamsPart);

	var Module = {
		onRuntimeInitialized: function() {
			map.loadDocument(global.socket);
		},
		print: function (text) {
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			console.warn(text);
		},
		printErr: function (text) {
			if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
			console.error(text);
		},
		arguments_: [docURL, encodedWOPI, isWopi ? 'true' : 'false'],
		arguments: [docURL, encodedWOPI, isWopi ? 'true' : 'false'],
	};
	createOnlineModule(Module);
	app.HandleCOOLMessage = Module['_handle_cool_message'];
	app.AllocateUTF8 = Module['allocateUTF8'];
} else {
	map.loadDocument(global.socket);
}

window.addEventListener('beforeunload', function () {
	if (map && app.socket) {
		if (app.socket.setUnloading)
			app.socket.setUnloading();
		app.socket.close();
	}
});

window.bundlejsLoaded = true;


////// Unsupported Browser Warning /////

if (L.Browser.isInternetExplorer) {
	map.uiManager.showInfoModal('browser-not-supported-modal', '', _('Warning! The browser you are using is not supported.'), '', _('OK'), null, false);
}

}(window));
