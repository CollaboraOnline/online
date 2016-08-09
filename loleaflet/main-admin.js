// CSS requires
require('./node_modules/bootstrap/dist/css/bootstrap.css');
require('./dist/admin/bootstrap/ie10-viewport-bug-workaround.css');
require('./dist/admin/bootstrap/dashboard.css');
require('./node_modules/vex-js/css/vex.css');
require('./node_modules/vex-js/css/vex-theme-plain.css');

var $ = require('jquery');
global.$ = global.jQuery = $;

require('json-js/json2');
require('l10n-for-node');

var vex = require('vex-js');
vex.dialog = require('vex-js/js/vex.dialog.js');
vex.defaultOptions.className = 'vex-theme-plain';
global.vex = vex;

global._ = function (string) {
	return string.toLocaleString();
};

global.l10nstrings = require('./admin.strings.js');

global.d3 = require('d3');
require('bootstrap/dist/js/bootstrap.js');
require('./dist/admin/bootstrap/holder.min.js');
require('./dist/admin/bootstrap/ie10-viewport-bug-workaround.js');
global.Admin = require('./dist/admin/admin-src.js');
