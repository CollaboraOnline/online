/* -*- js-indent-level: 8 -*- */
/* window Uint8Array _ */

/*
	For extending window.app object, please see "docstate.js" file.
	Below definition is only for the properties that this (window.js) file needs at initialization.
*/
window.app = {
	socket: null,
	console: {},
};

type MaybeTouchEvent =
	| MouseEvent
	| TouchEvent
	| HammerInput
	| JQuery.Event
	| { isMouseEvent: boolean }
	| { originalEvent: MouseEvent | TouchEvent };

interface Window {
	[name: string]: any;
	logServer: (log: string) => void;
	setLogging: (doLogging: boolean) => void;
	coolLogging: string;
	coolParams: URLSearchParams;
	L: {
		Params: {
			closeButtonEnabled: ReturnType<URLSearchParams['get']>;
			revHistoryEnabled: ReturnType<URLSearchParams['get']>;
		};
		Browser: {
			/** `true` for all Internet Explorer versions (not Edge). */
			ie: boolean;

			/** `true` for Internet Explorer versions less than 9. */
			ielt9: boolean;

			/** `true` for the Edge web browser. */
			edge: boolean;

			/** `true` for webkit-based browsers like Chrome and Safari (including mobile versions). */
			webkit: boolean;

			/** `true` for gecko-based browsers like Firefox. */
			gecko: boolean;

			/** Firefox version: abc.d. */
			geckoVersion: string;

			/** `true` for any browser running on an Android platform. */
			android: boolean;

			/** `true` for browsers running on Android 2 or Android 3. */
			android23: boolean;

			/** `true` for the Chrome browser. */
			chrome: boolean;

			/** `true` for the Safari browser. */
			safari: boolean;

			/** `true` when the browser is running in a Windows platform */
			win: boolean;

			/** `true` when the browser is running in a Mac platform */
			mac: boolean;

			/** `true` for all Internet Explorer versions supporting CSS transforms. */
			ie3d: boolean;

			/** `true` for Internet Explorer */
			isInternetExplorer: boolean;

			/** `true` for webkit-based browsers supporting CSS transforms. */
			webkit3d: boolean;

			/** `true` for gecko-based browsers supporting CSS transforms. */
			gecko3d: boolean;

			/** `true` for the Opera browser supporting CSS transforms (version 12 or later). */
			opera12: boolean;

			/** `true` for all browsers supporting CSS transforms. */
			any3d: boolean;

			/** `true` for all browsers running in a mobile device. */
			mobile: boolean;

			/** `true` for all webkit-based browsers in a mobile device. */
			mobileWebkit: boolean;

			/** `true` for all webkit-based browsers in a mobile device supporting CSS transforms. */
			mobileWebkit3d: boolean;

			/** `true` for the Opera browser in a mobile device. */
			mobileOpera: boolean;

			/** `true` for gecko-based browsers running in a mobile device. */
			mobileGecko: boolean;

			/** `true` when the browser run by cypress */
			cypressTest: boolean;

			/** `true` for browsers implementing the Microsoft touch events model (notably IE10). */
			msPointer: boolean;

			/** `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx). */
			pointer: boolean;

			/** `true` for browsers on a high-resolution "retina" screen. */
			retina: boolean;

			/** browser language locale */
			lang: string;
		};
		Map?: any;
	};
	keyboard: {
		onscreenKeyboardHint?: boolean;
		guessOnscreenKeyboard: () => boolean;
		hintOnscreenKeyboard: (hint: boolean | undefined) => void;
	};
	memo: {
		_lastId: number;
		_getId: (obj: any) => number;
		_decoratorMemo: Record<string, (...args: any[]) => unknown>;
		_bindMemo: Record<string, (...args: any[]) => unknown>;
		decorator: <
			DecoratorType extends <
				DecoratedFunctionType extends (...args: any[]) => unknown,
				DecoratorReturnType extends DecoratedFunctionType,
			>(
				f: DecoratedFunctionType
			) => DecoratorReturnType,
		>(
			decorator: DecoratorType,
			context?: unknown
		) => DecoratorType;
		bind: <
			BoundFunctionType extends (...args: any[]) => unknown,
			BindReturnType extends BoundFunctionType,
		>(
			bind: BoundFunctionType,
			context: unknown
		) => BindReturnType;
	};
	touch: {
		isTouchEvent: (e: MaybeTouchEvent) => boolean;
		touchOnly: <
			TouchOnlyFunction extends (e: MaybeTouchEvent) => unknown,
			DecoratedFunction extends TouchOnlyFunction,
		>(
			f: TouchOnlyFunction
		) => DecoratedFunction;
		mouseOnly: <
			MouseOnlyFunction extends (e: MaybeTouchEvent) => unknown,
			DecoratedFunction extends MouseOnlyFunction,
		>(
			f: MouseOnlyFunction
		) => DecoratedFunction;
		hasPrimaryTouchscreen: () => boolean;
		hasAnyTouchscreen: () => boolean;
	};
	mode: {
		isChromebook: () => boolean;
		isMobile: () => boolean;
		isTablet: () => boolean;
		isDesktop: () => boolean;

		/**
		 * Dynamically get the current device form factor
		 *
		 * @deprecated please use window.deviceFormFactor instead to avoid changes to the device over time causing inconsistent states
		 */
		getDeviceFormFactor: () => 'mobile' | 'tablet' | 'desktop' | null;
	};
	isLocalStorageAllowed: boolean;
	deviceFormFactor: 'mobile' | 'tablet' | 'desktop' | null;
	fakeWebSocketCounter: number; // TODO: refactor to be static
	FakeWebSocket: typeof FakeWebSocket; // TODO: refactor to use export
	proxySocketCounter: number; // TODO: refactor to be static
	ProxySocket: typeof ProxySocket; // TODO: refactor to use export
	IndirectSocket: typeof IndirectSocket; // TODO: refactor to use export
	createWebSocket: (uri: string) => Socket;

	wopiSrc: string;

	/** Form a valid WS URL to the host with the given path. */
	makeWsUrl: (path: string) => string;

	routeToken: string;
	makeDocAndWopiSrcUrl: (
		root: string,
		docUrlParams: string,
		suffix: string,
		wopiSrcParam: string
	) => string;
	makeWsUrlWopiSrc: (
		path: string,
		docUrlParams: string,
		suffix?: string,
		wopiSrcParam?: string
	) => string;
	makeHttpUrl: (path: string) => string;
	makeHttpUrlWopiSrc: (
		path: string,
		docUrlParams: string,
		suffix: string,
		wopiSrcParam: string
	) => string;

	hexEncode: (string: string) => string;
	hexDecode: (hex: string) => string;
	socket: Socket;

	//
	_: (string: string) => string;
}

type Tail<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

window.logServer = function (log) {
	if (window.ThisIsAMobileApp) {
		window.postMobileError(log);
	} else if (
		window.socket &&
		window.socket instanceof WebSocket &&
		window.socket.readyState === 1
	) {
		window.socket.send(log);
	} else if (
		window.socket &&
		window.L &&
		window.app.definitions.Socket &&
		window.socket instanceof window.app.definitions.Socket &&
		'connected' in window.socket &&
		'sendMessage' in window.socket &&
		window.socket.connected()
	) {
		window.socket.sendMessage(log);
	} else {
		fetch(window.location.pathname.match(/.*\//) + 'logging.html', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: window.coolLogging + ' ' + log,
		});
	}
};

// enable later toggling
window.setLogging = function (doLogging) {
	var loggingMethods = [
		'error',
		'warn',
		'info',
		'debug',
		'trace',
		'log',
		'assert',
		'time',
		'timeEnd',
		'group',
		'groupEnd',
	] as const;
	if (!doLogging) {
		var noop = function () {};

		for (var i = 0; i < loggingMethods.length; i++) {
			window.app.console[loggingMethods[i]] = noop;
		}
	} else {
		for (var i = 0; i < loggingMethods.length; i++) {
			if (
				!Object.prototype.hasOwnProperty.call(window.console, loggingMethods[i])
			) {
				continue;
			}
			const method = loggingMethods[i];
			window.app.console[method] = function logWithCool(...toLog: any[]) {
				const args = Array.prototype.slice.call(toLog);
				if (method === 'error') {
					var log = 'jserror ';
					for (var arg = 0; arg < toLog.length; arg++) {
						if (typeof toLog[arg] === 'string') log += toLog[arg] + '\n';
					}
					window.logServer(log);
				}

				return window.console[method].apply(console, args);
			};
		}

		window.onerror = function (msg, src, row, col, err) {
			var data = {
				userAgent: navigator.userAgent.toLowerCase(),
				vendor: navigator.vendor.toLowerCase(),
				message: msg,
				source: src,
				line: row,
				column: col,
			};
			var desc = err ? err.message || '(no message)' : '(no err)',
				stack = err ? err.stack || '(no stack)' : '(no err)';
			var log =
				'jserror ' +
				JSON.stringify(data, null, 2) +
				'\n' +
				desc +
				'\n' +
				stack +
				'\n';
			window.logServer(log);
			return false;
		};
	}
};

window.setLogging(window.coolLogging != '');

window.coolParams = new URLSearchParams(window.location.search);
var ua = navigator.userAgent.toLowerCase(),
	uv = navigator.vendor.toLowerCase(),
	doc = document.documentElement,
	ie = 'ActiveXObject' in window,
	cypressTest = ua.indexOf('cypress') !== -1,
	webkit = ua.indexOf('webkit') !== -1,
	phantomjs = ua.indexOf('phantom') !== -1,
	android23 = ua.search('android [23]') !== -1,
	chrome = ua.indexOf('chrome') !== -1,
	gecko =
		(ua.indexOf('gecko') !== -1 ||
			(cypressTest && 'MozUserFocus' in doc.style)) &&
		!webkit &&
		!window.opera &&
		!ie,
	safari = !chrome && (ua.indexOf('safari') !== -1 || uv.indexOf('apple') == 0),
	win = navigator.platform.indexOf('Win') === 0,
	mobile =
		typeof screen.orientation !== 'undefined' || ua.indexOf('mobile') !== -1,
	msPointer = !window.PointerEvent && window.MSPointerEvent,
	pointer = (window.PointerEvent && navigator.maxTouchPoints) || msPointer,
	ie3d = ie && 'transition' in doc.style,
	webkit3d =
		'WebKitCSSMatrix' in window &&
		'm11' in new window.WebKitCSSMatrix() &&
		!android23,
	gecko3d = 'MozPerspective' in doc.style,
	opera12 = 'OTransition' in doc.style;

var mac =
	navigator.appVersion.indexOf('Mac') != -1 ||
	navigator.userAgent.indexOf('Mac') != -1;
var chromebook =
	window.ThisIsTheAndroidApp && window.COOLMessageHandler.isChromeOS();

var isInternetExplorer =
	navigator.userAgent.toLowerCase().indexOf('msie') != -1 ||
	navigator.userAgent.toLowerCase().indexOf('trident') != -1;

var navigatorLang =
	navigator.languages && navigator.languages.length
		? navigator.languages[0]
		: navigator.language;

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

window.L = {
	Params: {
		/** Shows close button if non-zero value provided */
		closeButtonEnabled: window.coolParams.get('closebutton'),

		/** Shows revision history file menu option */
		revHistoryEnabled: window.coolParams.get('revisionhistory'),
	},
	Browser: {
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

		// @property mac: Boolean
		// `true` when the browser is running in a Mac platform
		mac: mac,

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
		any3d:
			!window.L_DISABLE_3D &&
			(ie3d || webkit3d || gecko3d) &&
			!opera12 &&
			!phantomjs,

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

		// @property msPointer: Boolean
		// `true` for browsers implementing the Microsoft touch events model (notably IE10).
		msPointer: !!msPointer,

		// @property pointer: Boolean
		// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
		pointer: !!pointer,

		// @property retina: Boolean
		// `true` for browsers on a high-resolution "retina" screen.
		retina: window.devicePixelRatio > 1,

		// @property lang: String
		// browser language locale
		lang: navigatorLang,
	},
};

window.keyboard = {
	onscreenKeyboardHint: window.uiDefaults['onscreenKeyboardHint'],
	// If there's an onscreen keyboard, we don't want to trigger it with innocuous actions like panning around a spreadsheet
	// on the other hand, if there is a hardware keyboard we want to do things like focusing contenteditables so that typing is
	// recognized without tapping again. This is an impossible problem, because browsers do not give us enough information
	// Instead, let's just guess
	guessOnscreenKeyboard: function () {
		if (window.keyboard.onscreenKeyboardHint != undefined)
			return window.keyboard.onscreenKeyboardHint;
		return (
			(window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) ||
			window.mode.isMobile() ||
			window.mode.isTablet()
		);
		// It's better to guess that more devices will have an onscreen keyboard than reality,
		// because calc becomes borderline unusable if you miss a device that pops up an onscreen keyboard which covers
		// a sizeable portion of the screen
	},
	// alternatively, maybe someone else (e.g. an integrator) knows more about the situation than we do. In this case, let's
	// let them override our default
	hintOnscreenKeyboard: function (hint) {
		if (
			window.app &&
			window.L.Map &&
			window.L.Map.THIS._docLayer.isCalc() &&
			hint !== undefined
		) {
			var command = {
				Enable: {
					type: 'boolean',
					value: hint,
				},
			};
			window.L.Map.THIS.sendUnoCommand('.uno:MoveKeepInsertMode', command);
		}
		window.keyboard.onscreenKeyboardHint = hint;
	},
};

window.memo = {
	_lastId: 0,

	/** This does pretty much the same as L.stamp. We can't use L.stamp because it's not yet in-scope by the first time we want to call window.memo.decorator */
	/** If you are able to use L.stamp instead, you probably should */
	_getId: function (obj) {
		if (obj === null || obj === undefined) {
			return '' + obj;
		}
		if (!('_coolMemoId' in obj)) {
			obj['_coolMemoId'] = ++window.memo._lastId;
		}
		return obj._coolMemoId;
	},

	_decoratorMemo: {},

	/** A decorator factory, which takes a decorator and prevents it from creating new instances when wrapping the same function */
	/** This is particularly useful for functions that take events, say, as .on and .off won't work properly if you don't provide the same function instance */
	decorator: function <
		T extends <U extends (...args: any[]) => unknown>(f: U) => U,
	>(decorator: T, context: any): T {
		var decoratorId = window.memo._getId(decorator);
		var contextId = window.memo._getId(context);

		return function (
			f: Parameters<typeof decorator>[0],
			...args: Tail<Parameters<typeof decorator>>
		) {
			var functionId = window.memo._getId(f);

			if (
				window.memo._decoratorMemo[
					decoratorId + ' ' + contextId + ' ' + functionId
				] === undefined
			) {
				window.memo._decoratorMemo[
					decoratorId + ' ' + contextId + ' ' + functionId
				] = decorator.bind(this)(f, ...args);

				if (context !== null && context !== undefined) {
					window.memo._decoratorMemo[
						decoratorId + ' ' + contextId + ' ' + functionId
					] =
						window.memo._decoratorMemo[
							decoratorId + ' ' + contextId + ' ' + functionId
						].bind(context);
				}
			}

			return window.memo._decoratorMemo[
				decoratorId + ' ' + contextId + ' ' + functionId
			];
		} as unknown as T;
	},

	_bindMemo: {},

	/** A decorator, which takes a function and binds it to an object */
	/** Similar to L.bind, but when given the same function and context we will return the previously bound function */
	bind: function <
		FunctionToBind extends (...args: any[]) => unknown,
		BindReturnType extends FunctionToBind,
	>(f: FunctionToBind, context: any): BindReturnType {
		var functionId = window.memo._getId(f);
		var contextId = window.memo._getId(context);
		if (window.memo._bindMemo[functionId + ' ' + contextId] === undefined) {
			window.memo._bindMemo[functionId + ' ' + contextId] = f.bind(context);
		}
		return window.memo._bindMemo[
			functionId + ' ' + contextId
		] as BindReturnType;
	},
};

window.touch = {
	/** a touchscreen event handler, supports both DOM and hammer.js events */
	isTouchEvent: function (e) {
		if ('originalEvent' in e) {
			e = e.originalEvent;
		}

		if (window.L.Browser.cypressTest && window.L.Browser.mobile) {
			return true; // As cypress tests on mobile tend to use "click" events instead of touches... we cheat to get them recognized as touch events
		}

		if ('pointerType' in e) {
			return e.pointerType === 'touch' || e.pointerType === 'kinect';
		}

		if ('isMouseEvent' in e && e.isMouseEvent !== undefined) {
			return !e.isMouseEvent;
		}

		return !(e instanceof MouseEvent);
	},

	/** a decorator that only runs the function if the event is a touch event */
	touchOnly: window.memo.decorator(function <
		TouchOnlyFunction extends (e: MaybeTouchEvent) => unknown,
		DecoratedFunction extends TouchOnlyFunction,
	>(f: TouchOnlyFunction): DecoratedFunction {
		return function (e: MaybeTouchEvent) {
			if (!window.touch.isTouchEvent(e)) return;
			return f.bind(this)(e);
		} as DecoratedFunction;
	}),

	/** a decorator that only runs the function if the event is not a touch event */
	mouseOnly: window.memo.decorator(function <
		MouseOnlyFunction extends (e: MaybeTouchEvent) => unknown,
		DecoratedFunction extends MouseOnlyFunction,
	>(f: MouseOnlyFunction): DecoratedFunction {
		return function (e: MaybeTouchEvent) {
			if (window.touch.isTouchEvent(e)) return;
			return f.bind(this)(e);
		} as DecoratedFunction;
	}),

	/** detect if the primary pointing device is of limited accuracy (generally a touchscreen) */
	/** you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may */
	/**   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor) */
	hasPrimaryTouchscreen: function () {
		return window.matchMedia('(pointer: coarse)').matches;
	},
	/** detect any pointing device is of limited accuracy (generally a touchscreen) */
	/** you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may */
	/**   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor) */
	hasAnyTouchscreen: function () {
		return window.matchMedia('(any-pointer: coarse)').matches;
	},
};

window.mode = {
	isChromebook: function () {
		return chromebook;
	},
	// Here "mobile" means "mobile phone" (at least for now). Has to match small screen size
	// requirement.
	isMobile: function () {
		if (window.mode.isChromebook()) return false;

		if (window.L.Browser.mobile && window.L.Browser.cypressTest) {
			return true;
		}

		return (
			window.L.Browser.mobile && (screen.width < 768 || screen.height < 768)
		);
	},
	// Mobile device with big screen size.
	isTablet: function () {
		if (window.mode.isChromebook()) return false;

		return window.L.Browser.mobile && !window.mode.isMobile();
	},
	isDesktop: function () {
		if (window.mode.isChromebook()) return true;

		return !window.L.Browser.mobile;
	},
	getDeviceFormFactor: function () {
		if (window.mode.isMobile()) return 'mobile';
		else if (window.mode.isTablet()) return 'tablet';
		else if (window.mode.isDesktop()) return 'desktop';
		else return null;
	},
};

window.isLocalStorageAllowed = (function () {
	var str = 'localstorage_test';
	try {
		window.localStorage.setItem(str, str);
		window.localStorage.removeItem(str);
		return true;
	} catch (e) {
		return false;
	}
})();

window.deviceFormFactor = window.mode.getDeviceFormFactor();

if (window.ThisIsTheiOSApp) {
	window.addEventListener('keydown', function (e: KeyboardEvent) {
		if (e.metaKey) {
			e.preventDefault();
		}
		if (window.MagicKeyDownHandler) window.MagicKeyDownHandler(e);
	});
	window.addEventListener('keyup', function (e: KeyboardEvent) {
		if (e.metaKey) {
			e.preventDefault();
		}
		if (window.MagicKeyUpHandler) window.MagicKeyUpHandler(e);
	});
}

document.addEventListener(
	'contextmenu',
	function (e) {
		e.preventDefault();
	},
	false
);

type Socket = ProxySocket | IndirectSocket | WebSocket | FakeWebSocket | any; // TODO: we need to type browser/src/core/Socket.js to remove this any

window.fakeWebSocketCounter = 0;

class FakeWebSocket {
	binaryType: BinaryType;
	bufferedAmount: number;
	extensions: string;
	protocol: string;
	readyState: number;
	id: number;

	constructor() {
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.protocol = '';
		this.readyState = 1;
		this.id = window.fakeWebSocketCounter++;
	}

	send(data: string) {
		window.postMobileMessage(data);
	}
	onclose() {}
	onerror() {}
	onmessage() {}
	onopen() {}
	close() {}
}
window.FakeWebSocket = FakeWebSocket;

window.proxySocketCounter = 0;

class ProxySocket {
	uri: string;
	binaryType: BinaryType;
	bufferedAmount: number;
	extensions: string;
	unloading: boolean;
	protocol: string;
	connected: boolean;
	readyState: number;
	sessionId: string;
	id: number;
	msgInflight: number;
	openInflight: number;
	inSerial: number;
	outSerial: number;
	minPollMs: number;
	maxPollMs: number;
	curPollMs: number;
	minIdlePollsToThrottle: number;
	throttleFactor: number;

	/** The last time we got any data. */
	lastDataTimestamp: number;

	decoder: TextDecoder;
	sendQueue: string;

	pollInterval?: ReturnType<typeof setInterval>;
	delaySession?: ReturnType<typeof setTimeout>;

	constructor(uri: string) {
		this.uri = uri;
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.unloading = false;
		this.protocol = '';
		this.connected = true;
		this.readyState = 0; // connecting
		this.sessionId = 'open';
		this.id = window.proxySocketCounter++;
		this.msgInflight = 0;
		this.openInflight = 0;
		this.inSerial = 0;
		this.outSerial = 0;
		this.minPollMs = 25; // Anything less than ~25 ms can overwhelm the HTTP server.
		this.maxPollMs = 500; // We can probably go as much as 1-2 seconds without ill-effect.
		this.curPollMs = this.minPollMs; // The current poll period.
		this.minIdlePollsToThrottle = 3; // This many 'no data' responses and we throttle.
		this.throttleFactor = 1.15; // How rapidly to throttle. 15% takes 4s to go from 25 to 500ms.
		this.lastDataTimestamp = performance.now();
		this.decoder = new TextDecoder();
		this.sendQueue = '';

		window.app.console.debug('proxy: new socket ' + this.id + ' ' + this.uri);

		// queue fetch of session id.
		this.getSessionId();
	}
	onclose() {}
	onerror() {}
	onopen() {}
	onmessage(_msg: unknown) {}
	decode(bytes: Uint8Array, start: number, end: number) {
		return this.decoder.decode(bytes.slice(start, end));
	}
	parseIncomingArray(arr: Uint8Array) {
		//window.app.console.debug('proxy: parse incoming array of length ' + arr.length);
		for (var i = 0; i < arr.length; ++i) {
			var left = arr.length - i;
			if (left < 4) {
				//window.app.console.debug('no data left');
				break;
			}
			var type = String.fromCharCode(arr[i + 0]);
			if (type != 'T' && type != 'B') {
				window.app.console.debug('wrong data type: ' + type);
				break;
			}
			i++;

			// Serial
			if (arr[i] !== 48 && arr[i + 1] !== 120) {
				// '0x'
				window.app.console.debug('missing hex preamble');
				break;
			}
			i += 2;
			var numStr = '';
			var start = i;
			while (arr[i] != 10)
				// '\n'
				i++;
			numStr = this.decode(arr, start, i);
			var serial = parseInt(numStr, 16);

			i++; // skip \n

			// Size:
			if (arr[i] !== 48 && arr[i + 1] !== 120) {
				// '0x'
				window.app.console.debug('missing hex preamble');
				break;
			}
			i += 2;
			start = i;
			while (arr[i] != 10)
				// '\n'
				i++;
			numStr = this.decode(arr, start, i);
			var size = parseInt(numStr, 16);

			i++; // skip \n

			var data;
			if (type == 'T') data = this.decode(arr, i, i + size);
			else data = arr.slice(i, i + size);

			if (serial !== this.inSerial + 1) {
				window.app.console.debug(
					'Error: serial mismatch ' + serial + ' vs. ' + (this.inSerial + 1)
				);
			}
			this.inSerial = serial;
			this.onmessage({ data: data });

			i += size; // skip trailing '\n' in loop-increment
		}
	}
	_signalErrorClose() {
		clearInterval(this.pollInterval);
		clearTimeout(this.delaySession);
		this.pollInterval = undefined;
		this.delaySession = undefined;

		if (this.readyState < 3) {
			this.onerror();
			this.onclose();
		}
		this.sessionId = 'open';
		this.inSerial = 0;
		this.outSerial = 0;
		this.msgInflight = 0;
		this.openInflight = 0;
		this.readyState = 3; // CLOSED
	}
	// For those who think that long-running sockets are a
	// better way to wait: you're so right. However, each
	// consumes a scarce server worker thread while it waits,
	// so ... back in the real world:
	_setPollInterval(intervalMs: number) {
		clearInterval(this.pollInterval);
		if (this.readyState === 1)
			this.pollInterval = setInterval(this.doSend.bind(this), intervalMs);
	}
	doSend() {
		if (this.sessionId === 'open') {
			if (this.readyState === 3)
				window.app.console.debug('Error: sending on closed socket');
			return;
		}

		if (this.msgInflight >= 4) {
			// something went badly wrong.
			// We shouldn't get here because we throttle sending when we
			// have something in flight, but if the server hangs, we
			// will do up to 3 retries before we end up here and yield.
			if (this.curPollMs < this.maxPollMs) {
				this.curPollMs =
					Math.min(this.maxPollMs, this.curPollMs * this.throttleFactor) | 0;
				window.app.console.debug(
					'High latency connection - too much in-flight, throttling to ' +
						this.curPollMs +
						' ms.'
				);
				this._setPollInterval(this.curPollMs);
			} else if (performance.now() - this.lastDataTimestamp > 30 * 1000) {
				window.app.console.debug(
					'Close connection after no response for 30secs'
				);
				this._signalErrorClose();
			} else
				window.app.console.debug(
					'High latency connection - too much in-flight, pausing.'
				);
			return;
		}

		// Maximize the timeout, instead of stopping altogethr,
		// so we don't hang when the following request takes
		// too long, hangs, throws, etc. we can recover.
		this._setPollInterval(this.maxPollMs);

		//window.app.console.debug('send msg - ' + that.msgInflight + ' on session ' +
		//	      that.sessionId + '  queue: "' + that.sendQueue + '"');
		var req = new XMLHttpRequest();
		req.open('POST', this.getEndPoint('write'));
		req.responseType = 'arraybuffer';
		req.addEventListener('load', () => {
			if (req.status == 200) {
				var data = new Uint8Array(req.response);
				if (data.length) {
					// We have some data back from WSD.
					// Another user might be editing and we want
					// to see their changes in real time.
					this.curPollMs = this.minPollMs; // Drain fast.
					this._setPollInterval(this.curPollMs);
					this.lastDataTimestamp = performance.now();

					this.parseIncomingArray(data);
					return;
				}
			} else {
				window.app.console.debug(
					'proxy: error on incoming response ' + req.status
				);
				this._signalErrorClose();
			}

			if (this.curPollMs < this.maxPollMs) {
				// If we aren't throttled, see if we should.
				// Has it been long enough since we got any data?
				var timeSinceLastDataMs =
					(performance.now() - this.lastDataTimestamp) | 0;
				if (
					timeSinceLastDataMs >=
					this.minIdlePollsToThrottle * this.curPollMs
				) {
					// Throttle.
					this.curPollMs =
						Math.min(this.maxPollMs, this.curPollMs * this.throttleFactor) | 0;
					//window.app.console.debug('No data for ' + timeSinceLastDataMs + ' ms -- throttling to ' + that.curPollMs + ' ms.');
				}
			}

			this._setPollInterval(this.curPollMs);
		});
		req.addEventListener('loadend', () => {
			this.msgInflight--;
		});
		req.send(this.sendQueue);
		this.sendQueue = '';
		this.msgInflight++;
	}
	getSessionId() {
		if (this.openInflight > 0) {
			window.app.console.debug('Waiting for session open');
			return;
		}

		if (this.delaySession) return;

		// avoid attempting to re-connect too quickly
		if (window.lastCreatedProxySocket) {
			var msSince = performance.now() - window.lastCreatedProxySocket;
			if (msSince < 250) {
				var delay = 250 - msSince;
				window.app.console.debug(
					'Wait to re-try session creation for ' + delay + 'ms'
				);
				this.curPollMs = delay; // ms
				this.delaySession = setTimeout(() => {
					this.delaySession = undefined;
					this.getSessionId();
				}, delay);
				return;
			}
		}
		window.lastCreatedProxySocket = performance.now();

		var req = new XMLHttpRequest();
		req.open('POST', this.getEndPoint('open'));
		req.responseType = 'text';
		req.addEventListener('load', () => {
			window.app.console.debug('got session: ' + req.responseText);
			if (
				req.status !== 200 ||
				!req.responseText ||
				req.responseText.indexOf('\n') >= 0
			) {
				// multi-line error
				window.app.console.debug(
					'Error: failed to fetch session id! error: ' + req.status
				);
				this._signalErrorClose();
			} // we connected - lets get going ...
			else {
				this.sessionId = req.responseText;
				this.readyState = 1;
				this.onopen();
				this._setPollInterval(this.curPollMs);
			}
		});
		req.addEventListener('loadend', () => {
			window.app.console.debug('Open completed state: ' + this.readyState);
			this.openInflight--;
		});
		req.send('');
		this.openInflight++;
	}
	send(msg: string) {
		var hadData = this.sendQueue.length > 0;
		this.sendQueue = this.sendQueue.concat(
			'B0x' +
				this.outSerial.toString(16) +
				'\n' +
				'0x' +
				new TextEncoder().encode(msg).length.toString(16) +
				'\n' +
				msg +
				'\n'
		);
		this.outSerial++;

		// Send ASAP, if we have throttled.
		if (this.curPollMs > this.minPollMs || !hadData) {
			// Unless we are backed up.
			if (this.msgInflight <= 3) {
				//window.app.console.debug('Have data to send, lowering poll interval.');
				this.curPollMs = this.minPollMs;
				this._setPollInterval(this.curPollMs);
			}
		}
	}
	/**
	 * @parameters beacon: whether we should send this asynchronously normally used if the page is about to unload
	 */
	sendCloseMsg(beacon: boolean) {
		var url = this.getEndPoint('close');
		if (!beacon) {
			var req = new XMLHttpRequest();
			req.open('POST', url);
			req.send('');
		} else navigator.sendBeacon(url, '');
	}
	close() {
		var oldState = this.readyState;
		window.app.console.debug('proxy: close socket');
		this.readyState = 3;
		this.onclose();
		clearInterval(this.pollInterval);
		clearTimeout(this.delaySession);
		this.pollInterval = undefined;
		if (oldState === 1)
			// was open
			this.sendCloseMsg(this.unloading);
		this.sessionId = 'open';
	}
	setUnloading() {
		this.unloading = true;
	}
	getEndPoint(command: string) {
		var base = this.uri;
		return base + '/' + this.sessionId + '/' + command + '/' + this.outSerial;
	}
}

window.ProxySocket = ProxySocket;

// TODO: is this unreachable?
if (window.socketProxy) {
	// re-write relative URLs in CSS - somewhat grim.
	window.addEventListener(
		'load',
		function () {
			var replaceUrls = function (rules: CSSRuleList, replaceBase: string) {
				if (!rules) return;

				for (var r = 0; r < rules.length; ++r) {
					// check subset of rules like @media or @import
					const rule: CSSRule & {
						style?: CSSStyleDeclaration;
						cssRules?: CSSRuleList;
					} = rules[r];

					if ('cssRules' in rule && rule.cssRules !== undefined) {
						replaceUrls(rule.cssRules, replaceBase);
						continue;
					}

					if (!('style' in rule && rule.style !== undefined)) continue;

					var img = rule.style.backgroundImage;
					if (img === '' || img === undefined) continue;

					if (img.startsWith('url("images/')) {
						rule.style.backgroundImage = img.replace(
							'url("images/',
							replaceBase + '/images/'
						);
					}
					if (img.startsWith('url("remote/')) {
						rule.style.backgroundImage = img.replace(
							'url("remote/',
							replaceBase + '/remote/'
						);
					}
				}
			};
			var sheets = document.styleSheets;
			for (var i = 0; i < sheets.length; ++i) {
				var relBases;
				try {
					relBases = sheets[i].href.split('/');
				} catch (err) {
					window.app.console.log('Missing href from CSS number ' + i);
					continue;
				}
				relBases.pop(); // bin last - css name.
				var replaceBase = 'url("' + relBases.join('/');

				var rules;
				try {
					rules = sheets[i].cssRules;
				} catch (err) {
					window.app.console.log('Missing CSS from ' + sheets[i].href);
					continue;
				}
				replaceUrls(rules, replaceBase);
			}
		},
		false
	);
}

// indirect socket to wrap the asyncness around fetching the routetoken from indirection url endpoint
class IndirectSocket {
	uri: string;
	binaryType: BinaryType;
	unloading: boolean;
	readyState: number;
	innerSocket: Socket;

	constructor(uri: string) {
		this.uri = uri;
		this.binaryType = 'blob';
		this.unloading = false;
		this.readyState = 0; // connecting
		this.innerSocket = undefined;

		var http = new XMLHttpRequest();
		http.open(
			'GET',
			window.indirectionUrl + '?Uri=' + encodeURIComponent(this.uri),
			true
		);
		http.responseType = 'json';
		http.addEventListener('load', () => {
			if (http.status === 200) {
				var uriWithRouteToken = http.response.uri;
				window.expectedServerId = http.response.serverId;
				var params = new URL(uriWithRouteToken).searchParams;
				window.routeToken = params.get('RouteToken');
				window.app.console.log('updated routeToken: ' + window.routeToken);
				this.innerSocket = new WebSocket(uriWithRouteToken);
				this.innerSocket.binaryType = this.binaryType;
				this.innerSocket.onerror = () => {
					this.readyState = this.innerSocket.readyState;
					this.onerror();
				};
				this.innerSocket.onclose = () => {
					this.readyState = 3;
					this.onclose();
					this.innerSocket.onerror = function () {};
					this.innerSocket.onclose = function () {};
					this.innerSocket.onmessage = function () {};
				};
				this.innerSocket.onopen = () => {
					this.readyState = 1;
					this.onopen();
				};
				this.innerSocket.onmessage = (e: Event) => {
					this.readyState = this.innerSocket.readyState;
					this.onmessage(e);
				};
			} else if (http.status === 202) {
				this.sendPostMsg(http.response.errorCode);
				var timeoutFn = (indirectionUrl: string, uri: string) => {
					console.warn('Requesting again for routeToken');
					http.open(
						'GET',
						indirectionUrl + '?Uri=' + encodeURIComponent(uri),
						true
					);
					http.send();
				};
				setTimeout(timeoutFn, 3000, window.indirectionUrl, this.uri);
			} else {
				window.app.console.error(
					'Indirection url: error on incoming response ' + http.status
				);
				this.sendPostMsg(-1);
			}
		});
		http.send();
	}

	onclose() {}
	onerror() {}
	onmessage(_msg: any) {}
	onopen() {}
	close() {
		this.innerSocket.close();
	}
	send(msg: string) {
		this.innerSocket.send(msg);
	}
	setUnloading() {
		this.unloading = true;
	}
	sendPostMsg(errorCode: number) {
		var errorMsg;
		if (errorCode === 0) {
			errorMsg = window._('Cluster is scaling, retrying...');
		} else if (errorCode === 1) {
			errorMsg = window._('Document is migrating to new server, retrying...');
		} else {
			errorMsg = window._('Failed to get RouteToken from controller');
		}
		var msg = {
			MessageId: 'Action_Load_Resp',
			SendTime: Date.now(),
			Values: {
				success: false,
				errorMsg: errorMsg,
				errorType: 'clusterscaling',
			},
		};
		window.parent.postMessage(JSON.stringify(msg), '*');
	}
}

window.IndirectSocket = IndirectSocket;

window.createWebSocket = function (uri: string) {
	if ('processCoolUrl' in window) {
		uri = window.processCoolUrl({ url: uri, type: 'ws' });
	}

	if (window.socketProxy) {
		window.socketProxy = true;
		return new window.ProxySocket(uri);
	} else if (window.indirectionUrl != '' && !window.migrating) {
		window.indirectSocket = true;
		return new window.IndirectSocket(uri);
	} else {
		return new WebSocket(uri);
	}
};

window._ = function (string) {
	// In the mobile app case we can't use the stuff from l10n-for-node, as that assumes HTTP.
	if (window.ThisIsAMobileApp) {
		// We use another approach just for iOS for now.
		if (
			window.LOCALIZATIONS &&
			Object.prototype.hasOwnProperty.call(window.LOCALIZATIONS, string)
		) {
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

// Some window variables are defined in cool.html, among them:
// window.host: the host URL, with ws(s):// protocol
// window.serviceRoot: an optional root path on the server, typically blank.

// Setup window.webserver: the host URL, with http(s):// protocol (used to fetch files).
if (window.webserver === undefined) {
	var protocol =
		window.location.protocol === 'file:' ? 'https:' : window.location.protocol;
	window.webserver = window.host.replace(/^(ws|wss):/i, protocol);
	window.webserver = window.webserver.replace(/\/*$/, ''); // Remove trailing slash.
}

var docParams, wopiParams;
var filePath = window.coolParams.get('file_path');
window.wopiSrc = window.coolParams.get('WOPISrc');
if (window.wopiSrc != '') {
	window.docURL = decodeURIComponent(window.wopiSrc);
	if (window.accessToken !== '') {
		wopiParams = {
			access_token: window.accessToken,
			access_token_ttl: window.accessTokenTTL,
		} as const;
	} else if (window.accessHeader !== '') {
		wopiParams = { access_header: window.accessHeader } as const;
	}

	if (wopiParams) {
		docParams = Object.entries(wopiParams)
			.map(([key, value]) => {
				return encodeURIComponent(key) + '=' + encodeURIComponent(value as any);
			})
			.join('&');
	}
} else if (window.ThisIsTheEmscriptenApp) {
	// This is of course just a horrible temporary hack
	window.docURL = 'file:///sample.docx';
} else {
	window.docURL = filePath;
}

window.makeWsUrl = function (path) {
	window.app.console.assert(
		window.host.startsWith('ws'),
		'host is not ws: ' + window.host
	);
	return window.host + window.serviceRoot + path;
};

// Form a URI from the docUrl and wopiSrc and encodes.
// The docUrlParams, suffix, and wopiSrc are optionally hexified.
window.routeToken = '';
window.makeDocAndWopiSrcUrl = function (
	root,
	docUrlParams,
	suffix,
	wopiSrcParam
) {
	var wopiSrc = '';
	if (window.wopiSrc != '') {
		wopiSrc = '?WOPISrc=' + window.wopiSrc;
		if (window.routeToken != '') wopiSrc += '&RouteToken=' + window.routeToken;
		wopiSrc += '&compat=';
		if (wopiSrcParam && wopiSrcParam.length > 0) wopiSrc += '&' + wopiSrcParam;
	} else if (wopiSrcParam && wopiSrcParam.length > 0) {
		wopiSrc = '?' + wopiSrcParam;
	}

	suffix = suffix || '/ws';
	var encodedDocUrl = encodeURIComponent(docUrlParams) + suffix + wopiSrc;
	if (window.hexifyUrl) encodedDocUrl = window.hexEncode(encodedDocUrl);
	return root + encodedDocUrl + '/ws';
};

// Form a valid WS URL to the host with the given path and
// encode the document URL and params.
window.makeWsUrlWopiSrc = function (path, docUrlParams, suffix, wopiSrcParam) {
	var websocketURI = window.makeWsUrl(path);
	return window.makeDocAndWopiSrcUrl(
		websocketURI,
		docUrlParams,
		suffix,
		wopiSrcParam
	);
};

// Form a valid HTTP URL to the host with the given path.
window.makeHttpUrl = function (path) {
	window.app.console.assert(
		window.webserver.startsWith('http'),
		'webserver is not http: ' + window.webserver
	);
	return window.webserver + window.serviceRoot + path;
};

// Form a valid HTTP URL to the host with the given path and
// encode the document URL and params.
window.makeHttpUrlWopiSrc = function (
	path,
	docUrlParams,
	suffix,
	wopiSrcParam
) {
	var httpURI = window.makeHttpUrl(path);
	return window.makeDocAndWopiSrcUrl(
		httpURI,
		docUrlParams,
		suffix,
		wopiSrcParam
	);
};

// Encode a string to hex.
window.hexEncode = function (string) {
	var bytes = new TextEncoder().encode(string);
	var hex = '0x';
	for (var i = 0; i < bytes.length; ++i) {
		hex += bytes[i].toString(16);
	}
	return hex;
};

// Decode hexified string back to plain text.
window.hexDecode = function (hex) {
	if (hex.startsWith('0x')) hex = hex.substring(2);
	var bytes = new Uint8Array(hex.length / 2);
	for (var i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return new TextDecoder().decode(bytes);
};

if (window.ThisIsAMobileApp) {
	window.socket = new window.FakeWebSocket();
	window.TheFakeWebSocket = window.socket;
} else {
	// The URL may already contain a query (e.g., 'http://server.tld/foo/wopi/files/bar?desktop=baz') - then just append more params
	var docParamsPart = docParams
		? (window.docURL.includes('?') ? '&' : '?') + docParams
		: '';
	var websocketURI = window.makeWsUrlWopiSrc(
		'/cool/',
		window.docURL + docParamsPart
	);
	try {
		window.socket = window.createWebSocket(websocketURI);
	} catch (err) {
		window.app.console.log(err);
	}
}

var isRandomUser = window.coolParams.get('randomUser');
if (isRandomUser) {
	// List of languages supported in core
	var randomUserLangs = [
		'ar',
		'bg',
		'ca',
		'cs',
		'da',
		'de',
		'el',
		'en-US',
		'en-GB',
		'eo',
		'es',
		'eu',
		'fi',
		'fr',
		'gl',
		'he',
		'hr',
		'hu',
		'id',
		'is',
		'it',
		'ja',
		'ko',
		'lo',
		'nb',
		'nl',
		'oc',
		'pl',
		'pt',
		'pt-BR',
		'sq',
		'ru',
		'sk',
		'sl',
		'sv',
		'tr',
		'uk',
		'vi',
		'zh-CN',
		'zh-TW',
	];
	var randomUserLang =
		randomUserLangs[Math.floor(Math.random() * randomUserLangs.length)];
	window.app.console.log(
		'Randomize Settings: Set language to: ',
		randomUserLang
	);
	window.coolParams.set('lang', randomUserLang);
	window.coolParams.set('debug', 'true');
}

var lang = window.coolParams.get('lang');
if (lang) window.langParam = encodeURIComponent(lang);
else window.langParam = 'en-US';
window.langParamLocale = new Intl.Locale(window.langParam);
window.queueMsg = [];
if (window.ThisIsTheEmscriptenApp)
	// Temporary hack
	window.LANG = 'en-US';
else if (window.ThisIsAMobileApp) window.LANG = lang;
if (window.socket && window.socket.readyState !== 3) {
	window.socket.onopen = function () {
		if (window.socket.readyState === 1) {
			var ProtocolVersionNumber = '0.1';
			var timestamp = encodeURIComponent(window.coolParams.get('timestamp'));
			var msg = 'load url=' + encodeURIComponent(window.docURL);

			var now0 = Date.now();
			var now1 = performance.now();
			var now2 = Date.now();
			window.socket.send(
				'coolclient ' +
					ProtocolVersionNumber +
					' ' +
					(now0 + now2) / 2 +
					' ' +
					now1
			);

			var isCalcTest =
				window.docURL.includes('data/desktop/calc/') ||
				window.docURL.includes('data/mobile/calc/') ||
				window.docURL.includes('data/idle/calc/') ||
				window.docURL.includes('data/multiuser/calc/');

			if (window.L.Browser.cypressTest && isCalcTest)
				window.enableAccessibility = false;

			var accessibilityState =
				window.localStorage.getItem('accessibilityState') === 'true';
			accessibilityState =
				accessibilityState || (window.L.Browser.cypressTest && !isCalcTest);
			msg += ' accessibilityState=' + accessibilityState;

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

			if (window.deviceFormFactor) {
				msg += ' deviceFormFactor=' + window.deviceFormFactor;
			}
			if (window.isLocalStorageAllowed) {
				var spellOnline = window.localStorage.getItem('SpellOnline');
				if (spellOnline) {
					msg += ' spellOnline=' + spellOnline;
				}
			}

			msg += ' timezone=' + Intl.DateTimeFormat().resolvedOptions().timeZone;

			window.socket.send(msg);
		}
	};

	window.socket.onerror = function (event: Event) {
		window.app.console.log(event);
	};

	window.socket.onclose = function (event: Event) {
		window.app.console.log(event);
	};

	window.socket.onmessage = function (event: any) {
		if (
			'_onMessage' in window.socket &&
			typeof window.socket._onMessage === 'function'
		) {
			window.socket._emptyQueue();
			window.socket._onMessage(event);
		} else {
			window.queueMsg.push(event.data);
		}
	};

	window.socket.binaryType = 'arraybuffer';

	if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) {
		// This corresponds to the initial GET request when creating a WebSocket
		// connection and tells the app's code that it is OK to start invoking
		// TheFakeWebSocket's onmessage handler. The app code that handles this
		// special message knows the document to be edited anyway, and can send it
		// on as necessary to the Online code.
		window.postMobileMessage('HULLO');
		// A FakeWebSocket is immediately open.
		window.socket.onopen(new Event('open'));
	}
}
