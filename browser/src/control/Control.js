/* -*- js-indent-level: 8 -*- */
/*
 * window.L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

window.L.Control = window.L.Class.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		window.L.setOptions(this, options);
	},

	getPosition: function () {
		return this.options.position;
	},

	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	getContainer: function () {
		return this._container;
	},

	addTo: function (map) {
		this.remove();
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		window.L.DomUtil.addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		if (this.onAdded) {
			this.onAdded(this._map);
		}

		return this;
	},

	remove: function () {
		if (!this._map) {
			return this;
		}

		window.L.DomUtil.remove(this._container);

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map = null;

		return this;
	},

	isVisible: function () {
		if (!this._map) {
			return false;
		}
		var corner = this._map._controlCorners[this.options.position];
		return corner.hasChildNodes();
	}
});

window.L.control = function (options) {
	return new window.L.Control(options);
};


// adds control-related methods to window.L.Map

window.L.Map.include({
	addControl: function (control) {
		control._map = this;
		control.onAdd(this);

		return this;
	},

	removeControl: function (control) {
		control.remove();
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {};
		var l = 'leaflet-';

		// Add the controls to document-container instead of map. Because now, map is behind canvas element.
		var container = this._controlContainer = window.L.DomUtil.create('div', l + 'control-container', document.getElementById('document-container'));

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = window.L.DomUtil.create('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		window.L.DomUtil.remove(this._controlContainer);
	}
});
