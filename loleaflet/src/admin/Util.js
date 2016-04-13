/*
	Utility class
*/
/* global Base */
/* eslint no-unused-vars:0 */
var Util = Base.extend({
	constructor: null

}, { // class itnerface

	humanizeMem: function (kbytes) {
		var unit = 1000;
		var units = ['kB', 'MB', 'GB', 'TB'];
		for (var i = 0; Math.abs(kbytes) >= unit && i < units.length; i++) {
			kbytes /= unit;
		}

		return kbytes.toFixed(1) + ' ' + units[i];
	},

	humanizeSecs: function(secs) {
		var mins = 0;
		var hrs = 0;
		var res = '';

		secs = parseInt(secs);
		if (isNaN(secs)) {
			return res;
		}

		if (secs >= 60) {
			mins = Math.floor(secs / 60);
			secs = secs - mins * 60;
		}
		if (mins >= 60) {
			hrs = Math.floor(mins / 60);
			mins = mins - hrs * 60;
		}

		if (hrs) {
			res = hrs + ':' + mins + ' hrs';
		} else if (mins) {
			res = mins + ':' + secs + ' mins';
		} else if (secs) {
			res = secs + ' s';
		} else {
			res = '';
		}

		return res;
	}
});
