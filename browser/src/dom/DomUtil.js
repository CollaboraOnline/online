/* -*- js-indent-level: 8 -*- */
/* global app cool DomUtilBase */
/*
 * window.L.DomUtil contains various utility functions for working with DOM.
 */

window.L.DomUtil = class DomUtil extends DomUtilBase {

	static addClass(el, name) {
		if (!el) {
			return;
		}

		if (el.classList !== undefined) {
			var classes = app.util.splitWords(name);
			for (var i = 0, len = classes.length; i < len; i++) {
				el.classList.add(classes[i]);
			}
		} else if (!window.L.DomUtil.hasClass(el, name)) {
			var className = window.L.DomUtil.getClass(el);
			window.L.DomUtil.setClass(el, (className ? className + ' ' : '') + name);
		}
	}

	static removeClass(el, name) {
		if (!el) {
			return;
		}

		if (el.classList !== undefined) {
			el.classList.remove(name);
		} else {
			window.L.DomUtil.setClass(el, app.util.trim((' ' + window.L.DomUtil.getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
		}
	}

	static removeChildNodes(el) {
		while (el.hasChildNodes()) {
			el.removeChild(el.lastChild);
		}
	}

	static setClass(el, name) {
		if (el.className.baseVal === undefined) {
			el.className = name;
		} else {
			// in case of SVG element
			el.className.baseVal = name;
		}
	}

	static setOpacity(el, value) {

		if ('opacity' in el.style) {
			el.style.opacity = value;

		} else if ('filter' in el.style) {
			window.L.DomUtil._setOpacityIE(el, value);
		}
	}

	static _setOpacityIE(el, value) {
		var filter = false,
		    filterName = 'DXImageTransform.Microsoft.Alpha';

		// filters collection throws an error if we try to retrieve a filter that doesn't exist
		try {
			filter = el.filters.item(filterName);
		} catch (e) {
			// don't set opacity to 1 if we haven't already set an opacity,
			// it isn't needed and breaks transparent pngs.
			if (value === 1) { return; }
		}

		value = Math.round(value * 100);

		if (filter) {
			filter.Enabled = (value !== 100);
			filter.Opacity = value;
		} else {
			el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
		}
	}

	static testProp(props) {

		var style = document.documentElement.style;

		for (var i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return false;
	}

	static setTransform(el, offset, scale) {
		var pos = offset || new cool.Point(0, 0);

		el.style[window.L.DomUtil.TRANSFORM] =
			'translate3d(' + pos.x + 'px,' + pos.y + 'px' + ',0)' + (scale ? ' scale(' + scale + ')' : '');
	}

	static setPosition(el, point, no3d) { // (HTMLElement, Point[, Boolean])

		/*eslint-disable */
		el._leaflet_pos = point;
		/*eslint-enable */

		if (window.L.Browser.any3d && !no3d) {
			window.L.DomUtil.setTransform(el, point);
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	}

	static getPosition(el) {
		// this method is only used for elements previously positioned using setPosition,
		// so it's safe to cache the position for performance

		return el._leaflet_pos;
	}

	static isPortrait() {
		return window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
	}

	// Add/remove a portrait or landscape class from the list of elements.
	static updateElementsOrientation(elements) {
		var remove = 'portrait';
		var add = 'landscape';
		if (window.L.DomUtil.isPortrait()) {
			remove = 'landscape';
			add = 'portrait';
		}

		for (var i = 0; i < elements.length; ++i) {
			var element = elements[i];
			var domElement = window.L.DomUtil.get(element);
			window.L.DomUtil.removeClass(domElement, remove);
			window.L.DomUtil.addClass(domElement, add);
		}
	}
};


(function () {
	// prefix style property names

	window.L.DomUtil.TRANSFORM = window.L.DomUtil.testProp(
		['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

	window.L.DomUtil.TRANSFORM_ORIGIN = window.L.DomUtil.testProp(
		['transformOrigin', 'msTransformOrigin', 'WebkitTransformOrigin']);

	// webkitTransition comes first because some browser versions that drop vendor prefix don't do
	// the same for the transitionend event, in particular the Android 4.1 stock browser

	var transition = window.L.DomUtil.TRANSITION = window.L.DomUtil.testProp(
		['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

	window.L.DomUtil.TRANSITION_END =
			transition === 'webkitTransition' || transition === 'OTransition' ? transition + 'End' : 'transitionend';


	if ('onselectstart' in document) {
		window.L.DomUtil.disableTextSelection = function () {
			window.L.DomEvent.on(window, 'selectstart', window.L.DomEvent.preventDefault);
		};
		window.L.DomUtil.enableTextSelection = function () {
			window.L.DomEvent.off(window, 'selectstart', window.L.DomEvent.preventDefault);
		};

	} else {
		var userSelectProperty = window.L.DomUtil.testProp(
			['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

		window.L.DomUtil.disableTextSelection = function () {
			if (userSelectProperty) {
				var style = document.documentElement.style;
				this._userSelect = style[userSelectProperty];
				style[userSelectProperty] = 'none';
			}
		};
		window.L.DomUtil.enableTextSelection = function () {
			if (userSelectProperty) {
				document.documentElement.style[userSelectProperty] = this._userSelect;
				delete this._userSelect;
			}
		};
	}

	window.L.DomUtil.disableImageDrag = function () {
		window.L.DomEvent.on(window, 'dragstart', window.L.DomEvent.preventDefault);
	};
	window.L.DomUtil.enableImageDrag = function () {
		window.L.DomEvent.off(window, 'dragstart', window.L.DomEvent.preventDefault);
	};

	window.L.DomUtil.preventOutline = function (element) {
		window.L.DomUtil.restoreOutline();
		this._outlineElement = element;
		this._outlineStyle = element.style.outline;
		element.style.outline = 'none';
		window.L.DomEvent.on(window, 'keydown', window.L.DomUtil.restoreOutline, this);
	};
	window.L.DomUtil.restoreOutline = function () {
		if (!this._outlineElement) { return; }
		this._outlineElement.style.outline = this._outlineStyle;
		delete this._outlineElement;
		delete this._outlineStyle;
		window.L.DomEvent.off(window, 'keydown', window.L.DomUtil.restoreOutline, this);
	};
})();
