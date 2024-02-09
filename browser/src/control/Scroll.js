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
 * Scroll methods
 */

import { Point } from '../geometry/Point';

L.Map.include({
	scroll: function (x, y, options) {
		if (typeof (x) !== 'number' || typeof (y) !== 'number') {
			return;
		}
		this._setUpdateOffsetEvt(options);
		this.panBy(new Point(x, y), {animate: false});
	},

	scrollOffset: function () {
		var center = this.project(this.getCenter());
		var centerOffset = center.subtract(this.getSize().divideBy(2));
		var offset = {};
		offset.x = centerOffset.x < 0 ? 0 : Math.round(centerOffset.x);
		offset.y = Math.round(centerOffset.y);
		return offset;
	},

	scrollTop: function (y, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		window.app.console.debug('scrollTop: ' + y + ' ' + offset.y + ' ' + (y - offset.y));
		this.panBy(new Point(0, y - offset.y), {animate: false});
	},

	scrollLeft: function (x, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		this.panBy(new Point(x - offset.x, 0), {animate: false});
	},

	_setUpdateOffsetEvt: function (e) {
		if (e && e.update === true) {
			this.on('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
		else {
			this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
	},
});
