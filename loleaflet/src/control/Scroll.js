/*
 * Scroll methods
 */
L.Map.include({
	scroll: function (x, y) {
		if (typeof (x) !== 'number' || typeof (y) !== 'number') {
			return;
		}
		this.panBy(new L.Point(x, y), {animate: false});
	},

	scrollDown: function (y) {
		this.scroll(0, y);
	},

	scrollRight: function (x) {
		this.scroll(x, 0);
	}
});
