/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShow is handling the slideShow action
 */

L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({

	_slideURL: '', // store the URL for svg
	_cypressSVGPresentationTest: false,

	initialize: function (map) {
		this._map = map;
		console.log('L.Map.SlideShow: Cypress in window: ' + ('Cypress' in window));
		this._cypressSVGPresentationTest =
			L.Browser.cypressTest && 'Cypress' in window
			&& window.Cypress.spec.name === 'impress/fullscreen_presentation_spec.js';
	},

	addHooks: function () {
		this._map.on('fullscreen', this._onFullScreen, this);
		this._map.on('slidedownloadready', this._onSlideDownloadReady, this);
	},

	removeHooks: function () {
		this._map.off('fullscreen', this._onFullScreen, this);
		this._map.off('slidedownloadready', this._onSlideDownloadReady, this);
	},

	_onFullScreen: function (e) {
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			window.postMobileMessage('SLIDESHOW');
			return;
		}

		if (!this._cypressSVGPresentationTest && !this._map['wopi'].DownloadAsPostMessage) {
			this._slideShow = L.DomUtil.create('iframe', 'leaflet-slideshow', this._map._container);
			if (this._slideShow.requestFullscreen) {
				this._slideShow.requestFullscreen();
			}
			else if (this._slideShow.msRequestFullscreen) {
				this._slideShow.msRequestFullscreen();
			}
			else if (this._slideShow.mozRequestFullScreen) {
				this._slideShow.mozRequestFullScreen();
			}
			else if (this._slideShow.webkitRequestFullscreen) {
				this._slideShow.webkitRequestFullscreen();
			}

			L.DomEvent.on(document, 'fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange',
				this._onFullScreenChange, this);
		}

		this._startSlideNumber = 0; // Default: start from page 0
		if (e.startSlideNumber !== undefined) {
			this._startSlideNumber = e.startSlideNumber;
		}
		this.fullscreen = !this._cypressSVGPresentationTest;
		this._map.downloadAs('slideshow.svg', 'svg', null, 'slideshow');
	},

	_onFullScreenChange: function () {
		if (this._map['wopi'].DownloadAsPostMessage) {
			return;
		}

		this.fullscreen = document.fullscreenElement ||
			document.webkitIsFullScreen ||
			document.mozFullScreen ||
			document.msFullscreenElement;
		if (!this.fullscreen) {
			L.DomUtil.remove(this._slideShow);
		}
	},

	_onSlideDownloadReady: function (e) {
		this._slideURL = e.url;
		console.debug('slide file url : ', this._slideURL);
		this._startPlaying();
	},

	_startPlaying: function() {
		if (this._cypressSVGPresentationTest) {
			window.open(this._slideURL, '_self');
			return;
		}
		var separator = (this._slideURL.indexOf('?') === -1) ? '?' : '&';
		this._slideShow.src = this._slideURL + separator + 'StartSlideNumber=' + this._startSlideNumber;
		this._slideShow.contentWindow.focus();
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
