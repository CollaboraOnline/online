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
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this.on('down', this.onDown);
		this.on('up', this.onUp);
	},

	setDraggable: function(val) {
		if (!this.dragging) {
			this.options.draggable = val;
			return;
		}

		if (val) {
			this.dragging.enable();
		} else {
			this.dragging.disable();
		}
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

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

		if (this._zoomAnimated && !splitPanesPossible) {
			events.zoomanim = this._animateZoom;
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

	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup, this._popup.options);
		}

		return this;
	},

	_updateIconPosition: function () {

		if (!this._icon) {
			return;
		}

		var splitPanesContext = this._map.getSplitPanesContext();

		if (!splitPanesContext) {
			this._setPos(this._map.latLngToLayerPoint(this._latlng).round());
			return;
		}

		var splitPos = splitPanesContext.getSplitPos();
		var docPos = this._map.project(this._latlng);
		var pixelOrigin = this._map.getPixelOrigin();
		var mapPanePos = this._map._getMapPanePos();
		var layerSplitPos = splitPos.subtract(mapPanePos);

		var makeHidden = false;

		if (splitPos.x) {
			layerSplitPos.x += 1;
		}

		if (splitPos.y) {
			layerSplitPos.y += 1;
		}

		var layerPos = new L.Point(0, 0);
		var iconRect = this._icon.getBoundingClientRect();
		var eps = new L.Point(iconRect.width, iconRect.height);

		if (docPos.x <= splitPos.x) {
			// fixed region.
			layerPos.x = docPos.x - mapPanePos.x;
			if (splitPos.x - docPos.x <= eps.x) {
				// Hide the marker if it is close to the split *and* the non-fixed region has moved away from the fixed.
				makeHidden = (mapPanePos.x !== pixelOrigin.x);
			}
		}
		else {
			layerPos.x = docPos.x - pixelOrigin.x;
			if (layerPos.x < layerSplitPos.x) {
				// do not encroach the fixed region.
				makeHidden = true;
			}
		}

		if (docPos.y <= splitPos.y) {
			// fixed region.
			layerPos.y = docPos.y - mapPanePos.y;
			if (splitPos.y - docPos.y <= eps.y) {
				// Hide the marker if it is close to the split *and* the non-fixed region has moved away from the fixed.
				makeHidden = (mapPanePos.y !== pixelOrigin.y);
			}
		}
		else {
			layerPos.y = docPos.y - pixelOrigin.y;
			if (layerPos.y < layerSplitPos.y) {
				// do not encroach the fixed region.
				makeHidden = true;
			}
		}

		var newVisibility = makeHidden ? 'hidden' : 'visible';
		if (this._icon.style.visibility != newVisibility) {
			this._icon.style.visibility = newVisibility;
		}

		this._setPos(layerPos);
	},

	update: function () {
		this._updateIconPosition();
		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

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

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
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
