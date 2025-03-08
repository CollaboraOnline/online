/* -*- js-indent-level: 8 -*- */
/*
 * L.Marker is used to display clickable/draggable icons on the map.
 */

L.Marker = L.Layer.extend({

	options: {
		pane: 'markerPane',

		icon: new L.Icon.Default(),
		// title: '',
		// alt: '',
		interactive: true,
		draggable: false,
		keyboard: true,
		zIndexOffset: 0,
		opacity: 1,
		// riseOnHover: false,
		riseOffset: 250
	},

	initialize: function (latlng, options) {

		L.Layer.prototype.initialize.call(this);

		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this.on('down', this.onDown);
		this.on('up', this.onUp);
	},

	onAdd: function () {
		this._initIcon();
		this.update();
	},

	onRemove: function () {
		if (this.dragging && this.dragging.enabled()) {
			this.dragging.removeHooks();
		}

		this._removeIcon();
		this._removeShadow();
	},

	onDown: function () {
		if (this._map && this._map.touchGesture) {
			window.IgnorePanning = true;
		}
	},

	onUp: function () {
		if (this._map && this._map.touchGesture) {
			window.IgnorePanning = undefined;
		}
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		var splitPanesPossible = this._map._docLayer.hasSplitPanesSupport();
		if (splitPanesPossible) {
			events.moveend = this.update;
			events.drag = this.update;
			events.splitposchanged = this.update;
		}

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		return this;
	},

	_updateIconPosition: function () {

		if (!this._icon) {
			return;
		}

		var posVis = L.Layer.getLayerPositionVisibility(this._latlng,
			this._icon.getBoundingClientRect(), this._map);

		if (this._icon.style.visibility != posVis.visibility) {
			this._icon.style.visibility = posVis.visibility;
		}

		this._setPos(posVis.position);
	},

	update: function () {
		this._updateIconPosition();
		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-hide';

		var icon = options.icon.createIcon(this._icon),
		    addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}
			if (options.alt) {
				icon.alt = options.alt;
			}
		}

		L.DomUtil.addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;
		this._initInteraction();

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		var newShadow = options.icon.createShadow(this._shadow),
		    addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			L.DomUtil.addClass(newShadow, classToAdd);
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().appendChild(this._icon);
		}
		if (newShadow && addShadow) {
			this.getPane('shadowPane').appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		L.DomUtil.remove(this._icon);
		this.removeInteractiveTarget(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			L.DomUtil.remove(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._icon, pos);

		if (this._shadow) {
			L.DomUtil.setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_initInteraction: function () {

		if (!this.options.interactive) { return; }

		L.DomUtil.addClass(this._icon, 'leaflet-interactive');

		this.addInteractiveTarget(this._icon);

		if (L.Handler.MarkerDrag) {
			var draggable = this.options.draggable;
			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new L.Handler.MarkerDrag(this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		L.DomUtil.setOpacity(this._icon, opacity);

		if (this._shadow) {
			L.DomUtil.setOpacity(this._shadow, opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	}
});

L.marker = function (latlng, options) {
	return new L.Marker(latlng, options);
};
