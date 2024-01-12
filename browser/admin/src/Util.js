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
/*
 * Utility class
 */

/* global Base _ */

/* eslint no-unused-vars:0 */

var Util = Base.extend({
	constructor: null

}, { // class interface

	humanizeMem: function (kbytes) {
		var unit = 1000;
		var units = [_('kB'), _('MB'), _('GB'), _('TB'), _('PB'), _('EB'), _('ZB'), _('YB'), _('BB')];
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
			if (mins < 10) {
				res = hrs + ':0' + mins + _(' hrs');
			} else {
				res = hrs + ':' + mins + _(' hrs');
			}
		} else if (mins) {
			if (secs < 10) {
				res = mins + ':0' + secs + _(' mins');
			} else {
				res = mins + ':' + secs + _(' mins');
			}
		} else if (secs) {
			res = secs + _(' s');
		} else {
			res = '';
		}

		return res;
	}
});
