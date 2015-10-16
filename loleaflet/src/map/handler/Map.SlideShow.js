/*
 * L.Map.SlideShow is handling the slideShow action
 */

L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
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
		this._container = L.DomUtil.create('div', '', this._map._container);
		this._slideShow = L.DomUtil.create('img', 'slide-show', this._container);
		if (this._slideShow.requestFullscreen) {
		  this._container.requestFullscreen();
		}
		else if (this._slideShow.msRequestFullscreen) {
		  this._container.msRequestFullscreen();
		}
		else if (this._slideShow.mozRequestFullScreen) {
		  this._container.mozRequestFullScreen();
		}
		else if (this._slideShow.webkitRequestFullscreen) {
		  this._container.webkitRequestFullscreen();
		}

		L.DomEvent['on'](document, 'fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange',
				this._onFullScreenChange, this);

		this.fullscreen = true;
		this._getSlides();
	},

	_onFullScreenChange: function (e) {

		this.fullscreen = document.fullscreen ||
			document.webkitIsFullScreen ||
			document.mozFullScreen ||
			document.msFullscreenElement;
		if (!this.fullscreen) {
			L.DomUtil.remove(this._container);
		}
	},

	_getSlides: function () {
		this._currentSlide = 0;
		this._slides = [];
		for (var i = 0; i < this._map.getNumberOfParts(); i++) {
			// mark the i-th slide as not available yet
			this._slides.push(null);
		}

		for (var i = 0; i < this._map.getNumberOfParts(); i++) {
			L.Socket.sendMessage('downloadas name=' + i + '.svg id=slideshow ' +
					'part=' + i + ' format=svg options=');
		}
	},

	_onSlideDownloadReady: function (e) {
		var xmlHttp = new XMLHttpRequest();
		var part = e.part;
		xmlHttp.onreadystatechange = L.bind(function () {
			if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
				var blob = new Blob([xmlHttp.response], {type: 'image/svg+xml'});
				var url = URL.createObjectURL(blob);
				this._slides[part] = url;
				if (part === this._currentSlide) {
					this._slideShow.src = url;
				}
			}
		}, this);
		xmlHttp.open('GET', e.url, true);
		xmlHttp.responseType = 'blob';
		xmlHttp.send();
	},

	_onUserInput: function (e) {
		if (e.type === 'mousedown' || (e.type === 'keydown' &&
					e.originalEvent.keyCode === 39)) {
			this._currentSlide = Math.min(this._currentSlide + 1, this._map.getNumberOfParts() - 1);
		}
		else if (e.type === 'keydown' && e.originalEvent.keyCode === 37) {
			this._currentSlide = Math.max(this._currentSlide - 1, 0);
		}
		else {
			return;
		}
		this._slideShow.src = this._slides[this._currentSlide];
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
