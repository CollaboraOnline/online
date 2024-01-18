/* -*- js-indent-level: 8 -*- */
/* global Uint8Array _ */

/*
	For extending window.app object, please see "docstate.js" file.
	Below definition is only for the properties that this (global.js) file needs at initialization.
*/
window.app = {
	socket: null,
	console: {}
};

(function (global) {

	global.logServer = function (log) {
		if (global.ThisIsAMobileApp) {
			global.postMobileError(log);
		} else if (global.socket && (global.socket instanceof WebSocket) && global.socket.readyState === 1) {
			global.socket.send(log);
		} else if (global.socket && global.L && global.app.definitions.Socket &&
			   (global.socket instanceof global.app.definitions.Socket) && global.socket.connected()) {
			global.socket.sendMessage(log);
		} else {
			fetch(global.location.pathname.match(/.*\//) + 'logging.html', {
				method: 'POST',
				headers: { 'Content-Type' : 'application/json' },
				body: global.coolLogging + ' ' + log
			});
		}
	};

	// enable later toggling
	global.setLogging = function(doLogging)
	{
		var loggingMethods = ['error', 'warn', 'info', 'debug', 'trace', 'log', 'assert', 'time', 'timeEnd', 'group', 'groupEnd'];
		if (!doLogging) {
			var noop = function() {};

			for (var i = 0; i < loggingMethods.length; i++) {
				global.app.console[loggingMethods[i]] = noop;
			}
		} else {
			for (var i = 0; i < loggingMethods.length; i++) {
				if (!Object.prototype.hasOwnProperty.call(global.console, loggingMethods[i])) {
					continue;
				}
				(function(method) {
					global.app.console[method] = function logWithCool() {
						var args = Array.prototype.slice.call(arguments);
						if (method === 'error') {
							var log = 'jserror ';
							for (var arg = 0; arg < arguments.length; arg++) {
								if (typeof arguments[arg] === 'string')
									log += arguments[arg] + '\n';
							}
							global.logServer(log);
						}

						return global.console[method].apply(console, args);
					};
				}(loggingMethods[i]));
			}

			global.onerror = function (msg, src, row, col, err) {
				var data = {
					userAgent: navigator.userAgent.toLowerCase(),
					vendor: navigator.vendor.toLowerCase(),
					message: msg,
					source: src,
					line: row,
					column: col
				};
				var desc = err ? err.message || '(no message)': '(no err)', stack = err ? err.stack || '(no stack)': '(no err)';
				var log = 'jserror ' + JSON.stringify(data, null, 2) + '\n' + desc + '\n' + stack + '\n';
				global.logServer(log);
				return false;
			};
		}
	};

	global.setLogging(global.coolLogging != '');

	global.coolParams = new URLSearchParams(global.location.search);
	var ua = navigator.userAgent.toLowerCase(),
	    uv = navigator.vendor.toLowerCase(),
	    doc = document.documentElement,

	    ie = 'ActiveXObject' in global,

	    cypressTest = ua.indexOf('cypress') !== -1,
	    webkit    = ua.indexOf('webkit') !== -1,
	    phantomjs = ua.indexOf('phantom') !== -1,
	    android23 = ua.search('android [23]') !== -1,
	    chrome    = ua.indexOf('chrome') !== -1,
	    gecko     = (ua.indexOf('gecko') !== -1 || (cypressTest && 'MozUserFocus' in doc.style))
			&& !webkit && !global.opera && !ie,
	    safari    = !chrome && (ua.indexOf('safari') !== -1 || uv.indexOf('apple') == 0),

	    win = navigator.platform.indexOf('Win') === 0,

	    mobile = typeof orientation !== 'undefined' || ua.indexOf('mobile') !== -1,
	    msPointer = !global.PointerEvent && global.MSPointerEvent,
	    pointer = (global.PointerEvent && navigator.pointerEnabled && navigator.maxTouchPoints) || msPointer,

	    ie3d = ie && ('transition' in doc.style),
	    webkit3d = ('WebKitCSSMatrix' in global) && ('m11' in new global.WebKitCSSMatrix()) && !android23,
	    gecko3d = 'MozPerspective' in doc.style,
	    opera12 = 'OTransition' in doc.style;

	var chromebook = global.ThisIsTheAndroidApp && global.COOLMessageHandler.isChromeOS();

	var isInternetExplorer = (navigator.userAgent.toLowerCase().indexOf('msie') != -1 ||
				  navigator.userAgent.toLowerCase().indexOf('trident') != -1);

	var navigatorLang = navigator.languages && navigator.languages.length ? navigator.languages[0] :
	    (navigator.language || navigator.userLanguage || navigator.browserLanguage || navigator.systemLanguage);

	function getFirefoxVersion() {
		var version = '';

		var userAgent = navigator.userAgent.toLowerCase();
		if (userAgent.indexOf('firefox') !== -1) {
			var matches = userAgent.match(/firefox\/([0-9]+\.*[0-9]*)/);
			if (matches) {
				version = matches[1];
			}
		}
		return version;
	}

	global.L = {};

	global.L.Params = {
		/// Shows close button if non-zero value provided
		closeButtonEnabled: global.coolParams.get('closebutton'),

		/// Shows revision history file menu option
		revHistoryEnabled: global.coolParams.get('revisionhistory'),
	};

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

		// @property geckoVersion: String
		// Firefox version: abc.d.
		geckoVersion: getFirefoxVersion(),

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
		any3d: !global.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantomjs,


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
		mobileOpera: mobile && global.opera,

		// @property mobileGecko: Boolean
		// `true` for gecko-based browsers running in a mobile device.
		mobileGecko: mobile && gecko,

		// @property cypressTest: Boolean
		// `true` when the browser run by cypress
		cypressTest: cypressTest,

		// @property msPointer: Boolean
		// `true` for browsers implementing the Microsoft touch events model (notably IE10).
		msPointer: !!msPointer,

		// @property pointer: Boolean
		// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
		pointer: !!pointer,

		// @property retina: Boolean
		// `true` for browsers on a high-resolution "retina" screen.
		retina: (global.devicePixelRatio || (global.screen.deviceXDPI / global.screen.logicalXDPI)) > 1,

		// @property lang: String
		// browser language locale
		lang: navigatorLang
	};

	global.keyboard = {
		onscreenKeyboardHint: global.uiDefaults['onscreenKeyboardHint'],
		// If there's an onscreen keyboard, we don't want to trigger it with innocuous actions like panning around a spreadsheet
		// on the other hand, if there is a hardware keyboard we want to do things like focusing contenteditables so that typing is
		// recognized without tapping again. This is an impossible problem, because browsers do not give us enough information
		// Instead, let's just guess
		guessOnscreenKeyboard: function() {
			if (global.keyboard.onscreenKeyboardHint != undefined) return global.keyboard.onscreenKeyboardHint;
			return (global.ThisIsAMobileApp && !global.ThisIsTheEmscriptenApp) || global.mode.isMobile() || global.mode.isTablet();
			// It's better to guess that more devices will have an onscreen keyboard than reality,
			// because calc becomes borderline unusable if you miss a device that pops up an onscreen keyboard which covers
			// a sizeable portion of the screen
		},
		// alternatively, maybe someone else (e.g. an integrator) knows more about the situation than we do. In this case, let's
		// let them override our default
		hintOnscreenKeyboard: function(hint) {
			if (global.app
					&& global.L.Map
					&& global.L.Map.THIS._docLayer.isCalc()
					&& hint !== undefined) {
				var command = {
					Enable: {
						type: 'boolean',
						value: hint
					}
				};
				global.L.Map.THIS.sendUnoCommand('.uno:MoveKeepInsertMode', command);
			}
			global.keyboard.onscreenKeyboardHint = hint;
		},
	};

	global.memo = {
		_lastId: 0,

		/// This does pretty much the same as L.stamp. We can't use L.stamp because it's not yet in-scope by the first time we want to call global.memo.decorator
		/// If you are able to use L.stamp instead, you probably should
		_getId: function(obj) {
			if (obj === null || obj === undefined) {
				return '' + obj;
			}
			if (!('_coolMemoId' in obj)) {
				obj['_coolMemoId'] = ++global.memo._lastId;
			}
			return obj._coolMemoId;
		},

		_decoratorMemo: {},

		/// A decorator factory, which takes a decorator and prevents it from creating new instances when wrapping the same function
		/// This is particularly useful for functions that take events, say, as .on and .off won't work properly if you don't provide the same function instance
		decorator: function(decorator, context) {
			var decoratorId = global.memo._getId(decorator);
			var contextId = global.memo._getId(context);

			return function(f) {
				var functionId = global.memo._getId(f);

				if (global.memo._decoratorMemo[decoratorId + ' ' + contextId + ' ' + functionId] === undefined) {
					global.memo._decoratorMemo[decoratorId + ' ' + contextId + ' ' + functionId] = decorator.apply(this, arguments);

					if (context !== null && context !== undefined) {
						global.memo._decoratorMemo[decoratorId + ' ' + contextId + ' ' + functionId] = global.memo._decoratorMemo[decoratorId + ' ' + contextId + ' ' + functionId].bind(context);
					}
				}

				return global.memo._decoratorMemo[decoratorId + ' ' + contextId + ' ' + functionId];
			};
		},

		_bindMemo: {},

		/// A decorator, which takes a function and binds it to an object
		/// Similar to L.bind, but when given the same function and context we will return the previously bound function
		bind: function(f, context) {
			var functionId = global.memo._getId(f);
			var contextId = global.memo._getId(context);
			if (global.memo._bindMemo[functionId + ' ' + contextId] === undefined) {
				global.memo._bindMemo[functionId + ' ' + contextId] = f.bind(context);
			}
			return global.memo._bindMemo[functionId + ' ' + contextId];
		}
	};

	global.touch = {
		/// a touchscreen event handler, supports both DOM and hammer.js events
		isTouchEvent: function(e) {
			if (e.originalEvent) {
				e = e.originalEvent;
			}

			if (L.Browser.cypressTest && global.L.Browser.mobile) {
				return true; // As cypress tests on mobile tend to use "click" events instead of touches... we cheat to get them recognized as touch events
			}

			if (e.pointerType) {
				return e.pointerType === 'touch' || e.pointerType === 'kinect';
			}

			if (e.isMouseEvent !== undefined) {
				return !e.isMouseEvent;
			}

			return !(e instanceof MouseEvent);
		},

		/// a decorator that only runs the function if the event is a touch event
		touchOnly: global.memo.decorator(function(f) {
			return function(e) {
				if (!global.touch.isTouchEvent(e)) return;
				return f.apply(this, arguments);
			};
		}),

		/// a decorator that only runs the function if the event is not a touch event
		mouseOnly: global.memo.decorator(function(f) {
			return function(e) {
				if (global.touch.isTouchEvent(e)) return;
				return f.apply(this, arguments);
			};
		}),

		/// detect if the primary pointing device is of limited accuracy (generally a touchscreen)
		/// you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may
		///   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor)
		hasPrimaryTouchscreen: function() {
			return global.matchMedia('(pointer: coarse)').matches;
		},
		/// detect any pointing device is of limited accuracy (generally a touchscreen)
		/// you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may
		///   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor)
		hasAnyTouchscreen: function() {
			return global.matchMedia('(any-pointer: coarse)').matches;
		},

	};

	global.mode = {
		isChromebook: function() {
			return chromebook;
		},
		// Here "mobile" means "mobile phone" (at least for now). Has to match small screen size
		// requirement.
		isMobile: function() {
			if (global.mode.isChromebook())
				return false;

			if (global.L.Browser.mobile && global.L.Browser.cypressTest) {
				return true;
			}

			return global.L.Browser.mobile && (screen.width < 768 || screen.height < 768);
		},
		// Mobile device with big screen size.
		isTablet: function() {
			if (global.mode.isChromebook())
				return false;

			return global.L.Browser.mobile && !global.mode.isMobile();
		},
		isDesktop: function() {
			if (global.mode.isChromebook())
				return true;

			return !global.L.Browser.mobile;
		},
		getDeviceFormFactor: function() {
			if (global.mode.isMobile())
				return 'mobile';
			else if (global.mode.isTablet())
				return 'tablet';
			else if (global.mode.isDesktop())
				return 'desktop';
			else
				return null;
		}
	};

	global.isLocalStorageAllowed = (function() {
		var str = 'localstorage_test';
		try {
			global.localStorage.setItem(str, str);
			global.localStorage.removeItem(str);
			return true;
		} catch (e) {
			return false;
		}
	})();

	global.deviceFormFactor = global.mode.getDeviceFormFactor();

	if (global.ThisIsTheiOSApp) {
		global.addEventListener('keydown', function(e) {
			if (e.metaKey) {
				e.preventDefault();
			}
			if (global.MagicKeyDownHandler)
				global.MagicKeyDownHandler(e);
		});
		global.addEventListener('keyup', function(e) {
			if (e.metaKey) {
				e.preventDefault();
			}
			if (global.MagicKeyUpHandler)
				global.MagicKeyUpHandler(e);
		});
	}

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
		this.id = global.fakeWebSocketCounter++;
		this.onclose = function() {
		};
		this.onerror = function() {
		};
		this.onmessage = function() {
		};
		this.onopen = function() {
		};
		this.close = function() {
		};
	};
	global.FakeWebSocket.prototype.send = function(data) {
		global.postMobileMessage(data);
	};

	global.proxySocketCounter = 0;
	global.ProxySocket = function (uri) {
		var that = this;
		this.uri = uri;
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.unloading = false;
		this.protocol = '';
		this.connected = true;
		this.readyState = 0; // connecting
		this.sessionId = 'open';
		this.id = global.proxySocketCounter++;
		this.msgInflight = 0;
		this.openInflight = 0;
		this.inSerial = 0;
		this.outSerial = 0;
		this.minPollMs = 25; // Anything less than ~25 ms can overwhelm the HTTP server.
		this.maxPollMs = 500; // We can probably go as much as 1-2 seconds without ill-effect.
		this.curPollMs = this.minPollMs; // The current poll period.
		this.minIdlePollsToThrottle = 3; // This many 'no data' responses and we throttle.
		this.throttleFactor = 1.15; // How rapidly to throttle. 15% takes 4s to go from 25 to 500ms.
		this.lastDataTimestamp = performance.now(); // The last time we got any data.
		this.onclose = function() {
		};
		this.onerror = function() {
		};
		this.onmessage = function() {
		};

		this.decoder = new TextDecoder();
		this.doSlice = function(bytes,start,end) { return bytes.slice(start,end); };

		this.decode = function(bytes,start,end) {
			return this.decoder.decode(this.doSlice(bytes, start,end));
		};
		this.parseIncomingArray = function(arr) {
			//global.app.console.debug('proxy: parse incoming array of length ' + arr.length);
			for (var i = 0; i < arr.length; ++i)
			{
				var left = arr.length - i;
				if (left < 4)
				{
					//global.app.console.debug('no data left');
					break;
				}
				var type = String.fromCharCode(arr[i+0]);
				if (type != 'T' && type != 'B')
				{
					global.app.console.debug('wrong data type: ' + type);
					break;
				}
				i++;

				// Serial
				if (arr[i] !== 48 && arr[i+1] !== 120) // '0x'
				{
					global.app.console.debug('missing hex preamble');
					break;
				}
				i += 2;
				var numStr = '';
				var start = i;
				while (arr[i] != 10) // '\n'
					i++;
				numStr = this.decode(arr, start, i);
				var serial = parseInt(numStr, 16);

				i++; // skip \n

				// Size:
				if (arr[i] !== 48 && arr[i+1] !== 120) // '0x'
				{
					global.app.console.debug('missing hex preamble');
					break;
				}
				i += 2;
				start = i;
				while (arr[i] != 10) // '\n'
					i++;
				numStr = this.decode(arr, start, i);
				var size = parseInt(numStr, 16);

				i++; // skip \n

				var data;
				if (type == 'T')
					data = this.decode(arr, i, i + size);
				else
					data = this.doSlice(arr, i, i + size);

				if (serial !== that.inSerial + 1) {
					global.app.console.debug('Error: serial mismatch ' + serial + ' vs. ' + (that.inSerial + 1));
				}
				that.inSerial = serial;
				this.onmessage({ data: data });

				i += size; // skip trailing '\n' in loop-increment
			}
		};
		this.sendQueue = '';
		this._signalErrorClose = function() {
			clearInterval(this.pollInterval);
			clearTimeout(this.delaySession);
			this.pollInterval = undefined;
			this.delaySession = undefined;

			if (that.readyState < 3)
			{
				this.onerror();
				this.onclose();
			}
			this.sessionId = 'open';
			this.inSerial = 0;
			this.outSerial = 0;
			this.msgInflight = 0;
			this.openInflight = 0;
			this.readyState = 3; // CLOSED
		};
		// For those who think that long-running sockets are a
		// better way to wait: you're so right. However, each
		// consumes a scarce server worker thread while it waits,
		// so ... back in the real world:
		this._setPollInterval = function(intervalMs) {
			clearInterval(this.pollInterval);
			if (this.readyState === 1)
				this.pollInterval = setInterval(this.doSend, intervalMs);
		},
		this.doSend = function () {
			if (that.sessionId === 'open')
			{
				if (that.readyState === 3)
					global.app.console.debug('Error: sending on closed socket');
				return;
			}

			if (that.msgInflight >= 4) // something went badly wrong.
			{
				// We shouldn't get here because we throttle sending when we
				// have something in flight, but if the server hangs, we
				// will do up to 3 retries before we end up here and yield.
				if (that.curPollMs < that.maxPollMs)
				{
					that.curPollMs = Math.min(that.maxPollMs, that.curPollMs * that.throttleFactor) | 0;
					global.app.console.debug('High latency connection - too much in-flight, throttling to ' + that.curPollMs + ' ms.');
					that._setPollInterval(that.curPollMs);
				}
				else if (performance.now() - that.lastDataTimestamp > 30 * 1000)
				{
					global.app.console.debug('Close connection after no response for 30secs');
					that._signalErrorClose();
				}
				else
					global.app.console.debug('High latency connection - too much in-flight, pausing.');
				return;
			}

			// Maximize the timeout, instead of stopping altogethr,
			// so we don't hang when the following request takes
			// too long, hangs, throws, etc. we can recover.
			that._setPollInterval(that.maxPollMs);

			//global.app.console.debug('send msg - ' + that.msgInflight + ' on session ' +
			//	      that.sessionId + '  queue: "' + that.sendQueue + '"');
			var req = new XMLHttpRequest();
			req.open('POST', that.getEndPoint('write'));
			req.responseType = 'arraybuffer';
			req.addEventListener('load', function() {
				if (this.status == 200)
				{
					var data = new Uint8Array(this.response);
					if (data.length)
					{
						// We have some data back from WSD.
						// Another user might be editing and we want
						// to see their changes in real time.
						that.curPollMs = that.minPollMs; // Drain fast.
						that._setPollInterval(that.curPollMs);
						that.lastDataTimestamp = performance.now();

						that.parseIncomingArray(data);
						return;
					}
				}
				else
				{
					global.app.console.debug('proxy: error on incoming response ' + this.status);
					that._signalErrorClose();
				}

				if (that.curPollMs < that.maxPollMs) // If we aren't throttled, see if we should.
				{
					// Has it been long enough since we got any data?
					var timeSinceLastDataMs = (performance.now() - that.lastDataTimestamp) | 0;
					if (timeSinceLastDataMs >= that.minIdlePollsToThrottle * that.curPollMs)
					{
						// Throttle.
						that.curPollMs = Math.min(that.maxPollMs, that.curPollMs * that.throttleFactor) | 0;
						//global.app.console.debug('No data for ' + timeSinceLastDataMs + ' ms -- throttling to ' + that.curPollMs + ' ms.');
					}
				}

				that._setPollInterval(that.curPollMs);
			});
			req.addEventListener('loadend', function() {
				that.msgInflight--;
			});
			req.send(that.sendQueue);
			that.sendQueue = '';
			that.msgInflight++;
		};
		this.getSessionId = function() {
			if (this.openInflight > 0)
			{
				global.app.console.debug('Waiting for session open');
				return;
			}

			if (this.delaySession)
				return;

			// avoid attempting to re-connect too quickly
			if (global.lastCreatedProxySocket)
			{
				var msSince = performance.now() - global.lastCreatedProxySocket;
				if (msSince < 250) {
					var delay = 250 - msSince;
					global.app.console.debug('Wait to re-try session creation for ' + delay + 'ms');
					this.curPollMs = delay; // ms
					this.delaySession = setTimeout(function() {
						that.delaySession = undefined;
						that.getSessionId();
					}, delay);
					return;
				}
			}
			global.lastCreatedProxySocket = performance.now();

			var req = new XMLHttpRequest();
			req.open('POST', that.getEndPoint('open'));
			req.responseType = 'text';
			req.addEventListener('load', function() {
				global.app.console.debug('got session: ' + this.responseText);
				if (this.status !== 200 || !this.responseText ||
				    this.responseText.indexOf('\n') >= 0) // multi-line error
				{
					global.app.console.debug('Error: failed to fetch session id! error: ' + this.status);
					that._signalErrorClose();
				}
				else // we connected - lets get going ...
				{
					that.sessionId = this.responseText;
					that.readyState = 1;
					that.onopen();
					that._setPollInterval(that.curPollMs);
				}
			});
			req.addEventListener('loadend', function() {
				global.app.console.debug('Open completed state: ' + that.readyState);
				that.openInflight--;
			});
			req.send('');
			this.openInflight++;
		};
		this.send = function(msg) {
			var hadData = this.sendQueue.length > 0;
			this.sendQueue = this.sendQueue.concat(
				'B0x' + this.outSerial.toString(16) + '\n' +
				'0x' + (new TextEncoder().encode(msg)).length.toString(16) + '\n' + msg + '\n');
			this.outSerial++;

			// Send ASAP, if we have throttled.
			if (that.curPollMs > that.minPollMs || !hadData)
			{
				// Unless we are backed up.
				if (that.msgInflight <= 3)
				{
					//global.app.console.debug('Have data to send, lowering poll interval.');
					that.curPollMs = that.minPollMs;
					that._setPollInterval(that.curPollMs);
				}
			}
		};
		this.sendCloseMsg = function(beacon) {
			var url = that.getEndPoint('close');
			if (!beacon)
			{
				var req = new XMLHttpRequest();
				req.open('POST', url);
				req.send('');
			}
			else
				navigator.sendBeacon(url, '');
		};
		this.close = function() {
			var oldState = this.readyState;
			global.app.console.debug('proxy: close socket');
			this.readyState = 3;
			this.onclose();
			clearInterval(this.pollInterval);
			clearTimeout(this.delaySession);
			this.pollInterval = undefined;
			if (oldState === 1) // was open
				this.sendCloseMsg(this.unloading);
			this.sessionId = 'open';
		};
		this.setUnloading = function() {
			this.unloading = true;
		};
		this.getEndPoint = function(command) {
			var base = this.uri;
			return base + '/' + this.sessionId + '/' + command + '/' + this.outSerial;
		};
		global.app.console.debug('proxy: new socket ' + this.id + ' ' + this.uri);

		// queue fetch of session id.
		this.getSessionId();
	};

	if (global.socketProxy)
	{
		// re-write relative URLs in CSS - somewhat grim.
		global.addEventListener('load', function() {
			var replaceUrls = function(rules, replaceBase) {
				if (!rules)
					return;

				for (var r = 0; r < rules.length; ++r) {
					// check subset of rules like @media or @import
					if (rules[r] && rules[r].type != 1) {
						replaceUrls(rules[r].cssRules || rules[r].rules, replaceBase);
						continue;
					}
					if (!rules[r] || !rules[r].style)
						continue;
					var img = rules[r].style.backgroundImage;
					if (img === '' || img === undefined)
						continue;
					if (img.startsWith('url("images/'))
					{
						rules[r].style.backgroundImage =
							img.replace('url("images/', replaceBase + '/images/');
					}
					if (img.startsWith('url("remote/'))
					{
						rules[r].style.backgroundImage =
							img.replace('url("remote/', replaceBase + '/remote/');
					}
				}
			};
			var sheets = document.styleSheets;
			for (var i = 0; i < sheets.length; ++i) {
				var relBases;
				try {
					relBases = sheets[i].href.split('/');
				} catch (err) {
					global.app.console.log('Missing href from CSS number ' + i);
					continue;
				}
				relBases.pop(); // bin last - css name.
				var replaceBase = 'url("' + relBases.join('/');

				var rules;
				try {
					rules = sheets[i].cssRules || sheets[i].rules;
				} catch (err) {
					global.app.console.log('Missing CSS from ' + sheets[i].href);
					continue;
				}
				replaceUrls(rules, replaceBase);
			}
		}, false);
	}

	// indirect socket to wrap the asyncness around fetching the routetoken from indirection url endpoint
	global.IndirectSocket = function(uri) {
		var that = this;
		this.uri = uri;
		this.binaryType = '';
		this.unloading = false;
		this.readyState = 0; // connecting
		this.innerSocket = undefined;

		this.onclose = function() {};
		this.onerror = function () {};
		this.onmessage = function () {};
		this.onopen = function () {};

		this.close = function() {
			this.innerSocket.close();
		};

		this.send = function(msg) {
			this.innerSocket.send(msg);
		};

		this.setUnloading = function() {
			this.unloading = true;
		};

		this.sendPostMsg = function(errorCode) {
			var errorMsg;
			if (errorCode === 0) {
				errorMsg = _('Cluster is scaling, retrying...');
			} else if (errorCode === 1) {
				errorMsg = _('Document is migrating to new server, retrying...');
			} else {
				errorMsg = _('Failed to get RouteToken from controller');
			}
			var msg = {
				'MessageId': 'Action_Load_Resp',
				'SendTime': Date.now(),
				'Values': {
					success: false,
					errorMsg: errorMsg,
					errorType: 'clusterscaling'
				}
			};
			global.parent.postMessage(JSON.stringify(msg), '*');
		};

		var http = new XMLHttpRequest();
		http.open('GET', global.indirectionUrl + '?Uri=' + encodeURIComponent(that.uri), true);
		http.responseType = 'json';
		http.addEventListener('load', function() {
			if (this.status === 200) {
				var uriWithRouteToken = http.response.uri;
				global.expectedServerId = http.response.serverId;
				var params = (new URL(uriWithRouteToken)).searchParams;
				global.routeToken = params.get('RouteToken');
				global.app.console.log('updated routeToken: ' + global.routeToken);
				that.innerSocket = new WebSocket(uriWithRouteToken);
				that.innerSocket.binaryType = that.binaryType;
				that.innerSocket.onerror = function() {
					that.readyState = that.innerSocket.readyState;
					that.onerror();
				};
				that.innerSocket.onclose = function() {
					that.readyState = 3;
					that.onclose();
					that.innerSocket.onerror = function () {};
					that.innerSocket.onclose = function () {};
					that.innerSocket.onmessage = function () {};
				};
				that.innerSocket.onopen = function() {
					that.readyState = 1;
					that.onopen();
				};
				that.innerSocket.onmessage = function(e) {
					that.readyState = that.innerSocket.readyState;
					that.onmessage(e);
				};
			} else if (this.status === 202) {
				that.sendPostMsg(http.response.errorCode);
				var timeoutFn = function (indirectionUrl, uri) {
					console.warn('Requesting again for routeToken');
					this.open('GET', indirectionUrl + '?Uri=' + encodeURIComponent(uri), true);
					this.send();
				}.bind(this);
				setTimeout(timeoutFn, 3000, global.indirectionUrl, that.uri);
			} else {
				global.app.console.error('Indirection url: error on incoming response ' + this.status);
				that.sendPostMsg(-1);
			}
		});
		http.send();
	};

	global.createWebSocket = function(uri) {
		if ('processCoolUrl' in global) {
			uri = global.processCoolUrl({ url: uri, type: 'ws' });
		}

		if (global.socketProxy) {
			global.socketProxy = true;
			return new global.ProxySocket(uri);
		} else if (global.indirectionUrl != '' && !global.migrating) {
			global.indirectSocket = true;
			return new global.IndirectSocket(uri);
		} else {
			return new WebSocket(uri);
		}
	};

	global._ = function (string) {
		// In the mobile app case we can't use the stuff from l10n-for-node, as that assumes HTTP.
		if (global.ThisIsAMobileApp) {
			// We use another approach just for iOS for now.
			if (global.LOCALIZATIONS && Object.prototype.hasOwnProperty.call(global.LOCALIZATIONS, string)) {
				// global.postMobileDebug('_(' + string + '): YES: ' + global.LOCALIZATIONS[string]);
				var result = global.LOCALIZATIONS[string];
				if (global.LANG === 'de-CH') {
					result = result.replace(/ß/g, 'ss');
				}
				return result;
			} else {
				// global.postMobileDebug('_(' + string + '): NO');
				return string;
			}
		} else {
			return string.toLocaleString();
		}
	};

	// Some global variables are defined in cool.html, among them:
	// global.host: the host URL, with ws(s):// protocol
	// global.serviceRoot: an optional root path on the server, typically blank.

	// Setup global.webserver: the host URL, with http(s):// protocol (used to fetch files).
	if (global.webserver === undefined) {
		var protocol = global.location.protocol === 'file:' ? 'https:' : global.location.protocol;
		global.webserver = global.host.replace(/^(ws|wss):/i, protocol);
		global.webserver = global.webserver.replace(/\/*$/, ''); // Remove trailing slash.
	}

	var docParams, wopiParams;
	var filePath = global.coolParams.get('file_path');
	global.wopiSrc = global.coolParams.get('WOPISrc');
	if (global.wopiSrc != '') {
		global.docURL = decodeURIComponent(global.wopiSrc);
		if (global.accessToken !== '') {
			wopiParams = { 'access_token': global.accessToken, 'access_token_ttl': global.accessTokenTTL };
		}
		else if (global.accessHeader !== '') {
			wopiParams = { 'access_header': global.accessHeader };
		}

		if (wopiParams) {
			docParams = Object.keys(wopiParams).map(function(key) {
				return encodeURIComponent(key) + '=' + encodeURIComponent(wopiParams[key]);
			}).join('&');
		}
	} else if (global.ThisIsTheEmscriptenApp) {
		// This is of course just a horrible temporary hack
		global.docURL = 'file:///sample.docx';
	} else {
		global.docURL = filePath;
	}

	// Form a valid WS URL to the host with the given path.
	global.makeWsUrl = function (path) {
		global.app.console.assert(global.host.startsWith('ws'), 'host is not ws: ' + global.host);
		return global.host + global.serviceRoot + path;
	};

	// Form a URI from the docUrl and wopiSrc and encodes.
	// The docUrlParams, suffix, and wopiSrc are optionally hexified.
	global.routeToken = '';
	global.makeDocAndWopiSrcUrl = function (root, docUrlParams, suffix, wopiSrcParam) {
		var wopiSrc = '';
		if (global.wopiSrc != '') {
			wopiSrc = '?WOPISrc=' + global.wopiSrc;
			if (global.routeToken != '')
				wopiSrc += '&RouteToken=' + global.routeToken;
			wopiSrc += '&compat=';
			if (wopiSrcParam && wopiSrcParam.length > 0)
				wopiSrc += '&' + wopiSrcParam;
		}
		else if (wopiSrcParam && wopiSrcParam.length > 0) {
			wopiSrc = '?' + wopiSrcParam;
		}

		suffix = suffix || '/ws';
		var encodedDocUrl = encodeURIComponent(docUrlParams) + suffix + wopiSrc;
		if (global.hexifyUrl)
			encodedDocUrl = global.hexEncode(encodedDocUrl);
		return root + encodedDocUrl + '/ws';
	};

	// Form a valid WS URL to the host with the given path and
	// encode the document URL and params.
	global.makeWsUrlWopiSrc = function (path, docUrlParams, suffix, wopiSrcParam) {
		var websocketURI = global.makeWsUrl(path);
		return global.makeDocAndWopiSrcUrl(websocketURI, docUrlParams, suffix, wopiSrcParam);
	};

	// Form a valid HTTP URL to the host with the given path.
	global.makeHttpUrl = function (path) {
		global.app.console.assert(global.webserver.startsWith('http'), 'webserver is not http: ' + global.webserver);
		return global.webserver + global.serviceRoot + path;
	};

	// Form a valid HTTP URL to the host with the given path and
	// encode the document URL and params.
	global.makeHttpUrlWopiSrc = function (path, docUrlParams, suffix, wopiSrcParam) {
		var httpURI = global.makeHttpUrl(path);
		return global.makeDocAndWopiSrcUrl(httpURI, docUrlParams, suffix, wopiSrcParam);
	};

	// Encode a string to hex.
	global.hexEncode = function (string) {
		var bytes = new TextEncoder().encode(string);
		var hex = '0x';
		for (var i = 0; i < bytes.length; ++i) {
			hex += bytes[i].toString(16);
		}
		return hex;
	};

	// Decode hexified string back to plain text.
	global.hexDecode = function (hex) {
		if (hex.startsWith('0x'))
			hex = hex.substr(2);
		var bytes = new Uint8Array(hex.length / 2);
		for (var i = 0; i < bytes.length; i++) {
			bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
		}
		return new TextDecoder().decode(bytes);
	};

	if (global.ThisIsAMobileApp) {
		global.socket = new global.FakeWebSocket();
		global.TheFakeWebSocket = global.socket;
	} else {
		// The URL may already contain a query (e.g., 'http://server.tld/foo/wopi/files/bar?desktop=baz') - then just append more params
		var docParamsPart = docParams ? (global.docURL.includes('?') ? '&' : '?') + docParams : '';
		var websocketURI = global.makeWsUrlWopiSrc('/cool/', global.docURL + docParamsPart);
		try {
			global.socket = global.createWebSocket(websocketURI);
		} catch (err) {
			global.app.console.log(err);
		}
	}

	var lang = global.coolParams.get('lang');
	if (lang)
		global.langParam = encodeURIComponent(lang);
	else
		global.langParam = 'en-US';
	global.langParamLocale = new Intl.Locale(global.langParam);
	global.queueMsg = [];
	if (global.ThisIsTheEmscriptenApp)
		// Temporary hack
		global.LANG = 'en-US';
	else if (global.ThisIsAMobileApp)
		global.LANG = lang;
	if (global.socket && global.socket.readyState !== 3) {
		global.socket.onopen = function () {
			if (global.socket.readyState === 1) {
				var ProtocolVersionNumber = '0.1';
				var timestamp = encodeURIComponent(global.coolParams.get('timestamp'));
				var msg = 'load url=' + encodeURIComponent(global.docURL);

				var now0 = Date.now();
				var now1 = performance.now();
				var now2 = Date.now();
				global.socket.send('coolclient ' + ProtocolVersionNumber + ' ' + ((now0 + now2) / 2) + ' ' + now1);

				var isCalcTest =
					global.docURL.includes('data/desktop/calc/') ||
					global.docURL.includes('data/mobile/calc/') ||
					global.docURL.includes('data/idle/calc/') ||
					global.docURL.includes('data/multiuser/calc/');

				if (L.Browser.cypressTest && isCalcTest)
					global.enableAccessibility = false;

				var accessibilityState = global.localStorage.getItem('accessibilityState') === 'true';
				accessibilityState = accessibilityState || (L.Browser.cypressTest && !isCalcTest);
				msg += ' accessibilityState=' + accessibilityState;

				if (global.ThisIsAMobileApp) {
					msg += ' lang=' + global.LANG;
				} else {

					if (timestamp) {
						msg += ' timestamp=' + timestamp;
					}
					if (lang) {
						msg += ' lang=' + lang;
					}
					// renderingOptions?
				}

				if (global.deviceFormFactor) {
					msg += ' deviceFormFactor=' + global.deviceFormFactor;
				}
				if (global.isLocalStorageAllowed) {
					var spellOnline = global.localStorage.getItem('SpellOnline');
					if (spellOnline) {
						msg += ' spellOnline=' + spellOnline;
					}

				}

				msg += ' timezone=' + Intl.DateTimeFormat().resolvedOptions().timeZone;

				global.socket.send(msg);
			}
		};

		global.socket.onerror = function (event) {
			global.app.console.log(event);
		};

		global.socket.onclose = function (event) {
			global.app.console.log(event);
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

		if (global.ThisIsAMobileApp && !global.ThisIsTheEmscriptenApp) {
			// This corresponds to the initial GET request when creating a WebSocket
			// connection and tells the app's code that it is OK to start invoking
			// TheFakeWebSocket's onmessage handler. The app code that handles this
			// special message knows the document to be edited anyway, and can send it
			// on as necessary to the Online code.
			global.postMobileMessage('HULLO');
			// A FakeWebSocket is immediately open.
			this.socket.onopen();
		}
	}
}(window));
