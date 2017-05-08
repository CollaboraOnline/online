/*
 * Scroll methods
 */
L.Map.include({
	scroll: function (x, y, options) {
		if (typeof (x) !== 'number' || typeof (y) !== 'number') {
			return;
		}
		this._setUpdateOffsetEvt(options);
		this.panBy(new L.Point(x, y), {animate: false});
	},

	scrollDown: function (y, options) {
		this.scroll(0, y, options);
	},

	scrollRight: function (x, options) {
		this.scroll(x, 0, options);
	},

	scrollOffset: function () {
		var center = this.project(this.getCenter());
		var centerOffset = center.subtract(this.getSize().divideBy(2));
		var offset = {};
		offset.x = centerOffset.x < 0 ? 0 : Math.round(centerOffset.x);
		offset.y = centerOffset.y < 0 ? 0 : Math.round(centerOffset.y);
		return offset;
	},

	scrollTop: function (y, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		console.debug('scrollTop: ' + y + ' ' + offset.y + ' ' + (y - offset.y));
		this.panBy(new L.Point(0, y - offset.y), {animate: false});
	},

	scrollLeft: function (x, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		this.panBy(new L.Point(x - offset.x, 0), {animate: false});
	},

	_setUpdateOffsetEvt: function (e) {
		if (e && e.update === true) {
			this.on('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
		else {
			this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
	},

	fitWidthZoom: function (maxZoom) {
		if (this._docLayer) {
			this._docLayer._fitWidthZoom(null, maxZoom);
		}
	}
});
