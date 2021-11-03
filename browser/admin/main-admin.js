/* -*- js-indent-level: 8 -*- */
// CSS requires
require('vex-js/dist/css/vex.css');
require('vex-js/dist/css/vex-theme-plain.css');

var $ = require('jquery');
global.$ = global.jQuery = $;

require('json-js/json2');
require('l10n-for-node');

var vex = require('vex-js/dist/js/vex.combined.js');
vex.defaultOptions.className = 'vex-theme-plain';
global.vex = vex;

global._ = function (string) {
	return string.toLocaleString();
};

global.l10nstrings = require('./admin.strings.js');

global.d3 = require('d3');
global.Admin = require('admin-src.js');