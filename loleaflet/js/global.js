/* -*- js-indent-level: 8 -*- */
(function (global) {

	var ua = navigator.userAgent.toLowerCase(),
	    uv = navigator.vendor.toLowerCase(),
	    doc = document.documentElement,

	    ie = 'ActiveXObject' in window,

	    webkit    = ua.indexOf('webkit') !== -1,
	    phantomjs = ua.indexOf('phantom') !== -1,
	    android23 = ua.search('android [23]') !== -1,
	    chrome    = ua.indexOf('chrome') !== -1,
	    gecko     = ua.indexOf('gecko') !== -1  && !webkit && !window.opera && !ie,
	    safari    = !chrome && (ua.indexOf('safari') !== -1 || uv.indexOf('apple') == 0),

	    win = navigator.platform.indexOf('Win') === 0,

	    mobile = typeof orientation !== 'undefined' || ua.indexOf('mobile') !== -1,
	    cypressTest = ua.indexOf('cypress') !== -1,
	    msPointer = !window.PointerEvent && window.MSPointerEvent,
	    pointer = (window.PointerEvent && navigator.pointerEnabled && navigator.maxTouchPoints) || msPointer,

	    ie3d = ie && ('transition' in doc.style),
	    webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23,
	    gecko3d = 'MozPerspective' in doc.style,
	    opera12 = 'OTransition' in doc.style;

	var touch = !window.L_NO_TOUCH && (pointer || 'ontouchstart' in window ||
			(window.DocumentTouch && document instanceof window.DocumentTouch));

	var isInternetExplorer = (navigator.userAgent.toLowerCase().indexOf('msie') != -1 ||
			navigator.userAgent.toLowerCase().indexOf('trident') != -1);

	global.L = {};
	global.L.Browser = {

		// @property ie: Boolean
		// `true` for all Internet Explorer versions (not Edge).
		ie: ie,

		// @property ielt9: Boolean
		// `true` for Internet Explorer versions less than 9.
		ielt9: ie && !document.addEventListener,

		// @property edge: Boolean
		// `true` for the Edge web browser.
		edge: 'msLaunchUri' in navigator && !('documentMode' in document),

		// @property webkit: Boolean
		// `true` for webkit-based browsers like Chrome and Safari (including mobile versions).
		webkit: webkit,

		// @property gecko: Boolean
		// `true` for gecko-based browsers like Firefox.
		gecko: gecko,

		// @property android: Boolean
		// `true` for any browser running on an Android platform.
		android: ua.indexOf('android') !== -1,

		// @property android23: Boolean
		// `true` for browsers running on Android 2 or Android 3.
		android23: android23,

		// @property chrome: Boolean
		// `true` for the Chrome browser.
		chrome: chrome,

		// @property safari: Boolean
		// `true` for the Safari browser.
		safari: safari,

		// @property win: Boolean
		// `true` when the browser is running in a Windows platform
		win: win,

		// @property ie3d: Boolean
		// `true` for all Internet Explorer versions supporting CSS transforms.
		ie3d: ie3d,

		// @property isInternetExplorer: Boolean
		// `true` for Internet Explorer
		isInternetExplorer: isInternetExplorer,

		// @property webkit3d: Boolean
		// `true` for webkit-based browsers supporting CSS transforms.
		webkit3d: webkit3d,

		// @property gecko3d: Boolean
		// `true` for gecko-based browsers supporting CSS transforms.
		gecko3d: gecko3d,

		// @property opera12: Boolean
		// `true` for the Opera browser supporting CSS transforms (version 12 or later).
		opera12: opera12,

		// @property any3d: Boolean
		// `true` for all browsers supporting CSS transforms.
		any3d: !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantomjs,


		// @property mobile: Boolean
		// `true` for all browsers running in a mobile device.
		mobile: mobile,

		// @property mobileWebkit: Boolean
		// `true` for all webkit-based browsers in a mobile device.
		mobileWebkit: mobile && webkit,

		// @property mobileWebkit3d: Boolean
		// `true` for all webkit-based browsers in a mobile device supporting CSS transforms.
		mobileWebkit3d: mobile && webkit3d,

		// @property mobileOpera: Boolean
		// `true` for the Opera browser in a mobile device.
		mobileOpera: mobile && window.opera,

		// @property mobileGecko: Boolean
		// `true` for gecko-based browsers running in a mobile device.
		mobileGecko: mobile && gecko,

		// @property cypressTest: Boolean
		// `true` when the browser run by cypress
		cypressTest: cypressTest,

		// @property touch: Boolean
		// `true` for all browsers supporting [touch events](https://developer.mozilla.org/docs/Web/API/Touch_events).
		touch: !!touch,

		// @property msPointer: Boolean
		// `true` for browsers implementing the Microsoft touch events model (notably IE10).
		msPointer: !!msPointer,

		// @property pointer: Boolean
		// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
		pointer: !!pointer,

		// @property retina: Boolean
		// `true` for browsers on a high-resolution "retina" screen.
		retina: (window.devicePixelRatio || (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1
	};

	global.mode = {
		// Here "mobile" means "mobile phone" (at least for now). Has to match small screen size
		// requirement.
		isMobile: function() {
			if (L.Browser.mobile && L.Browser.cypressTest) {
				return true;
			}

			return L.Browser.mobile && (screen.width < 768 || screen.height < 768);
		},
		// Mobile device with big screen size.
		isTablet: function() {
			return L.Browser.mobile && !window.mode.isMobile();
		},
		isDesktop: function() {
			return !L.Browser.mobile;
		}
	};

	document.addEventListener('contextmenu', function(e) {
		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
	}, false);

	global.fakeWebSocketCounter = 0;
	global.FakeWebSocket = function () {
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.protocol = '';
		this.readyState = 1;
		this.id = window.fakeWebSocketCounter++;
		this.sendCounter = 0;
		this.onclose = function() {
		};
		this.onerror = function() {
		};
		this.onmessage = function() {
		};
		this.onopen = function() {
		};
	};

	global.FakeWebSocket.prototype.close = function() {
	};

	global.FakeWebSocket.prototype.send = function(data) {
		this.sendCounter++;
		window.postMobileMessage(data);
	};

	// If not debug, don't print anything on the console
	// except in tile debug mode (Ctrl-Shift-Alt-d)
	console.log2 = console.log;
	if (global.loleafletLogging !== 'true') {
		var methods = ['warn', 'info', 'debug', 'trace', 'log', 'assert', 'time', 'timeEnd'];
		for (var i = 0; i < methods.length; i++) {
			console[methods[i]] = function() {};
		}
	} else {
		window.onerror = function (msg, src, row, col, err) {
			var data = {
				userAgent: navigator.userAgent.toLowerCase(),
				vendor: navigator.vendor.toLowerCase(),
				message: msg,
				source: src,
				line: row,
				column: col
			};
			var desc = err ? err.message || {}: {}, stack = err ? err.stack || {}: {};
			var log = 'jserror ' + JSON.stringify(data, null, 2) + '\n' + desc + '\n' + stack + '\n';
			if (window.ThisIsAMobileApp) {
				window.postMobileError(log);
			} else if (global.socket && (global.socket instanceof WebSocket) && global.socket.readyState === 1) {
				global.socket.send(log);
			} else if (global.socket && (global.socket instanceof global.L.Socket) && global.socket.connected()) {
				global.socket.sendMessage(log);
			} else {
				var req = new XMLHttpRequest();
				var url = global.location.protocol + '//' + global.location.host + global.location.pathname.match(/.*\//) + 'logging.html';
				req.open('POST', url, true);
				req.setRequestHeader('Content-type','application/json; charset=utf-8');
				req.send(log);
			}

			return false;
		};
	}

	// fix jquery-ui
	// var jQuery = require('jquery');
	global.require = function (path) {
		if (path=='jquery') {
			return global.jQuery;
		}
	};

	global.getParameterByName = function (name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : results[1].replace(/\+/g, ' ');
	};

	global._ = function (string) {
		// In the mobile app case we can't use the stuff from l10n-for-node, as that assumes HTTP.
		if (window.ThisIsAMobileApp) {
			// We use another approach just for iOS for now.
			if (window.LOCALIZATIONS && window.LOCALIZATIONS.hasOwnProperty(string)) {
				// window.postMobileDebug('_(' + string + '): YES: ' + window.LOCALIZATIONS[string]);
				var result = window.LOCALIZATIONS[string];
				if (window.LANG === 'de-CH') {
					result = result.replace(/ß/g, 'ss');
				}
				return result;
			} else {
				// window.postMobileDebug('_(' + string + '): NO');
				return string;
			}
		} else {
			return string.toLocaleString();
		}
	};

	var docParams, wopiParams;
	var filePath = global.getParameterByName('file_path');
	var wopiSrc = global.getParameterByName('WOPISrc');
	if (wopiSrc != '') {
		global.docURL = decodeURIComponent(wopiSrc);
		wopiSrc = '?WOPISrc=' + wopiSrc + '&compat=/ws';
		if (global.accessToken !== '') {
			wopiParams = { 'access_token': global.accessToken, 'access_token_ttl': global.accessTokenTTL };
		}
		else if (global.accessHeader !== '') {
			wopiParams = { 'access_header': global.accessHeader };
		}
		docParams = Object.keys(wopiParams).map(function(key) {
			return encodeURIComponent(key) + '=' + encodeURIComponent(wopiParams[key]);
		}).join('&');
	} else {
		global.docURL = filePath;
	}

	if (window.ThisIsAMobileApp) {
		global.socket = new global.FakeWebSocket();
		window.TheFakeWebSocket = global.socket;
	} else {
		var websocketURI = global.host + global.serviceRoot + '/lool/' + encodeURIComponent(global.docURL + (docParams ? '?' + docParams : '')) + '/ws' + wopiSrc;

		try {
			global.socket = new WebSocket(websocketURI);
		} catch (err) {
			console.log(err);
		}
	}

	var lang = global.getParameterByName('lang');
	global.queueMsg = [];
	if (window.ThisIsAMobileApp)
		window.LANG = lang;
	if (global.socket && global.socket.readyState !== 3) {
		global.socket.onopen = function () {
			if (global.socket.readyState === 1) {
				var ProtocolVersionNumber = '0.1';
				var timestamp = global.getParameterByName('timestamp');
				var msg = 'load url=' + encodeURIComponent(global.docURL);

				global.socket.send('loolclient ' + ProtocolVersionNumber);

				if (window.ThisIsAMobileApp) {
					msg += ' lang=' + window.LANG;
				} else {

					if (timestamp) {
						msg += ' timestamp=' + timestamp;
					}
					if (lang) {
						msg += ' lang=' + lang;
					}
					// renderingOptions?
				}
				global.socket.send(msg);
			}
		};

		global.socket.onerror = function (event) {
			console.log(event);
		};

		global.socket.onclose = function (event) {
			console.log(event);
		};

		global.socket.onmessage = function (event) {
			if (typeof global.socket._onMessage === 'function') {
				global.socket._emptyQueue();
				global.socket._onMessage(event);
			} else {
				global.queueMsg.push(event.data);
			}
		};

		global.socket.binaryType = 'arraybuffer';

		if (window.ThisIsAMobileApp) {
			// This corresponds to the initial GET request when creating a WebSocket
			// connection and tells the app's code that it is OK to start invoking
			// TheFakeWebSocket's onmessage handler. The app code that handles this
			// special message knows the document to be edited anyway, and can send it
			// on as necessary to the Online code.
			window.postMobileMessage('HULLO');
			// A FakeWebSocket is immediately open.
			this.socket.onopen();
		}
	}
}(window));
