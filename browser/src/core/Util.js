/* -*- js-indent-level: 8 -*- */
/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

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


};

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
L.setOptions = L.Util.setOptions;
