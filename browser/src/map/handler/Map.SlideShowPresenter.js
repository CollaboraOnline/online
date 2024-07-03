/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShowPresenter is responsible for presenting the slide show and transitions
 */

/* global _ app */


L.Map.mergeOptions({
	slideShowPresenter: true
});

L.Map.SlideShowPresenter = L.Handler.extend({
	_presentationInfo: null,
	_docWidth: 0,
	_docHeight: 0,
	_slideCurrent: null,
	_slideNext: null,

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('newfullscreen', this._onFullScreen, this);
		this._map.on('start-slide-show', this._onStart, this);
		this._map.on('tilepreview', this._onGotPreview);
	},

	removeHooks: function () {
		this._map.off('newfullscreen', this._onFullScreen, this);
		this._map.off('start-slide-show', this._onStart, this);
		this._map.off('tilepreview', this._onGotPreview);
	},

	_onStart: function (e) {
		app.socket.sendMessage('getpresentationinfo');
	},

	_onGotPreview: function (e) {
		this._slideCurrent = e.tile;
	},

	_onFullScreenChange: function () {
		this.fullscreen = document.fullscreenElement;
		if (!this.fullscreen) {
			this._stopFullScreen();
			let canvas = document.getElementById('fullscreen-canvas');
			if (canvas) {
				L.DomUtil.removeChild(canvas);
			}
		}
	},

	_stopFullScreen: function () {
		L.DomUtil.remove(this._slideShow);
		this._slideShow = null;
		// #7102 on exit from fullscreen we don't get a 'focus' event
		// in chome so a later second attempt at launching a presentation
		// fails
		this._map.focus();
	},

	_onFullScreen: function (e) {
		if (this._checkPresentationDisabled()) {
			this._notifyPresentationDisabled();
			return;
		}

		if (this._checkAlreadyPresenting()) {
			this._notifyAlreadyPresenting();
			return;
		}

		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			window.postMobileMessage('SLIDESHOW');
			return;
		}

		if (this._map._docLayer.hiddenSlides() >= this._map.getNumberOfParts()) {
			this._map.uiManager.showInfoModal('allslidehidden-modal', _('Empty Slide Show'),
					'All slides are hidden!', '', _('OK'), function () { }, false, 'allslidehidden-modal-response');
			return;
		}
		
		let doPresentation = function(that, e) {
			that._presentInWindow = false;
			that._startSlideNumber = 0; // Default: start from page 0
			if (typeof e.startSlideNumber !== 'undefined') {
				that._startSlideNumber = e.startSlideNumber;
			}

			// TODO: Need to start Slide from _startSlideNumber

			let canvas = document.getElementById('fullscreen-canvas');
			that._slideShow = canvas;
			
			// TODO: Replace Image here with Scaled Slide Preview
			const image1 = new Image();
			const image2 = new Image();


			/*
				TODO: 
				logic for webgl presentation window. here are initial thoughts

				keep the context and "current slide" texture outside of the class, then on transition load the slide into next texture and add to the transition class as a parameter, 
				the transition class will only do transition from one texture (slide) to another texture and then get destroyed
			*/
			
			image1.onload = () => {
				image2.onload = () => {
					app.definitions.FadeTransition(canvas, image1, image2).start(3);
				};
				image2.src = "images/help/pt-BR/manage-changes-filter.png";
			};
			image1.src = "images/help/pt-BR/paragraph-dialog.png";

			L.DomEvent.on(document, 'fullscreenchange', that._onFullScreenChange, that);
		};
		

		let fallback = function(that, e) {
			// fallback to "open in new tab"
			if (that._slideShow) {
				L.DomUtil.remove(that._slideShow);
				that._slideShow = null;
			}

			doPresentation(that, e);
		};

		if (!(this._cypressSVGPresentationTest || this._map['wopi'].DownloadAsPostMessage)) {
			let canvas = L.DomUtil.create('canvas', 'leaflet-slideshow2', this._map._container);
			this._slideShow = canvas;
			canvas.id = 'fullscreen-canvas';
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			if (canvas.requestFullscreen) {
				let that = this;
				canvas.requestFullscreen()
					.then(function () { doPresentation(that, e); })
					.catch(function () {
						fallback(that, e);
					});
				return;
			}
		}

		fallback(this, e);
	},

	_checkAlreadyPresenting: function() {
		if (this._slideShowWindowProxy && !this._slideShowWindowProxy.closed)
			return true;
		if (this._slideShow)
			return true;
		return false;
	},

	_notifyAlreadyPresenting: function() {
		this._map.uiManager.showInfoModal('already-presenting-modal',
			_('Already presenting'),
			_('You are already presenting this document'), '',
			_('OK'), null, false);
	},

	_checkPresentationDisabled: function() {
		return this._map['wopi'].DisablePresentation;
	},

	_notifyPresentationDisabled: function() {
		this._map.uiManager.showInfoModal('presentation-disabled-modal',
			_('Presentation disabled'),
			_('Presentation mode has been disabled for this document'), '',
			_('OK'), null, false);
	},

	initializeSlideShowInfo: function(data) {
		const slides = data.slides;
		let numberOfSlides = slides.length;
		if (numberOfSlides === 0)
			return;

		this._presentationInfo = data;

		this._docWidth = data.docWidth;
		this._docHeight = data.docHeight;

		this._map.getPreview(1000, 0, this._docWidth, this._docHeight, {autoUpdate: false});
		this._map.getPreview(1001, 1, this._docWidth, this._docHeight, {autoUpdate: false});
	},
});

L.Map.addInitHook('addHandler', 'slideShowPresenter', L.Map.SlideShowPresenter);
