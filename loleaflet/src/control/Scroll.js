/*
 * Scroll methods
 */
L.Map.include({
	scroll: function (x, y) {
		if (typeof (x) !== 'number' || typeof (y) !== 'number') {
			return;
		}
		this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		this.panBy(new L.Point(x, y), {animate: false});
	},

	scrollDown: function (y) {
		this.scroll(0, y);
	},

	scrollRight: function (x) {
		this.scroll(x, 0);
	},

	scrollOffset: function () {
		var center = this.project(this.getCenter());
		var centerOffset = center.subtract(this.getSize().divideBy(2));
		var offset = {};
		offset.x = centerOffset.x < 0 ? 0 : Math.round(centerOffset.x);
		offset.y = centerOffset.y < 0 ? 0 : Math.round(centerOffset.y);
		return offset;
	},

	scrollTop: function (y) {
		var offset = this.scrollOffset();
		this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		this.panBy(new L.Point(0, y - offset.y), {animate: false});
	},

	scrollLeft: function (x) {
		var offset = this.scrollOffset();
		this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		this.panBy(new L.Point(x - offset.x, 0), {animate: false});
	}
});
