/* -*- js-indent-level: 8 -*- */
// CSS requires
require('bootstrap/dist/css/bootstrap.css');
require('./bootstrap/ie10-viewport-bug-workaround.css');
require('./bootstrap/dashboard.css');
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
require('bootstrap/dist/js/bootstrap.js');
require('./bootstrap/holder.min.js');
require('./bootstrap/ie10-viewport-bug-workaround.js');
global.Admin = require('admin-src.js');
