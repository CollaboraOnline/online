/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShow is handling the slideShow action
 */

/* global SlideShow */
L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({
	_aSlideShowInstance: null,

	initialize: function (map) {
		this._aSlideShowInstance = new SlideShow(map);
	},

	addHooks: function () {
		this._aSlideShowInstance.addHooks();
	},

	removeHooks: function () {
		this._aSlideShowInstance.removeHooks();
	},

	isFullscreen: function() {
		return this._aSlideShowInstance.isFullscreen();
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
