/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShow is handling the slideShow action
 */

/* global _ app */
L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({

	_presentInWindow: false,
	_slideShowWindowProxy: null,
	_slideShowInfo: {},
	_firstSlideHash: '',
	_lastSlideHash: '',
	_requestedSlideHash: '',
	_displayedSlideHash: '',
	_canvasWidth: 960,
	_canvasHeight: 540,
	_cachedBackgrounds: {},
	_cachedMasterPages: {},
	_cachedDrawPages: {},
	_offscreenCanvas: null,
	_offscreenContext: null,
	_currentCanvas: null,
	_currentCanvasContext: null,

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('fullscreen', this._onFullScreen, this);
		this._map.on('presentinwindow', this._onPresentWindow, this);
		this._map.on('sliderenderingcomplete', this._onSlideRenderingComplete, this);
	},

	removeHooks: function () {
		this._map.off('fullscreen', this._onFullScreen, this);
		this._map.off('presentinwindow', this._onPresentWindow, this);
		this._map.off('sliderenderingcomplete', this._onSlideRenderingComplete, this);
	},

	initializeSlideShowInfo: function(slides) {
		window.app.console.log('SlideShow.initializeSlideShowInfo: slide count: ' + slides.length);
		let numberOfSlides = slides.length;
		if (numberOfSlides === 0)
			return;
		this._firstSlideHash = slides[0].hash;
		this._lastSlideHash = slides[numberOfSlides - 1].hash;

		let prevSlideHash = this._lastSlideHash;
		for (let i = 0; i < numberOfSlides; ++i) {
			const slide = slides[i];
			this._slideShowInfo[slide.hash] = {
				index: slide.index,
				empty: slide.empty,
				masterPage: slide.masterPage,
				masterPageObjectsVisible: slide.masterPageObjectsVisible || false,
				background: slide.background,
				prev: prevSlideHash,
				next: i+1 < numberOfSlides ? slides[i+1].hash : this._firstSlideHash
			};
			prevSlideHash = slide.hash;
		}
		this._map.fire('slideshowinforeceived');
	},

	_requestSlideShowInfo: function() {
		app.socket.sendMessage('getslideshowinfo');
	},

	_onPresentWindow: function (e) {
		if (this._checkPresentationDisabled()) {
			this._notifyPresentationDisabled();
			return;
		}

		if (this._checkAlreadyPresenting()) {
			this._notifyAlreadyPresenting();
			return;
		}

		this._presentInWindow = true;
		this._startSlideNumber = 0;
		if (e.startSlideNumber !== undefined) {
			this._startSlideNumber = e.startSlideNumber;
		}

		this._startSlideShow();
	},

	_startSlideShow: function() {
		this._computeInitialCanvasSize();
		window.app.console.log('SlideShow._startSlideShow: canvas width: ' + this._canvasWidth + ', height: ' + this._canvasHeight);
		this._initialSlide = true;
		this._offscreenCanvas = new OffscreenCanvas(this._canvasWidth, this._canvasHeight);
		this._offscreenContext = this._offscreenCanvas.getContext('2d');

		this._map.on('slideshowinforeceived', this._requestInitialSlide, this);
		this._requestSlideShowInfo();
	},

	_requestInitialSlide: function() {
		this._map.off('slideshowinforeceived', this._requestInitialSlide, this);
		this._requestSlide(this._firstSlideHash);
	},

	_requestSlide: function(slideHash) {
		window.app.console.log('SlideShow._requestSlide: ' + slideHash);
		this._requestedSlideHash = slideHash;
		const slideInfo = this._slideShowInfo[slideHash];
		if (!slideInfo) {
			window.app.console.log('SlideShow._requestSlide: No info for requested slide: hash: ' + slideHash);
			return;
		}

		if (!this._offscreenContext) {
			window.app.console.log('SlideShow._requestSlide: No offscreen context initialized');
			return;
		}

		this._offscreenContext.clearRect(0, 0, this._canvasWidth, this._canvasHeight);

		const backgroundRendered = this._drawBackground(slideHash);
		const masterPageRendered = this._drawMasterPage(slideHash);
		if (backgroundRendered && masterPageRendered) {
			if (this._drawDrawPage(slideHash)) {
				this._onSlideRenderingComplete();
				return;
			}
		}

		window.app.console.log(`getslide hash=${slideHash} width=${this._canvasWidth} height=${this._canvasHeight} ` +
			`renderBackground=${!backgroundRendered} renderMasterPage=${!masterPageRendered}`);

		// app.socket.sendMessage(
		// 	`getslide hash=${slideHash} width=${this._canvasWidth} height=${this._canvasHeight} ` +
		// 	`renderBackground=${!backgroundRendered} renderMasterPage=${!masterPageRendered}`);
	},

	_drawSlide: function(hash) {
		const slideInfo = this._slideShowInfo[hash];
		if (!slideInfo) {
			window.app.console.log('No info for requested slide: hash: ' + hash);
			return;
		}

		this._drawBackground(hash);
		this._drawMasterPage(hash);
		this._drawDrawPage(hash);
	},

	_drawBackground: function(slideHash) {
		const slideInfo = this._slideShowInfo[slideHash];
		if (!slideInfo.background)
			return true;

		if (slideInfo.background.fillColor) {
			this._offscreenContext.fillStyle = '#' + slideInfo.background.fillColor;
			window.app.console.log('SlideShow._drawBackground: ' + this._offscreenContext.fillStyle);
			this._offscreenContext.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
			return true;
		}

		let backgroundHash = slideInfo.background.hash;
		if (!backgroundHash) {
			const masterPageLayers = this._cachedMasterPages[slideInfo.masterPage];
			if (masterPageLayers) {
				backgroundHash = masterPageLayers.backgroundHash;
			}
		}
		if (!backgroundHash)
			return false;

		const background = this._cachedBackgrounds[backgroundHash];
		if (!background) {
			window.app.console.log('No cached background: slide hash: ' + slideHash);
			return false;
		}

		this._drawBitmap(background);
		return true;
	},

	_drawMasterPage: function(slideHash) {
		const slideInfo = this._slideShowInfo[slideHash];
		if (!slideInfo.masterPageObjectsVisible)
			return true;

		const masterPageLayers = this._cachedMasterPages[slideInfo.masterPage];
		if (!masterPageLayers) {
			window.app.console.log('No layer cached for master page: ' + slideInfo.masterPage);
			return false;
		}

		for (let i = 0; i < masterPageLayers.length; ++i) {
			if (masterPageLayers[i].type === 'bitmap') {
				this._drawBitmap(masterPageLayers[i].image);
			}
		}
		return true;
	},

	_drawDrawPage: function(slideHash) {
		const slideInfo = this._slideShowInfo[slideHash];
		if (slideInfo.empty) {
			return true;
		}

		const pageLayers = this._cachedDrawPages[slideHash];
		if (!pageLayers) {
			window.app.console.log('No layer cached for draw page: ' + slideHash);
			return false;
		}

		for (let i = 0; i < pageLayers.length; ++i) {
			if (pageLayers[i].type === 'bitmap') {
				this._drawBitmap(pageLayers[i].image);
			}
		}
		return true;
	},

	_drawBitmap: function(image) {
		window.app.console.log('SlideShow._drawBitmap: ' + image);
	},

	_onSlideRenderingComplete: function() {
		if (this._initialSlide) {
			this._initialSlide = false;
			this._startPlaying();
		}
		this._showRenderedSlide();
	},

	_startPlaying: function() {
		// Windowed Presentation
		if (this._presentInWindow) {
			window.app.console.log('SlideShow._startPlaying');
			var popupTitle = _('Windowed Presentation: ') + this._map['wopi'].BaseFileName;
			const htmlContent = this.generateSlideWindowHtml(popupTitle);

			this._slideShowWindowProxy = window.open('', '_blank', 'popup');

			// this._slideShowWindowProxy.addEventListener('load', this._handleSlideWindowLoaded.bind(this), false);

			if (!this._slideShowWindowProxy) {
				this._map.uiManager.showInfoModal('popup-blocked-modal',
					_('Windowed Presentation Blocked'),
					_('Presentation was blocked. Please allow pop-ups in your browser. This lets slide shows to be displayed in separated windows, allowing for easy screen sharing.'), '',
					_('OK'), null, false);
			}

			this._slideShowWindowProxy.document.documentElement.innerHTML = htmlContent;
			this._slideShowWindowProxy.document.close();
			this._slideShowWindowProxy.focus();

			const canvas = this._slideShowWindowProxy.document.getElementById('canvas');
			if (!canvas) {
				window.app.console.log('SlideShow._startPlaying: no canvas element found');
				return;
			}
			canvas.width = this._canvasWidth;
			canvas.height = this._canvasHeight;

			const ctx = canvas.getContext("bitmaprenderer");
			if (!ctx) {
				window.app.console.log('SlideShow._startPlaying: can not get a valid context for current canvas');
				return;
			}
			this._currentCanvas = canvas;
			this._currentCanvasContext = ctx;

			this._slideShowWindowProxy.addEventListener('keydown', this._onSlideWindowKeyPress.bind(this));
			this._slideShowWindowProxy.addEventListener('resize', this._onSlideWindowResize.bind(this));

			this._centerCanvasInSlideWindow();
		}
	},

	_showRenderedSlide: function() {
		if (!this._offscreenCanvas) {
			window.app.console.log('SlideShow._showRenderedSlide: no offscreen canvas available.');
			return;
		}
		if (!this._currentCanvasContext) {
			window.app.console.log('SlideShow._showRenderedSlide: no valid context for current canvas');
			return;
		}

		this._displayedSlideHash = this._requestedSlideHash;
		const bitmap = this._offscreenCanvas.transferToImageBitmap();
		this._currentCanvasContext.transferFromImageBitmap(bitmap);
	},

	generateSlideWindowHtml: function(title) {
		window.app.console.log('SlideShow.generateSlideWindowHtml: title: ' + title);

		var sanitizer = document.createElement('div');
		sanitizer.innerText = title;
		var sanitizedTitle = sanitizer.innerHTML;

		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${sanitizedTitle}</title>
			<style>
				body, html {
					margin: 0;
					padding: 0;
					height: 100%;
					overflow: hidden; /* Prevent scrollbars */
				}
		        .vertical-center {
					margin: 0;
					position: absolute;
					width: 100%;
					top: 50%;
					/*-ms-transform: translateY(-50%);*/
					transform: translateY(-50%);
				}
				.horizontal-center {
					margin: 0;
					position: absolute;
					height: 100%;
					left: 50%;
					/*-ms-transform: translateY(-50%);*/
					transform: translateX(-50%);
				}
			</style>
		</head>
		<body>
			<canvas id="canvas"></canvas>
		</body>
		</html>
		`;
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
			// that.fullscreen = !that._cypressSVGPresentationTest;
			that._map.downloadAs('slideshow.svg', 'svg', null, 'slideshow');

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

		this._slideShow = L.DomUtil.create('iframe', 'leaflet-slideshow', this._map._container);
		if (this._slideShow.requestFullscreen) {

			let that = this;
			this._slideShow.requestFullscreen()
				.then(function () { doPresentation(that, e); })
				.catch(function () {
					fallback(that, e);
				});

			return;
		}

		fallback(this, e);
	},

	_onFullScreenChange: function () {
		// if (this._map['wopi'].DownloadAsPostMessage) {
		// 	return;
		// }

		this.fullscreen = document.fullscreenElement;
		if (!this.fullscreen) {
			this._stopFullScreen();
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

	_handleSlideWindowLoaded: function() {
		window.app.console.log('SlideShow._handleSlideWindowLoaded');
	},

	_computeInitialCanvasSize: function() {
		let viewWidth = window.innerWidth;
		let viewHeight = window.innerHeight;
		if (!this._presentInWindow) {
			viewWidth = window.screen.width;
			viewHeight = window.screen.height;
		}
		this._computeCanvasSize(viewWidth, viewHeight)
	},

	_computeCanvasSize: function(viewWidth, viewHeight) {
		viewWidth *= 1.20;
		viewHeight *= 1.20;

		if (viewWidth > 1920 || viewHeight > 1080) {
			this._canvasWidth = 1920;
			this._canvasHeight = 1080
		}
		else if (viewWidth > 1280 || viewHeight > 720) {
			this._canvasWidth = 1280;
			this._canvasHeight = 720
		}
		else if (viewWidth > 960 || viewHeight > 540) {
			this._canvasWidth = 940;
			this._canvasHeight = 540;
		}
		else {
			this._canvasWidth = 640;
			this._canvasHeight = 360;
		}
	},

	_centerCanvasInSlideWindow: function() {
		const winWidth = this._slideShowWindowProxy.innerWidth;
		const winHeight = this._slideShowWindowProxy.innerHeight;
		if (winWidth * this._canvasHeight < winHeight * this._canvasWidth) {
			this._currentCanvas.className = 'vertical-center';
		} else {
			this._currentCanvas.className = 'horizontal-center';
		}
	},

	_onSlideWindowResize: function() {
		window.app.console.log('SlideShow._onSlideWindowResize');
		this._centerCanvasInSlideWindow();
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

	_onSlideWindowKeyPress: function(e) {
		window.app.console.log('SlideShow._onSlideWindowKeyPress: ' + e.code);
		if (e.code === 'Escape') {
			this._slideShowWindowProxy.opener.focus();
			this._slideShowWindowProxy.close();
			this._map.uiManager.closeSnackbar();
		}
		else if (e.code === 'ArrowRight') {
			const slideInfo = this._slideShowInfo[this._displayedSlideHash];
			this._requestSlide(slideInfo.next);
		}
		else if (e.code === 'ArrowLeft') {
			const slideInfo = this._slideShowInfo[this._displayedSlideHash];
			this._requestSlide(slideInfo.prev);
		}
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
