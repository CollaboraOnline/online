/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-empty-function */
// @ts-nocheck
/* -*- js-indent-level: 8 -*- */

/* global app ArrayBuffer Uint8Array _ */

/*
	For extending window.app object, please see "docstate.js" file.
	Below definition is only for the properties that this (global.ts) file needs at initialization.
*/
window.app = {
	socket: null,
	console: {},
};

// Put these into a class to separate them better.
class BrowserProperties {
	static initiateBrowserProperties(global) {
		global.L = {};

		const ua = navigator.userAgent.toLowerCase(),
			uv = navigator.vendor.toLowerCase(),
			doc = document.documentElement,
			ie = 'ActiveXObject' in global,
			cypressTest = ua.indexOf('cypress') !== -1,
			// Firefox has undefined navigator.clipboard.read and navigator.clipboard.write,
			// unsecure contexts (such as http + non-localhost) has the entire navigator.clipboard
			// undefined.
			hasNavigatorClipboardRead =
				navigator.clipboard && navigator.clipboard.read,
			hasNavigatorClipboardWrite =
				navigator.clipboard && navigator.clipboard.write,
			webkit = ua.indexOf('webkit') !== -1,
			chrome = ua.indexOf('chrome') !== -1,
			gecko =
				(ua.indexOf('gecko') !== -1 ||
					(cypressTest && 'MozUserFocus' in doc.style)) &&
				!webkit &&
				!global.opera &&
				!ie,
			safari =
				!chrome && (ua.indexOf('safari') !== -1 || uv.indexOf('apple') == 0),
			win = navigator.platform.indexOf('Win') === 0,
			mobile =
				typeof orientation !== 'undefined' || ua.indexOf('mobile') !== -1,
			msPointer = !global.PointerEvent && global.MSPointerEvent,
			pointer =
				(global.PointerEvent &&
					navigator.pointerEnabled &&
					navigator.maxTouchPoints) ||
				msPointer,
			webkit3d =
				'WebKitCSSMatrix' in global && 'm11' in new global.WebKitCSSMatrix(),
			gecko3d = 'MozPerspective' in doc.style;

		const mac =
			navigator.appVersion.indexOf('Mac') != -1 ||
			navigator.userAgent.indexOf('Mac') != -1;
		const chromebook =
			global.ThisIsTheAndroidApp && global.COOLMessageHandler.isChromeOS();

		const navigatorLang =
			navigator.languages && navigator.languages.length
				? navigator.languages[0]
				: navigator.language ||
					navigator.userLanguage ||
					navigator.browserLanguage ||
					navigator.systemLanguage;

		function getFirefoxVersion() {
			let version = '';

			const userAgent = navigator.userAgent.toLowerCase();
			if (userAgent.indexOf('firefox') !== -1) {
				const matches = userAgent.match(/firefox\/([0-9]+\.*[0-9]*)/);
				if (matches) {
					version = matches[1];
				}
			}
			return version;
		}

		window.L.Browser = {
			// @property ie: Boolean
			// `true` for all Internet Explorer versions (not Edge).
			ie: ie,

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

			// @property any3d: Boolean
			// `true` for all browsers supporting CSS transforms.
			any3d: !global.L_DISABLE_3D && (webkit3d || gecko3d),

			// @property mobile: Boolean
			// `true` for all browsers running in a mobile device.
			mobile: mobile,

			// @property mobileWebkit: Boolean
			// `true` for all webkit-based browsers in a mobile device.
			mobileWebkit: mobile && webkit,

			// @property cypressTest: Boolean
			// `true` when the browser run by cypress
			cypressTest: cypressTest,

			// @property hasNavigatorClipboardRead: Boolean
			// `true` when permission-based clipboard paste is available.
			hasNavigatorClipboardRead: hasNavigatorClipboardRead,

			// @property hasNavigatorClipboardWrite: Boolean
			// `true` when permission-based clipboard copy is available.
			hasNavigatorClipboardWrite: hasNavigatorClipboardWrite,

			// @property msPointer: Boolean
			// `true` for browsers implementing the Microsoft touch events model (notably IE10).
			msPointer: !!msPointer,

			// @property pointer: Boolean
			// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
			pointer: !!pointer,

			// @property retina: Boolean
			// `true` for browsers on a high-resolution "retina" screen.
			retina:
				(global.devicePixelRatio ||
					global.screen.deviceXDPI / global.screen.logicalXDPI) > 1,

			// @property lang: String
			// browser language locale
			lang: navigatorLang,
		};

		global.mode = {
			isChromebook: function () {
				return chromebook;
			},
			// Here "mobile" means "mobile phone" (at least for now). Has to match small screen size
			// requirement.
			isMobile: function () {
				if (global.mode.isChromebook()) return false;

				if (global.L.Browser.mobile && global.L.Browser.cypressTest) {
					return true;
				}

				return (
					global.L.Browser.mobile && (screen.width < 768 || screen.height < 768)
				);
			},
			// Mobile device with big screen size.
			isTablet: function () {
				if (global.mode.isChromebook()) return false;

				return global.L.Browser.mobile && !global.mode.isMobile();
			},
			isDesktop: function () {
				if (global.mode.isChromebook()) return true;

				return !global.L.Browser.mobile;
			},
			getDeviceFormFactor: function () {
				if (global.mode.isMobile()) return 'mobile';
				else if (global.mode.isTablet()) return 'tablet';
				else if (global.mode.isDesktop()) return 'desktop';
				else return null;
			},
		};
	}
}

class InitializerBase {
	constructor() {
		BrowserProperties.initiateBrowserProperties(window);

		this.uriPrefix = document.getElementById('init-uri-prefix').value;
		this.brandingUriPrefix = this.uriPrefix;

		window.welcomeUrl = document.getElementById('init-welcome-url')
			? document.getElementById('init-welcome-url').value
			: '';
		window.feedbackUrl = document.getElementById('init-feedback-url')
			? document.getElementById('init-feedback-url').value
			: '';
		window.buyProductUrl = document.getElementById('init-buy-product-url')
			? document.getElementById('init-buy-product-url').value
			: '';
		let initCSSVars = document.getElementById('init-css-vars')
			? document.getElementById('init-css-vars').value
			: '';

		if (initCSSVars) {
			initCSSVars = atob(initCSSVars);
			const sheet = new CSSStyleSheet();
			sheet.replace(initCSSVars);
			document.adoptedStyleSheets.push(sheet);
		}

		const element = document.getElementById('initial-variables');

		window.host = '';
		window.serviceRoot = '';
		window.hexifyUrl = false;
		window.versionPath = '';
		window.accessToken = element.dataset.accessToken;
		window.accessTokenTTL = element.dataset.accessTokenTtl;
		window.accessHeader = element.dataset.accessHeader;
		window.postMessageOriginExt = '';
		window.coolwsdVersion = '';
		window.enableWelcomeMessage = false;
		window.autoShowWelcome = false;
		window.autoShowFeedback = true;
		window.allowUpdateNotification = false;
		window.useIntegrationTheme = false;
		window.enableMacrosExecution = false;
		window.enableAccessibility = false;
		window.protocolDebug = false;
		window.enableDebug = false;
		window.frameAncestors = '';
		window.socketProxy = false;
		window.uiDefaults = {};
		window.checkFileInfoOverride = {};
		window.deeplEnabled = false;
		window.zoteroEnabled = false;
		window.savedUIState = true;
		window.wasmEnabled = false;
		window.indirectionUrl = '';
		window.geolocationSetup = false;

		window.tileSize = 256;

		window.ThisIsAMobileApp = false;
		window.ThisIsTheiOSApp = false;
		window.ThisIsTheGtkApp = false;
		window.ThisIsTheAndroidApp = false;
		window.ThisIsTheEmscriptenApp = false;

		window.bundlejsLoaded = false;
		window.fullyLoadedAndReady = false;
		window.addEventListener(
			'load',
			function () {
				window.fullyLoadedAndReady = true;
			},
			false,
		);

		this.initiateCoolParams();
	}

	initiateCoolParams() {
		const gls = window.location.search;

		const coolParams = {
			p: new URLSearchParams(gls.slice(gls.lastIndexOf('?') + 1)),
		};

		/* We need to return an empty string instead of `null` */
		coolParams.get = function (name) {
			const value = this.p.get(name);
			return value === null ? '' : value;
		}.bind(coolParams);

		coolParams.set = function (name, value) {
			this.p.set(name, value);
		}.bind(coolParams);

		window.coolParams = coolParams;
	}

	loadCSSFiles() {
		// Dynamically load the appropriate *-mobile.css, *-tablet.css or *-desktop.css
		const link = document.createElement('link');
		link.setAttribute('rel', 'stylesheet');
		link.setAttribute('type', 'text/css');

		const brandingLink = document.createElement('link');
		brandingLink.setAttribute('rel', 'stylesheet');
		brandingLink.setAttribute('type', 'text/css');

		const theme_name = document.getElementById('init-branding-name').value;
		let theme_prefix = '';

		if (window.useIntegrationTheme && theme_name !== '')
			theme_prefix = theme_name + '/';

		if (window.mode.isMobile()) {
			link.setAttribute('href', this.uriPrefix + 'device-mobile.css');
			brandingLink.setAttribute(
				'href',
				this.brandingUriPrefix + theme_prefix + 'branding-mobile.css',
			);
		} else if (window.mode.isTablet()) {
			link.setAttribute('href', this.uriPrefix + 'device-tablet.css');
			brandingLink.setAttribute(
				'href',
				this.brandingUriPrefix + theme_prefix + 'branding-tablet.css',
			);
		} else {
			link.setAttribute('href', this.uriPrefix + 'device-desktop.css');
			brandingLink.setAttribute(
				'href',
				this.brandingUriPrefix + theme_prefix + 'branding-desktop.css',
			);
		}

		const otherStylesheets = document.querySelectorAll(
			'link[rel="stylesheet"]',
		);
		const lastOtherStylesheet = otherStylesheets[otherStylesheets.length - 1];

		lastOtherStylesheet
			.insertAdjacentElement('afterend', link)
			.insertAdjacentElement('afterend', brandingLink);
	}

	initializeViewMode() {
		const darkTheme = window.coolParams.get('darkTheme');
		if (darkTheme) {
			window.uiDefaults = { darkTheme: true };
		}
	}

	afterInitialization() {
		this.initializeViewMode();
		this.loadCSSFiles();
	}
}

class BrowserInitializer extends InitializerBase {
	constructor() {
		super();

		window.WOPIpostMessageReady = false;

		// Start listening for Host_PostmessageReady message and save the result for future
		window.addEventListener(
			'message',
			this.postMessageHandler.bind(this),
			false,
		);

		const element = document.getElementById('initial-variables');

		window.host = element.dataset.host;
		window.serviceRoot = element.dataset.serviceRoot;
		window.hexifyUrl =
			element.dataset.hexifyUrl.toLowerCase().trim() === 'true';
		window.versionPath = element.dataset.versionPath;

		window.postMessageOriginExt = element.dataset.postMessageOriginExt;
		window.coolLogging = element.dataset.coolLogging;
		window.coolwsdVersion = element.dataset.coolwsdVersion;
		window.enableWelcomeMessage =
			element.dataset.enableWelcomeMessage.toLowerCase().trim() === 'true';
		window.autoShowWelcome =
			element.dataset.autoShowWelcome.toLowerCase().trim() === 'true';
		window.autoShowFeedback =
			element.dataset.autoShowFeedback.toLowerCase().trim() === 'true';
		window.allowUpdateNotification =
			element.dataset.allowUpdateNotification.toLowerCase().trim() === 'true';
		window.userInterfaceMode = element.dataset.userInterfaceMode;
		window.useIntegrationTheme =
			element.dataset.useIntegrationTheme.toLowerCase().trim() === 'true';
		window.enableMacrosExecution =
			element.dataset.enableMacrosExecution.toLowerCase().trim() === 'true';
		window.enableAccessibility =
			element.dataset.enableAccessibility.toLowerCase().trim() === 'true';
		window.outOfFocusTimeoutSecs = parseInt(
			element.dataset.outOfFocusTimeoutSecs,
		);
		window.idleTimeoutSecs = parseInt(element.dataset.idleTimeoutSecs);
		window.protocolDebug =
			element.dataset.protocolDebug.toLowerCase().trim() === 'true';
		window.enableDebug =
			element.dataset.enableDebug.toLowerCase().trim() === 'true';
		window.frameAncestors = decodeURIComponent(element.dataset.frameAncestors);
		window.socketProxy =
			element.dataset.socketProxy.toLowerCase().trim() === 'true';
		window.uiDefaults = JSON.parse(atob(element.dataset.uiDefaults));
		window.checkFileInfoOverride = element.dataset.checkFileInfoOverride;
		window.deeplEnabled =
			element.dataset.deeplEnabled.toLowerCase().trim() === 'true';
		window.zoteroEnabled =
			element.dataset.zoteroEnabled.toLowerCase().trim() === 'true';
		window.savedUIState =
			element.dataset.savedUiState.toLowerCase().trim() === 'true';
		window.wasmEnabled =
			element.dataset.wasmEnabled.toLowerCase().trim() === 'true';
		window.indirectionUrl = element.dataset.indirectionUrl;
		window.geolocationSetup =
			element.dataset.geolocationSetup.toLowerCase().trim() === 'true';
	}

	postMessageHandler(e) {
		if (!(e && e.data)) return;

		let msg;
		try {
			msg = JSON.parse(e.data);
		} catch (err) {
			return;
		}

		if (msg.MessageId === 'Host_PostmessageReady') {
			window.WOPIPostmessageReady = true;
			window.removeEventListener('message', this.postMessageHandler, false);
			console.log('Received Host_PostmessageReady.');
		}
	}
}

class MobileAppInitializer extends InitializerBase {
	constructor() {
		super();

		window.ThisIsAMobileApp = true;
		window.HelpFile = document.getElementById('init-help-file').value;

		// eslint-disable-next-line
		window.open = function (url, windowName, windowFeatures) {
			window.postMobileMessage(
				'HYPERLINK ' + url,
			); /* don't call the 'normal' window.open on mobile at all */
		};

		const element = document.getElementById('initial-variables');

		window.MobileAppName = element.dataset.mobileAppName;
		window.brandProductName = element.dataset.mobileAppName;

		window.coolLogging = 'true';
		window.outOfFocusTimeoutSecs = 1000000;
		window.idleTimeoutSecs = 1000000;
	}
}

class IOSAppInitializer extends MobileAppInitializer {
	constructor() {
		super();

		window.ThisIsTheiOSApp = true;
		window.postMobileMessage = function (msg) {
			window.webkit.messageHandlers.lok.postMessage(msg);
		};
		window.postMobileError = function (msg) {
			window.webkit.messageHandlers.error.postMessage(msg);
		};
		window.postMobileDebug = function (msg) {
			window.webkit.messageHandlers.debug.postMessage(msg);
		};

		// Related to issue #5841: the iOS app sets the base text direction via the "dir" parameter
		document.dir = window.coolParams.get('dir');

		window.userInterfaceMode = window.coolParams.get('userinterfacemode');

		this.brandingUriPrefix = 'Branding/' + this.brandingUriPrefix;
	}
}

class GTKAppInitializer extends MobileAppInitializer {
	constructor() {
		super();

		window.ThisIsTheGtkApp = true;
		window.postMobileMessage = function (msg) {
			window.webkit.messageHandlers.cool.postMessage(msg, '*');
		};
		window.postMobileError = function (msg) {
			window.webkit.messageHandlers.error.postMessage(msg, '*');
		};
		window.postMobileDebug = function (msg) {
			window.webkit.messageHandlers.debug.postMessage(msg, '*');
		};
	}
}

class AndroidAppInitializer extends MobileAppInitializer {
	constructor() {
		super();

		window.ThisIsTheAndroidApp = true;
		window.postMobileMessage = function (msg) {
			window.COOLMessageHandler.postMobileMessage(msg);
		};
		window.postMobileError = function (msg) {
			window.COOLMessageHandler.postMobileError(msg);
		};
		window.postMobileDebug = function (msg) {
			window.COOLMessageHandler.postMobileDebug(msg);
		};

		window.userInterfaceMode = window.coolParams.get('userinterfacemode');
	}
}

class EMSCRIPTENAppInitializer extends MobileAppInitializer {
	constructor() {
		super();

		window.ThisIsTheEmscriptenApp = true;
		window.postMobileMessage = function (msg) {
			app.HandleCOOLMessage(app.AllocateUTF8(msg));
		};
		window.postMobileError = function (msg) {
			console.log('COOL Error: ' + msg);
		};
		window.postMobileDebug = function (msg) {
			console.log('COOL Debug: ' + msg);
		};

		window.userInterfaceMode = 'notebookbar';
	}
}

function getInitializerClass() {
	window.appType = document.getElementById('init-app-type').value;

	if (window.appType === 'browser') {
		return new BrowserInitializer();
	} else if (window.appType === 'mobile') {
		let osType = document.getElementById('init-mobile-app-os-type');

		if (osType) {
			osType = osType.value;

			if (osType === 'IOS') return new IOSAppInitializer();
			else if (osType === 'GTK') return new GTKAppInitializer();
			else if (osType === 'ANDROID') return new AndroidAppInitializer();
			else if (osType === 'EMSCRIPTEN') return new EMSCRIPTENAppInitializer();
		}
	}
}

{
	const initializer = getInitializerClass();
	initializer.afterInitialization();

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
		const loggingMethods = [
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
		];
		if (!doLogging) {
			const noop = function () {};

			for (let i = 0; i < loggingMethods.length; i++) {
				window.app.console[loggingMethods[i]] = noop;
			}
		} else {
			for (let i = 0; i < loggingMethods.length; i++) {
				if (
					!Object.prototype.hasOwnProperty.call(
						window.console,
						loggingMethods[i],
					)
				) {
					continue;
				}
				(function (method) {
					window.app.console[method] = function logWithCool(...args) {
						if (method === 'error') {
							let log = 'jserror ';
							for (let arg = 0; arg < args.length; arg++) {
								if (typeof args[arg] === 'string') log += args[arg] + '\n';
							}
							window.logServer(log);
						}

						return window.console[method].apply(console, ...args);
					};
				})(loggingMethods[i]);
			}

			window.onerror = function (msg, src, row, col, err) {
				const data = {
					userAgent: navigator.userAgent.toLowerCase(),
					vendor: navigator.vendor.toLowerCase(),
					message: msg,
					source: src,
					line: row,
					column: col,
				};
				const desc = err ? err.message || '(no message)' : '(no err)',
					stack = err ? err.stack || '(no stack)' : '(no err)';
				const log =
					'jserror ' +
					JSON.stringify(data, null, 2) +
					'\n' +
					desc +
					'\n' +
					stack +
					'\n';
				window.logServer(log);

				if (L.Browser.cypressTest && window.parent !== window && err !== null) {
					console.log('Sending window error to Cypress...:', err);
					window.parent.postMessage(err);
				}

				return false;
			};
		}
	};

	window.setLogging(window.coolLogging != '');

	window.L.Params = {
		/// Shows close button if non-zero value provided
		closeButtonEnabled: window.coolParams.get('closebutton'),

		/// Shows revision history file menu option
		revHistoryEnabled: window.coolParams.get('revisionhistory'),
	};

	window.prefs = {
		_localStorageCache: {}, // TODO: change this to new Map() when JS version allows
		canPersist: (function () {
			const str = 'localstorage_test';
			try {
				window.localStorage.setItem(str, str);
				window.localStorage.removeItem(str);
				return true;
			} catch (e) {
				return false;
			}
		})(),

		_renameLocalStoragePref: function (oldName, newName) {
			if (!window.prefs.canPersist) {
				return;
			}

			const oldValue = window.localStorage.getItem(oldName);
			const newValue = window.localStorage.getItem(newName);

			if (oldValue === null || newValue !== null) {
				return;
			}

			// we do not remove the old value, both for downgrades and incase we split an old window preference to a per-app one
			window.localStorage.setItem(newName, oldValue);
		},

		/// Similar to using window.uiDefaults directly, but this can handle dotted keys like "presentation.ShowSidebar" and does not allow partially referencing a value (like just "presentation")
		_getUIDefault: function (key, defaultValue = undefined) {
			const parts = key.split('.');
			let result = window.uiDefaults;

			for (const part of parts) {
				if (!Object.prototype.hasOwnProperty.call(result, part)) {
					return defaultValue;
				}

				if (typeof result === 'string') {
					return defaultValue;
				}

				result = result[part];
			}

			if (typeof result !== 'string') {
				return defaultValue;
			}

			return result;
		},

		get: function (key, defaultValue = undefined) {
			if (key in window.prefs._localStorageCache) {
				return window.prefs._localStorageCache[key];
			}

			const uiDefault = window.prefs._getUIDefault(key);
			if (!window.savedUIState && uiDefault !== undefined) {
				window.prefs._localStorageCache[key] = uiDefault;
				return uiDefault;
			}

			if (window.prefs.canPersist) {
				const localStorageItem = window.localStorage.getItem(key);

				if (localStorageItem) {
					window.prefs._localStorageCache[key] = localStorageItem;
					return localStorageItem;
				}
			}

			if (uiDefault !== undefined) {
				window.prefs._localStorageCache[key] = uiDefault;
				return uiDefault;
			}

			window.prefs._localStorageCache[key] = defaultValue;
			return defaultValue;
		},

		set: function (key, value) {
			value = String(value); // NOT "new String(...)". We cannot use .toString here because value could be null/undefined
			if (window.prefs.canPersist) {
				window.localStorage.setItem(key, value);
			}
			window.prefs._localStorageCache[key] = value;
		},

		remove: function (key) {
			if (window.prefs.canPersist) {
				window.localStorage.removeItem(key);
			}
			window.prefs._localStorageCache[key] = undefined;
		},

		getBoolean: function (key, defaultValue = false) {
			const value = window.prefs.get(key, '').toLowerCase();

			if (value === 'false') {
				return false;
			}

			if (value === 'true') {
				return true;
			}

			return defaultValue;
		},

		getNumber: function (key, defaultValue = NaN) {
			const value = window.prefs.get(key, '').toLowerCase();

			const parsedValue = parseFloat(value);

			if (isNaN(parsedValue)) {
				return defaultValue;
			}

			return parsedValue;
		},
	};

	window.getAccessibilityState = function () {
		const isCalcTest =
			window.docURL.includes('data/desktop/calc/') ||
			window.docURL.includes('data/mobile/calc/') ||
			window.docURL.includes('data/idle/calc/') ||
			window.docURL.includes('data/multiuser/calc/');

		// FIXME: a11y doesn't work in calc under cypress
		if (L.Browser.cypressTest && isCalcTest) window.enableAccessibility = false;

		if (L.Browser.cypressTest)
			window.prefs.set('accessibilityState', window.enableAccessibility);

		return window.prefs.getBoolean('accessibilityState');
	};

	// Renamed in 24.04.4.1
	const prefDocTypes = ['text', 'spreadsheet', 'presentation', 'drawing'];
	for (const docType of prefDocTypes) {
		window.prefs._renameLocalStoragePref(
			`UIDefaults_${docType}_darkTheme`,
			'darkTheme',
		);
	}

	const oldDocTypePrefs = [
		'A11yCheckDeck',
		'NavigatorDeck',
		'PropertyDeck',
		'SdCustomAnimationDeck',
		'SdMasterPagesDeck',
		'SdSlideTransitionDeck',
		'ShowResolved',
		'ShowRuler',
		'ShowSidebar',
		'ShowStatusbar',
		'ShowToolbar',
	];
	for (const pref of oldDocTypePrefs) {
		for (const docType of prefDocTypes) {
			window.prefs._renameLocalStoragePref(
				`UIDefaults_${docType}_${pref}`,
				`${docType}.${pref}`,
			);
		}
	}
	// End 24.04.4.1 renames

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
				const command = {
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

		/// This does pretty much the same as L.stamp. We can't use L.stamp because it's not yet in-scope by the first time we want to call window.memo.decorator
		/// If you are able to use L.stamp instead, you probably should
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

		/// A decorator factory, which takes a decorator and prevents it from creating new instances when wrapping the same function
		/// This is particularly useful for functions that take events, say, as .on and .off won't work properly if you don't provide the same function instance
		decorator: function (decorator, context) {
			const decoratorId = window.memo._getId(decorator);
			const contextId = window.memo._getId(context);

			return function (f, ...args) {
				const functionId = window.memo._getId(f);

				if (
					window.memo._decoratorMemo[
						decoratorId + ' ' + contextId + ' ' + functionId
					] === undefined
				) {
					window.memo._decoratorMemo[
						decoratorId + ' ' + contextId + ' ' + functionId
					] = decorator.call(this, f, ...args);

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
			};
		},

		_bindMemo: {},

		/// A decorator, which takes a function and binds it to an object
		/// Similar to L.bind, but when given the same function and context we will return the previously bound function
		bind: function (f, context) {
			const functionId = window.memo._getId(f);
			const contextId = window.memo._getId(context);
			if (window.memo._bindMemo[functionId + ' ' + contextId] === undefined) {
				window.memo._bindMemo[functionId + ' ' + contextId] = f.bind(context);
			}
			return window.memo._bindMemo[functionId + ' ' + contextId];
		},
	};

	window.touch = {
		/// a touchscreen event handler, supports both DOM and hammer.js events
		isTouchEvent: function (e) {
			if (e.originalEvent) {
				e = e.originalEvent;
			}

			if (L.Browser.cypressTest && window.L.Browser.mobile) {
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
		touchOnly: window.memo.decorator(function (f) {
			return function (e, ...args) {
				if (!window.touch.isTouchEvent(e)) return;
				return f.call(this, f, e, ...args);
			};
		}),

		/// a decorator that only runs the function if the event is not a touch event
		mouseOnly: window.memo.decorator(function (f) {
			return function (e, ...args) {
				if (window.touch.isTouchEvent(e)) return;
				return f.call(this, f, e, ...args);
			};
		}),

		/// detect if the primary pointing device is of limited accuracy (generally a touchscreen)
		/// you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may
		///   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor)
		hasPrimaryTouchscreen: function () {
			return window.matchMedia('(pointer: coarse)').matches;
		},
		/// detect any pointing device is of limited accuracy (generally a touchscreen)
		/// you shouldn't use this for determining the behavior of an event (use isTouchEvent instead), but this may
		///   be useful for determining what UI to show (e.g. the draggable teardrops under the cursor)
		hasAnyTouchscreen: function () {
			return window.matchMedia('(any-pointer: coarse)').matches;
		},
	};

	if (!window.prefs.getBoolean('hasNavigatorClipboardWrite', true)) {
		// navigator.clipboard.write failed on us once, don't even try it.
		window.L.Browser.hasNavigatorClipboardWrite = false;
	}

	window.deviceFormFactor = window.mode.getDeviceFormFactor();

	// This function may look unused, but it's needed in WASM and Android to send data through the fake websocket. Please
	// don't remove it without first grepping for 'Base64ToArrayBuffer' in the C++ code
	window.Base64ToArrayBuffer = function (base64Str) {
		const binStr = atob(base64Str);
		const ab = new ArrayBuffer(binStr.length);
		const bv = new Uint8Array(ab);
		for (let i = 0, l = binStr.length; i < l; i++) {
			bv[[i]] = binStr.charCodeAt(i);
		}
		return ab;
	};

	// Written and named as a sort of analog to plain atob ... except this one supports non-ascii
	// Nothing is perfect so this also mangles binary - don't decode tiles with it
	// This function may look unused, but it's needed in WASM and mobile to send data through the fake websocket. Please
	// don't remove it without first grepping for 'Base64ToArrayBuffer' in the C++ code
	// eslint-disable-next-line
	window.b64d = function (base64Str) {
		const binStr = atob(base64Str);
		const u8Array = Uint8Array.from(binStr, (c) => c.codePointAt(0));
		return new TextDecoder().decode(u8Array);
	};

	if (window.ThisIsTheiOSApp) {
		window.addEventListener('keydown', function (e) {
			if (e.metaKey) {
				e.preventDefault();
			}
			if (window.MagicKeyDownHandler) window.MagicKeyDownHandler(e);
		});
		window.addEventListener('keyup', function (e) {
			if (e.metaKey) {
				e.preventDefault();
			}
			if (window.MagicKeyUpHandler) window.MagicKeyUpHandler(e);
		});
	}

	document.addEventListener(
		'contextmenu',
		function (e) {
			if (e.preventDefault) {
				e.preventDefault();
			} else {
				e.returnValue = false;
			}
		},
		false,
	);

	window.fakeWebSocketCounter = 0;
	window.FakeWebSocket = function () {
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.protocol = '';
		this.readyState = 1;
		this.id = window.fakeWebSocketCounter++;
		this.onclose = () => {};
		this.onerror = () => {};
		this.onmessage = () => {};
		this.onopen = () => {};
		this.close = () => {};
	};
	window.FakeWebSocket.prototype.send = (data) => {
		window.postMobileMessage(data);
	};

	window.proxySocketCounter = 0;
	window.ProxySocket = function (uri) {
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
		this.lastDataTimestamp = performance.now(); // The last time we got any data.
		this.onclose = () => {};
		this.onerror = () => {};
		this.onmessage = () => {};

		this.decoder = new TextDecoder();
		this.doSlice = (bytes, start, end) => {
			return bytes.slice(start, end);
		};

		this.decode = (bytes, start, end) => {
			return this.decoder.decode(this.doSlice(bytes, start, end));
		};
		this.parseIncomingArray = (arr) => {
			//window.app.console.debug('proxy: parse incoming array of length ' + arr.length);
			for (let i = 0; i < arr.length; ++i) {
				const left = arr.length - i;
				if (left < 4) {
					//window.app.console.debug('no data left');
					break;
				}
				const type = String.fromCharCode(arr[i + 0]);
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
				let numStr = '';
				let start = i;
				while (arr[i] != 10)
					// '\n'
					i++;
				numStr = this.decode(arr, start, i);
				const serial = parseInt(numStr, 16);

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
				const size = parseInt(numStr, 16);

				i++; // skip \n

				let data;
				if (type == 'T') data = this.decode(arr, i, i + size);
				else data = this.doSlice(arr, i, i + size);

				if (serial !== this.inSerial + 1) {
					window.app.console.debug(
						'Error: serial mismatch ' + serial + ' vs. ' + (this.inSerial + 1),
					);
				}
				this.inSerial = serial;
				this.onmessage({ data: data });

				i += size; // skip trailing '\n' in loop-increment
			}
		};
		this.sendQueue = '';
		this._signalErrorClose = () => {
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
		};
		// For those who think that long-running sockets are a
		// better way to wait: you're so right. However, each
		// consumes a scarce server worker thread while it waits,
		// so ... back in the real world:
		this._setPollInterval = (intervalMs) => {
			clearInterval(this.pollInterval);
			if (this.readyState === 1)
				this.pollInterval = setInterval(this.doSend, intervalMs);
		};
		this.doSend = () => {
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
							' ms.',
					);
					this._setPollInterval(this.curPollMs);
				} else if (performance.now() - this.lastDataTimestamp > 30 * 1000) {
					window.app.console.debug(
						'Close connection after no response for 30secs',
					);
					this._signalErrorClose();
				} else
					window.app.console.debug(
						'High latency connection - too much in-flight, pausing.',
					);
				return;
			}

			// Maximize the timeout, instead of stopping altogethr,
			// so we don't hang when the following request takes
			// too long, hangs, throws, etc. we can recover.
			this._setPollInterval(this.maxPollMs);

			//window.app.console.debug('send msg - ' + this.msgInflight + ' on session ' +
			//	      this.sessionId + '  queue: "' + this.sendQueue + '"');
			const req = new XMLHttpRequest();
			const url = this.getEndPoint('write');
			req.open('POST', url);
			req.responseType = 'arraybuffer';
			req.addEventListener('load', function () {
				if (req.status == 200) {
					const data = new Uint8Array(req.response);
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
						'proxy: error on incoming response ' + req.status,
					);
					this._signalErrorClose();
				}
				if (this.curPollMs < this.maxPollMs) {
					// If we aren't throttled, see if we should.
					// Has it been long enough since we got any data?
					const timeSinceLastDataMs =
						(performance.now() - this.lastDataTimestamp) | 0;
					if (
						timeSinceLastDataMs >=
						this.minIdlePollsToThrottle * this.curPollMs
					) {
						// Throttle.
						this.curPollMs =
							Math.min(this.maxPollMs, this.curPollMs * this.throttleFactor) |
							0;
						//window.app.console.debug('No data for ' + timeSinceLastDataMs + ' ms -- throttling to ' + this.curPollMs + ' ms.');
					}
				}
				this._setPollInterval(this.curPollMs);
			});
			req.addEventListener('loadend', function () {
				this.msgInflight--;
			});
			req.send(this.sendQueue);
			this.sendQueue = '';
			this.msgInflight++;
		};
		this.getSessionId = () => {
			if (this.openInflight > 0) {
				window.app.console.debug('Waiting for session open');
				return;
			}

			if (this.delaySession) return;

			// avoid attempting to re-connect too quickly
			if (window.lastCreatedProxySocket) {
				const msSince = performance.now() - window.lastCreatedProxySocket;
				if (msSince < 250) {
					const delay = 250 - msSince;
					window.app.console.debug(
						'Wait to re-try session creation for ' + delay + 'ms',
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

			const req = new XMLHttpRequest();
			const endPoint = this.getEndPoint('open');

			req.open('POST', endPoint);
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
						'Error: failed to fetch session id! error: ' + req.status,
					);
					this._signalErrorClose();
				} else {
					// we connected - lets get going ...
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
		};
		this.send = (msg) => {
			const hadData = this.sendQueue.length > 0;
			this.sendQueue = this.sendQueue.concat(
				'B0x' +
					this.outSerial.toString(16) +
					'\n' +
					'0x' +
					new TextEncoder().encode(msg).length.toString(16) +
					'\n' +
					msg +
					'\n',
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
		};
		this.sendCloseMsg = (beacon) => {
			const url = this.getEndPoint('close');

			if (!beacon) {
				const req = new XMLHttpRequest();
				req.open('POST', url);
				req.send('');
			} else navigator.sendBeacon(url, '');
		};
		this.close = () => {
			const oldState = this.readyState;
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
		};
		this.setUnloading = () => {
			this.unloading = true;
		};
		this.getEndPoint = (command) => {
			const base = this.uri;
			return base + '/' + this.sessionId + '/' + command + '/' + this.outSerial;
		};
		window.app.console.debug('proxy: new socket ' + this.id + ' ' + this.uri);

		// queue fetch of session id.
		this.getSessionId();
	};

	window.iterateCSSImages = function (visitor) {
		const visitUrls = function (rules, visitor, base) {
			if (!rules) return;

			for (let r = 0; r < rules.length; ++r) {
				// check subset of rules like @media or @import
				if (rules[r] && rules[r].type != 1) {
					visitUrls(rules[r].cssRules || rules[r].rules, visitor, base);
					continue;
				}
				if (!rules[r] || !rules[r].style) continue;
				const img = rules[r].style.backgroundImage;
				if (img === '' || img === undefined) continue;

				if (img.startsWith('url("images/')) {
					visitor(
						rules[r].style,
						img,
						img.replace('url("images/', base + '/images/'),
					);
				}
				if (img.startsWith('url("remote/')) {
					visitor(
						rules[r].style,
						img,
						img.replace('url("remote/', base + '/remote/'),
					);
				}
			}
		};
		const sheets = document.styleSheets;
		for (let i = 0; i < sheets.length; ++i) {
			let relBases;
			try {
				relBases = sheets[i].href.split('/');
			} catch (err) {
				window.app.console.log('Missing href from CSS number ' + i);
				continue;
			}
			relBases.pop(); // bin last - css name.
			const base = 'url("' + relBases.join('/');

			let rules;
			try {
				rules = sheets[i].cssRules || sheets[i].rules;
			} catch (err) {
				window.app.console.log('Missing CSS from ' + sheets[i].href);
				continue;
			}
			visitUrls(rules, visitor, base);
		}
	};

	if (window.socketProxy) {
		// re-write relative URLs in CSS - somewhat grim.
		window.addEventListener(
			'load',
			function () {
				window.iterateCSSImages(function (style, img, fullUrl) {
					style.backgroundImage = fullUrl;
				});
			},
			false,
		);
	}

	// indirect socket to wrap the asyncness around fetching the routetoken from indirection url endpoint
	window.IndirectSocket = function (uri) {
		this.uri = uri;
		this.binaryType = '';
		this.unloading = false;
		this.readyState = 0; // connecting
		this.innerSocket = undefined;

		this.onclose = () => {};
		this.onerror = function () {};
		this.onmessage = function () {};
		this.onopen = function () {};

		this.close = () => {
			this.innerSocket.close();
		};

		this.send = (msg) => {
			this.innerSocket.send(msg);
		};

		this.setUnloading = () => {
			this.unloading = true;
		};

		this.sendPostMsg = (errorCode) => {
			let errorMsg;
			if (errorCode === 0) {
				errorMsg = _('Cluster is scaling, retrying...');
			} else if (errorCode === 1) {
				errorMsg = _('Document is migrating to new server, retrying...');
			} else {
				errorMsg = _('Failed to get RouteToken from controller');
			}
			const msg = {
				MessageId: 'Action_Load_Resp',
				SendTime: Date.now(),
				Values: {
					success: false,
					errorMsg: errorMsg,
					errorType: 'clusterscaling',
				},
			};
			window.parent.postMessage(JSON.stringify(msg), '*');
		};

		this.sendRouteTokenRequest = function (requestUri) {
			const http = new XMLHttpRequest();
			http.open('GET', requestUri, true);
			http.responseType = 'json';
			http.addEventListener('load', () => {
				if (http.status === 200) {
					const uriWithRouteToken = http.response.uri;
					window.expectedServerId = http.response.serverId;
					const params = new URL(uriWithRouteToken).searchParams;
					window.routeToken = params.get('RouteToken');
					window.app.console.log('updated routeToken: ' + window.routeToken);
					this.innerSocket = new WebSocket(uriWithRouteToken);
					this.innerSocket.binaryType = this.binaryType;
					this.innerSocket.onerror = function () {
						this.readyState = this.innerSocket.readyState;
						this.onerror();
					};
					this.innerSocket.onclose = function () {
						this.readyState = 3;
						this.onclose();
						this.innerSocket.onerror = function () {};
						this.innerSocket.onclose = function () {};
						this.innerSocket.onmessage = function () {};
					};
					this.innerSocket.onopen = function () {
						this.readyState = 1;
						this.onopen();
					};
					this.innerSocket.onmessage = function (e) {
						this.readyState = this.innerSocket.readyState;
						this.onmessage(e);
					};
				} else if (http.status === 202) {
					if (
						!(
							window.app &&
							window.app.socket &&
							window.app.socket._reconnecting
						)
					) {
						this.sendPostMsg(http.response.errorCode);
					}
					const timeoutFn = function (requestUri) {
						console.warn('Requesting again for routeToken');
						http.open('GET', requestUri, true);
						http.send();
					}.bind(http);
					setTimeout(timeoutFn, 3000, requestUri);
				} else {
					window.app.console.error(
						'Indirection url: error on incoming response ' + http.status,
					);
					this.sendPostMsg(-1);
				}
			});
			http.send();
		};

		let requestUri =
			window.indirectionUrl + '?Uri=' + encodeURIComponent(this.uri);
		if (window.geolocationSetup) {
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			requestUri += '&TimeZone=' + timeZone;
		}
		this.sendRouteTokenRequest(requestUri);
	};

	window.createWebSocket = function (uri) {
		if ('processCoolUrl' in window) {
			uri = window.processCoolUrl({ url: uri, type: 'ws' });
		}

		if (window.socketProxy) {
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
				let result = window.LOCALIZATIONS[string];
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
		const protocol =
			window.location.protocol === 'file:'
				? 'https:'
				: window.location.protocol;
		window.webserver = window.host.replace(/^(ws|wss):/i, protocol);
		window.webserver = window.webserver.replace(/\/*$/, ''); // Remove trailing slash.
	}

	let docParams, wopiParams;
	const filePath = window.coolParams.get('file_path');
	window.wopiSrc = window.coolParams.get('WOPISrc');
	if (window.wopiSrc != '') {
		window.docURL = decodeURIComponent(window.wopiSrc);
		if (window.accessToken !== '') {
			wopiParams = {
				access_token: window.accessToken,
				access_token_ttl: window.accessTokenTTL,
			};
		} else if (window.accessHeader !== '') {
			wopiParams = { access_header: window.accessHeader };
		}

		if (wopiParams) {
			docParams = Object.keys(wopiParams)
				.map(function (key) {
					return (
						encodeURIComponent(key) + '=' + encodeURIComponent(wopiParams[key])
					);
				})
				.join('&');
		}
	} else if (window.ThisIsTheEmscriptenApp) {
		// This is of course just a horrible temporary hack
		window.docURL = 'file:///sample.docx';
	} else {
		window.docURL = filePath;
	}

	// Form a valid WS URL to the host with the given path.
	window.makeWsUrl = function (path) {
		window.app.console.assert(
			window.host.startsWith('ws'),
			'host is not ws: ' + window.host,
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
		wopiSrcParam,
	) {
		let wopiSrc = '';
		if (window.wopiSrc != '') {
			wopiSrc = '?WOPISrc=' + encodeURIComponent(window.wopiSrc);
			if (window.routeToken != '')
				wopiSrc += '&RouteToken=' + window.routeToken;
			wopiSrc += '&compat=';
			if (wopiSrcParam && wopiSrcParam.length > 0)
				wopiSrc += '&' + wopiSrcParam;
		} else if (wopiSrcParam && wopiSrcParam.length > 0) {
			wopiSrc = '?' + wopiSrcParam;
		}

		suffix = suffix || '/ws';
		let encodedDocUrl = encodeURIComponent(docUrlParams) + suffix + wopiSrc;
		if (window.hexifyUrl) encodedDocUrl = window.hexEncode(encodedDocUrl);
		return root + encodedDocUrl + '/ws';
	};

	// Form a valid WS URL to the host with the given path and
	// encode the document URL and params.
	window.makeWsUrlWopiSrc = function (
		path,
		docUrlParams,
		suffix,
		wopiSrcParam,
	) {
		const websocketURI = window.makeWsUrl(path);
		return window.makeDocAndWopiSrcUrl(
			websocketURI,
			docUrlParams,
			suffix,
			wopiSrcParam,
		);
	};

	// Form a valid HTTP URL to the host with the given path.
	window.makeHttpUrl = function (path) {
		window.app.console.assert(
			window.webserver.startsWith('http'),
			'webserver is not http: ' + window.webserver,
		);
		return window.webserver + window.serviceRoot + path;
	};

	// Form a valid HTTP URL to the host with the given path and
	// encode the document URL and params.
	window.makeHttpUrlWopiSrc = function (
		path,
		docUrlParams,
		suffix,
		wopiSrcParam,
	) {
		const httpURI = window.makeHttpUrl(path);
		return window.makeDocAndWopiSrcUrl(
			httpURI,
			docUrlParams,
			suffix,
			wopiSrcParam,
		);
	};

	// Encode a string to hex.
	window.hexEncode = function (string) {
		const bytes = new TextEncoder().encode(string);
		let hex = '0x';
		for (let i = 0; i < bytes.length; ++i) {
			hex += bytes[i].toString(16);
		}
		return hex;
	};

	// Decode hexified string back to plain text.
	window.hexDecode = function (hex) {
		if (hex.startsWith('0x')) hex = hex.substr(2);
		const bytes = new Uint8Array(hex.length / 2);
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
		}
		return new TextDecoder().decode(bytes);
	};

	if (window.ThisIsAMobileApp) {
		window.socket = new window.FakeWebSocket();
		window.TheFakeWebSocket = window.socket;
	} else {
		// The URL may already contain a query (e.g., 'http://server.tld/foo/wopi/files/bar?desktop=baz') - then just append more params
		const docParamsPart = docParams
			? (window.docURL.includes('?') ? '&' : '?') + docParams
			: '';
		const websocketURI = window.makeWsUrlWopiSrc(
			'/cool/',
			window.docURL + docParamsPart,
		);
		try {
			window.socket = window.createWebSocket(websocketURI);
		} catch (err) {
			window.app.console.log(err);
		}
	}

	const isRandomUser = window.coolParams.get('randomUser');
	if (isRandomUser) {
		// List of languages supported in core
		const randomUserLangs = [
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
		const randomUserLang =
			randomUserLangs[Math.floor(Math.random() * randomUserLangs.length)];
		window.app.console.log(
			'Randomize Settings: Set language to: ',
			randomUserLang,
		);
		window.coolParams.set('lang', randomUserLang);
		window.coolParams.set('debug', true);
	}

	let lang = window.coolParams.get('lang');
	if (lang) {
		// Workaround for broken integrations vs. LOKit language fallback
		if (lang === 'en-us') lang = 'en-US';
		if (lang === 'en-gb') lang = 'en-GB';
		if (lang === 'pt-br') lang = 'pt-BR';
		if (lang === 'zh-cn') lang = 'zh-CN';
		if (lang === 'zh-tw') lang = 'zh-TW';
		window.langParam = encodeURIComponent(lang);
	} else window.langParam = 'en-US';
	window.langParamLocale = new Intl.Locale(window.langParam);
	window.queueMsg = [];
	if (window.ThisIsTheEmscriptenApp)
		// Temporary hack
		window.LANG = 'en-US';
	else if (window.ThisIsAMobileApp) window.LANG = lang;
	if (window.socket && window.socket.readyState !== 3) {
		window.socket.onopen = function () {
			// Note there are two socket "onopen" handlers, this one and the other in browser/src/core/Socket.js.
			// See the notes there for explanation.
			if (window.socket.readyState === 1) {
				const ProtocolVersionNumber = '0.1';
				const timestamp = encodeURIComponent(
					window.coolParams.get('timestamp'),
				);
				let msg = 'load url=' + encodeURIComponent(window.docURL);

				const now0 = Date.now();
				const now1 = performance.now();
				const now2 = Date.now();
				window.socket.send(
					'coolclient ' +
						ProtocolVersionNumber +
						' ' +
						(now0 + now2) / 2 +
						' ' +
						now1,
				);

				msg += ' accessibilityState=' + window.getAccessibilityState();

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
				const spellOnline = window.prefs.get('SpellOnline');
				if (spellOnline) {
					msg += ' spellOnline=' + spellOnline;
				}

				const darkTheme = window.prefs.getBoolean('darkTheme');
				msg += ' darkTheme=' + darkTheme;

				const darkBackground = window.prefs.getBoolean(
					'darkBackgroundForTheme.' + (darkTheme ? 'dark' : 'light'),
					darkTheme,
				);
				msg += ' darkBackground=' + darkBackground;

				msg += ' timezone=' + Intl.DateTimeFormat().resolvedOptions().timeZone;

				window.socket.send(msg);
			}
		};

		window.socket.onerror = function (event) {
			window.app.console.log(event);
		};

		window.socket.onclose = function (event) {
			window.app.console.log(event);
		};

		window.socket.onmessage = function (event) {
			if (typeof window.socket._onMessage === 'function') {
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
			this.socket.onopen();
		}
	}

	function handleViewportChange(event) {
		const visualViewport = event.target;

		window.scroll(0, 0);
		document.body.style.height = visualViewport.height + 'px';
	}

	if (window.visualViewport !== undefined) {
		window.visualViewport.addEventListener('scroll', handleViewportChange);
		window.visualViewport.addEventListener('resize', handleViewportChange);
	}
}
