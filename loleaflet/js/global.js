/* -*- js-indent-level: 8 -*- */
/* global loleafletLogging */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function (global) {

// If not debug, don't print anything on the console
// except in tile debug mode (Ctrl-Shift-Alt-d)
console.log2 = console.log;
if (loleafletLogging !== 'true') {
	var methods = ['warn', 'info', 'debug', 'trace', 'log', 'assert', 'time', 'timeEnd'];
	for (var i = 0; i < methods.length; i++) {
		console[methods[i]] = function() {};
	}
}

// fix jquery-ui
// var jQuery = require('jquery');
global.require = function (path) {
	if (path=='jquery') {
		return global.jQuery;
	}
};

global.getParameterByName = function (name) {
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	var results = regex.exec(location.search);
	return results === null ? '' : results[1].replace(/\+/g, ' ');
};

global._ = function (string) {
	// In the mobile app case we can't use the stuff from l10n-for-node, as that assumes HTTP.
	if (window.ThisIsTheiOSApp) {
		// We use another approach just for iOS for now.
		if (window.LOCALIZATIONS.hasOwnProperty(string)) {
			// window.webkit.messageHandlers.debug.postMessage('_(' + string + '): YES: ' + window.LOCALIZATIONS[string]);
			var result = window.LOCALIZATIONS[string];
			if (window.LANG === 'de-CH') {
				result = result.replace(/ß/g, 'ss');
			}
			return result;
		} else {
			// window.webkit.messageHandlers.debug.postMessage('_(' + string + '): NO');
			return string;
		}
	} else if (window.ThisIsAMobileApp) {
		// And bail out without translations on other mobile platforms.
		return string;
	} else {
		return string.toLocaleString();
	}
};

}(window));
