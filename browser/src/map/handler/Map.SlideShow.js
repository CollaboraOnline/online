/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.SlideShow is handling the slideShow action
 */

/* global _ */
L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({

	_slideURL: '', // store the URL for svg
	_presentInWindow: false,
	_cypressSVGPresentationTest: false,
	_slideShowWindowProxy: null,

	initialize: function (map) {
		this._map = map;
		window.app.console.log('L.Map.SlideShow: Cypress in window: ' + ('Cypress' in window));
		this._cypressSVGPresentationTest =
			L.Browser.cypressTest && 'Cypress' in window
			&& window.Cypress.spec.name === 'impress/fullscreen_presentation_spec.js';
	},

	addHooks: function () {
		this._map.on('fullscreen', this._onFullScreen, this);
		this._map.on('presentinwindow', this._onPresentWindow, this);
		this._map.on('slidedownloadready', this._onSlideDownloadReady, this);
	},

	removeHooks: function () {
		this._map.off('fullscreen', this._onFullScreen, this);
		this._map.off('presentinwindow', this._onPresentWindow, this);
		this._map.off('slidedownloadready', this._onSlideDownloadReady, this);
	},

	_onFullScreen: function (e) {
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
			} else {
				// fallback to "open in new tab"
				L.DomUtil.remove(this._slideShow);
				this._slideShow = null;
			}

			L.DomEvent.on(document, 'fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange',
				this._onFullScreenChange, this);
		}

		this._presentInWindow = false;

		this._startSlideNumber = 0; // Default: start from page 0
		if (e.startSlideNumber !== undefined) {
			this._startSlideNumber = e.startSlideNumber;
		}
		this.fullscreen = !this._cypressSVGPresentationTest;
		this._map.downloadAs('slideshow.svg', 'svg', null, 'slideshow');
	},

	_onPresentWindow: function (e) {
		if (this._checkAlreadyPresenting()) {
			this._notifyAlreadyPresenting();
			return;
		}

		this._presentInWindow = true;
		this._startSlideNumber = 0;
		if (e.startSlideNumber !== undefined) {
			this._startSlideNumber = e.startSlideNumber;
		}

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

	_onSlideDownloadReady: function (e) {
		if ('processCoolUrl' in window) {
			e.url = window.processCoolUrl({ url: e.url, type: 'slideshow' });
		}

		this._slideURL = e.url;
		window.app.console.debug('slide file url : ', this._slideURL);

		if ('processCoolUrl' in window) {
			this._processSlideshowLinks();
		}

		this._startPlaying();
	},

	_startPlaying: function() {
		// Windowed Presentation
		if (this._presentInWindow) {
			this._slideShowWindowProxy = window.open(this._slideURL, '_blank', 'popup'); // do we need to set this to null when closed or is that already done?
			if (!this._slideShowWindowProxy) {
				this._map.uiManager.showInfoModal('popup-blocked-modal',
			_('Windowed Presentation Blocked'),
			_('Presentation was blocked. Please allow pop-ups in your browser. This lets slide shows to be displayed in separated windows, allowing for easy screen sharing.'), '',
			_('OK'), null, false);
			}

			this._slideShowWindowProxy.focus();
			this._slideShowWindowProxy.addEventListener('keydown', this._onCloseSlideWindow);

			var slideShowWindow = this._slideShowWindowProxy;
			this._map.uiManager.showSnackbar(_('Presenting in window'),
				_('Close Presentation'), 
				function() {slideShowWindow.close();},
				null /*5000*/, false, true);
			return;
		}
		// Cypress Presentation
		if (this._cypressSVGPresentationTest || !this._slideShow) {
			window.open(this._slideURL, '_self');
			return;
		}
		// Fullscreen Presentation

		this._map.uiManager.showSnackbar(_('Presenting in fullscreen'),
			_('End Presentation'),
			function() {this._stopFullScreen();},
			null, false, true, this._slideShow.contentWindow.body /*Need to pass the html not the object */);

		var separator = (this._slideURL.indexOf('?') === -1) ? '?' : '&';
		this._slideShow.src = this._slideURL + separator + 'StartSlideNumber=' + this._startSlideNumber;
		this._slideShow.contentWindow.focus();
	},

	_processSlideshowLinks: function() {
		var that = this;
		this._slideShow.onload = function onLoadSlideshow() {
			var linkElements = [].slice.call(that._slideShow.contentDocument.querySelectorAll('a'))
				.filter(function(el) {
					return el.getAttribute('href') || el.getAttribute('xlink:href');
				})
				.map(function(el) {
					return {
						el: el,
						link: el.getAttribute('href') || el.getAttribute('xlink:href'),
						parent: el.parentNode
					};
				});

			var setAttributeNs = function(el, link) {
				link = window.processCoolUrl({ url: link, type: 'slide' });

				el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', link);
				el.setAttribute('target', '_blank');
			};

			linkElements.forEach(function(item) {
				setAttributeNs(item.el, item.link);

				var parentLink = item.parent.getAttribute('xlink:href');

				if (parentLink) {
					setAttributeNs(item.parent, parentLink);
				}

				item.parent.parentNode.insertBefore(item.parent.cloneNode(true), item.parent.nextSibling);
				item.parent.parentNode.removeChild(item.parent);
			});
		};
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

	_onCloseSlideWindow: function(e) {
		if (e.code === 'Escape') {
			this.opener.focus();
			this.close();
			this._map.uiManager.closeSnackbar();
		}
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
