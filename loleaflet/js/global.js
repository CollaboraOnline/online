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
	return string.toLocaleString();
};

}(window));
