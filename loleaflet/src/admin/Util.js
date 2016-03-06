/*
	Utility class
*/
/* global Base */
var Util = Base.extend({
	constructor: null

}, { // class itnerface

	humanize: function humanFileSize(kbytes) {
		var unit = 1000;
		var units = ['kB', 'MB', 'GB', 'TB'];
		for (var i = 0; Math.abs(kbytes) >= unit && i < units.length; i++) {
			kbytes /= unit;
		}

		return kbytes.toFixed(1) + ' ' + units[i];
	}
});
