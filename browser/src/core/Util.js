/* -*- js-indent-level: 8 -*- */
/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

/* global brandProductFAQURL */

L.Util = {
	// extend an object with properties of one or more other objects
	extend: function (dest) {
		var i, j, len, src;

		for (j = 1, len = arguments.length; j < len; j++) {
			src = arguments[j];
			for (i in src) {
				dest[i] = src[i];
			}
		}
		return dest;
	},

	// create an object from a given prototype
	create: Object.create || (function () {
		function F() {}
		return function (proto) {
			F.prototype = proto;
			return new F();
		};
	})(),

	// bind a function to be called with a given context
	bind: function (fn, obj) {
		var slice = Array.prototype.slice;

		if (fn.bind) {
			return fn.bind.apply(fn, slice.call(arguments, 1));
		}

		var args = slice.call(arguments, 2);

		return function () {
			return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
		};
	},

	// return unique ID of an object
	stamp: function (obj) {
		/*eslint-disable */
		obj._leaflet_id = obj._leaflet_id || ++L.Util.lastId;
		return obj._leaflet_id;
		/*eslint-enable */
	},

	lastId: 0,

	// return a function that won't be called more often than the given interval
	throttle: function (fn, time, context) {
		var lock, args, wrapperFn, later;

		later = function () {
			// reset lock and call if queued
			lock = false;
			if (args) {
				wrapperFn.apply(context, args);
				args = false;
			}
		};

		wrapperFn = function () {
			if (lock) {
				// called too soon, queue to call later
				args = arguments;

			} else {
				// call and lock until later
				fn.apply(context, arguments);
				setTimeout(later, time);
				lock = true;
			}
		};

		return wrapperFn;
	},

	// wrap the given number to lie within a certain range (used for wrapping longitude)
	wrapNum: function (x, range, includeMax) {
		var max = range[1],
		    min = range[0],
		    d = max - min;
		return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
	},

	// do nothing (used as a noop throughout the code)
	falseFn: function () { return false; },

	// round a given number to a given precision
	formatNum: function (num, digits) {
		var pow = Math.pow(10, digits || 5);
		return Math.round(num * pow) / pow;
	},

	// removes given prefix and suffix from the string if exists
	// if suffix is not specifed prefix is trimmed from both end of string
	// trim whitespace from both sides of a string if prefix and suffix are not given
	trim: function (str, prefix, suffix) {
		if (!prefix)
			return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
		var result = this.trimStart(str, prefix);
		result = this.trimEnd(result, suffix);
		return result;
	},

	// removes prefix from string if string starts with that prefix
	trimStart: function (str, prefix) {
		if (str.indexOf(prefix) === 0)
			return str.substring(prefix.length);
		return str;
	},

	// removes suffix from string if string ends with that suffix
	trimEnd: function (str, suffix) {
		var suffixIndex = str.lastIndexOf(suffix);
		if (suffixIndex !== -1 && (str.length - suffix.length === suffixIndex))
			return str.substring(0, suffixIndex);
		return str;
	},

	// split a string into words
	splitWords: function (str) {
		return L.Util.trim(str).split(/\s+/);
	},

	// set options to an object, inheriting parent's options as well
	setOptions: function (obj, options) {
		if (!Object.prototype.hasOwnProperty.call(obj, 'options')) {
			obj.options = obj.options ? L.Util.create(obj.options) : {};
		}
		for (var i in options) {
			obj.options[i] = options[i];
		}
		return obj.options;
	},

	round: function(x, e) {
		if (!e) {
			return Math.round(x);
		}
		var f = 1.0/e;
		return Math.round(x * f) * e;
	},

	// super-simple templating facility, used for TileLayer URLs
	template: function (str, data) {
		return str.replace(L.Util.templateRe, function (str, key) {
			var value = data[key];

			if (value === undefined) {
				throw new Error('No value provided for variable ' + str);

			} else if (typeof value === 'function') {
				value = value(data);
			}
			return value;
		});
	},

	templateRe: /\{ *([\w_]+) *\}/g,

	isArray: Array.isArray || function (obj) {
		return (Object.prototype.toString.call(obj) === '[object Array]');
	},

	// minimal image URI, set to an image when disposing to flush memory
	emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',

	toggleFullScreen: function() {
		if (!document.fullscreenElement &&
			!document.mozFullscreenElement &&
			!document.msFullscreenElement &&
			!document.webkitFullscreenElement) {
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
				document.documentElement.msRequestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
				document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
				document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		} else if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		}
	},

	isEmpty: function(o) {
		return !(o && o.length);
	},

	mm100thToInch: function(mm) {
		return mm / 2540;
	},

	getTextWidth: function(text, font) {
		var canvas = L.Util.getTextWidth._canvas || (L.Util.getTextWidth._canvas = document.createElement('canvas'));
		var context = canvas.getContext('2d');
		context.font = font;
		var metrics = context.measureText(text);
		return Math.floor(metrics.width);
	},

	getProduct: function () {
		var brandFAQURL = (typeof brandProductFAQURL !== 'undefined') ?
		    brandProductFAQURL : 'https://collaboraonline.github.io/post/faq/';
		if (window.feedbackUrl && window.buyProductUrl) {
			var integratorUrl = encodeURIComponent(window.buyProductUrl);
			brandFAQURL = window.feedbackUrl;
			brandFAQURL = brandFAQURL.substring(0, brandFAQURL.lastIndexOf('/')) +
				'/product.html?integrator='+ integratorUrl;
		}
		return brandFAQURL;
	},

	replaceCtrlAltInMac: function(msg) {
		if (L.Browser.mac) {
			var ctrl = /Ctrl/g;
			var alt = /Alt/g;
			if (String.locale.startsWith('de') || String.locale.startsWith('dsb') || String.locale.startsWith('hsb')) {
				ctrl = /Strg/g;
			}
			if (String.locale.startsWith('lt')) {
				ctrl = /Vald/g;
			}
			if (String.locale.startsWith('sl')) {
				ctrl = /Krmilka/gi;
				alt = /Izmenjalka/gi;
			}
			return msg.replace(ctrl, '⌘').replace(alt, '⌥');
		}
		return msg;
	},

	randomString: function(len) {
		var result = '';
		var ValidCharacters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		for (var i = 0; i < len; i++) {
			result += ValidCharacters.charAt(Math.floor(Math.random() * ValidCharacters.length));
		}
		return result;
	}
};

(function () {
	// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

	function getPrefixed(name) {
		return window['webkit' + name] || window['moz' + name] || window['ms' + name];
	}

	var lastTime = 0;

	// fallback for IE 7-8
	function timeoutDefer(fn) {
		var time = +new Date(),
		    timeToCall = Math.max(0, 16 - (time - lastTime));

		lastTime = time + timeToCall;
		return window.setTimeout(fn, timeToCall);
	}

	var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer,
	    cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
	               getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };


	L.Util.requestAnimFrame = function (fn, context, immediate) {
		if (immediate && requestFn === timeoutDefer) {
			fn.call(context);
		} else {
			return requestFn.call(window, L.bind(fn, context));
		}
	};

	L.Util.cancelAnimFrame = function (id) {
		if (id) {
			cancelFn.call(window, id);
		}
	};

	// on IE11 Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER are not supported
	L.Util.MAX_SAFE_INTEGER = Math.pow(2, 53)-1;
	L.Util.MIN_SAFE_INTEGER = -L.Util.MAX_SAFE_INTEGER;
})();

if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(searchString, position) {
		position = position || 0;
		return this.substr(position, searchString.length) === searchString;
	};
}

if (!Element.prototype.remove) {
	Element.prototype.remove = function() {
		if (this.parentNode) {
			this.parentNode.removeChild(this);
		}
	};
}

if (Number.EPSILON === undefined) {
	Number.EPSILON = Math.pow(2, -52);
}

if (!Number.MAX_SAFE_INTEGER) {
	Number.MAX_SAFE_INTEGER = 9007199254740991; // Math.pow(2, 53) - 1;
}

// shortcuts for most used utility functions
L.extend = L.Util.extend;
L.bind = L.Util.bind;
L.stamp = L.Util.stamp;
L.setOptions = L.Util.setOptions;
L.round = L.Util.round;
L.toggleFullScreen = L.Util.toggleFullScreen;
L.isEmpty = L.Util.isEmpty;
L.mm100thToInch = L.Util.mm100thToInch;
L.getTextWidth = L.Util.getTextWidth;
