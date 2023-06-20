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
	_cypressSVGPresentationTest: false,

	initialize: function (map) {
		this._map = map;
		window.app.console.log('L.Map.SlideShow: Cypress in window: ' + ('Cypress' in window));
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
		if (this._cypressSVGPresentationTest) {
			window.open(this._slideURL, '_self');
			return;
		}
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
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);
