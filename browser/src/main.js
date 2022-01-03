/* -*- js-indent-level: 8 -*- */
/* global errorMessages getParameterByName accessToken accessTokenTTL accessHeader */
/* global app L vex host idleTimeoutSecs outOfFocusTimeoutSecs _ */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function (global) {


var wopiParams = {};
var wopiSrc = getParameterByName('WOPISrc');

if (wopiSrc !== '' && accessToken !== '') {
	wopiParams = { 'access_token': accessToken, 'access_token_ttl': accessTokenTTL };
}
else if (wopiSrc !== '' && accessHeader !== '') {
	wopiParams = { 'access_header': accessHeader };
}

var filePath = getParameterByName('file_path');
var permission = getParameterByName('permission') || 'edit';
var timestamp = getParameterByName('timestamp');
// Should the document go inactive or not
var alwaysActive = getParameterByName('alwaysactive');
// Cool Debug mode
var debugMode = getParameterByName('debug');
if (wopiSrc === '' && filePath === '' && !window.ThisIsAMobileApp) {
	vex.dialog.alert(errorMessages.wrongwopisrc);
}
if (host === '' && !window.ThisIsAMobileApp) {
	vex.dialog.alert(errorMessages.emptyhosturl);
}

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

var notWopiButIframe = getParameterByName('NotWOPIButIframe') != '';
var map = L.map('map', {
	server: host,
	doc: docURL,
	docParams: docParams,
	permission: permission,
	timestamp: timestamp,
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

L.Map.THIS = map;

map.loadDocument(global.socket);

global.socket = app.socket;
window.addEventListener('beforeunload', function () {
	if (map && app.socket) {
		if (app.socket.setUnloading)
			app.socket.setUnloading();
		app.socket.close();
	}
});

window.docPermission = permission;
window.bundlejsLoaded = true;


////// Unsupported Browser Warning /////

if (L.Browser.isInternetExplorer) {
	vex.dialog.alert(_('Warning! The browser you are using is not supported.'));
}

}(window));
