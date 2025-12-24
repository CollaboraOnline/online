/* -*- js-indent-level: 8 -*- */
/* global DomUtilBase */
/*
 * window.L.DomUtil contains various utility functions for working with DOM.
 */

window.L.DomUtil = class DomUtil extends DomUtilBase {

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
