/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShowPresenter is responsible for presenting the slide show and transitions
 */

/* global _ app */

L.Map.mergeOptions({
	slideShow2: true,
});

L.Map.SlideShowPresenter = L.Handler.extend({
	_presentationInfo: null,
	_docWidth: 0,
	_docHeight: 0,
	_slideCurrent: null,
	_slideNext: null,

	initialize: function (map) {
		this._map = map;
		this.addHooks();
	},

	addHooks: function () {
		this._map.on('start-slide-show', this._onStart, this);
		this._map.on('tilepreview', this._onGotPreview);
	},

	removeHooks: function () {
		this._map.off('start-slide-show', this._onStart, this);
		this._map.off('tilepreview', this._onGotPreview);
	},

	_onStart: function (e) {
		app.socket.sendMessage('getpresentationinfo');
	},

	_onGotPreview: function (e) {
		this._slideCurrent = e.tile;
	},

	initializeSlideShowInfo: function (data) {
		const slides = data.slides;
		const numberOfSlides = slides.length;
		if (numberOfSlides === 0) return;

		this._presentationInfo = data;

		this._docWidth = data.docWidth;
		this._docHeight = data.docHeight;

		this._map.getPreview(1000, 0, this._docWidth, this._docHeight, {
			autoUpdate: false,
		});
		this._map.getPreview(1001, 1, this._docWidth, this._docHeight, {
			autoUpdate: false,
		});
	},
});

L.Map.addInitHook('addHandler', 'slideShowPresenter', L.Map.SlideShowPresenter);
