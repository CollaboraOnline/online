/* -*- js-indent-level: 8 -*- */
// CSS requires

var $ = require('jquery');
global.$ = global.jQuery = $;

require('json-js/json2');
require('l10n-for-node');

global._ = function (string) {
	return string.toLocaleString();
};

global.l10nstrings = require('./admin.strings.js');

global.d3 = require('d3');
global.Admin = require('admin-src.js');