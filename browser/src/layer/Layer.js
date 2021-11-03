/* -*- js-indent-level: 8 -*- */

L.Layer = L.Evented.extend({

	options: {
		pane: 'overlayPane'
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	remove: function () {
		return this.removeFrom(this._map || this._mapToAdd);
	},

	removeFrom: function (obj) {
		if (obj) {
			obj.removeLayer(this);
		}
		return this;
	},

	getPane: function (name) {
		return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
	},

	addInteractiveTarget: function (targetEl) {
		this._map._targets[L.stamp(targetEl)] = this;
		return this;
	},

	removeInteractiveTarget: function (targetEl) {
		delete this._map._targets[L.stamp(targetEl)];
		return this;
	},

	_layerAdd: function (e) {
		var map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		this.onAdd(map);

		if (this.getEvents) {
			map.on(this.getEvents(), this);
		}

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
});


L.Map.include({
	addLayer: function (layer) {
		var id = L.stamp(layer);
		if (this._layers[id]) { return layer; }
		this._layers[id] = layer;

		layer._mapToAdd = this;

		if (layer.beforeAdd) {
			layer.beforeAdd(this);
		}

		this.whenReady(layer._layerAdd, layer);

		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		if (layer.getEvents) {
			this.off(layer.getEvents(), layer);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
			layer.fire('remove');
		}

		layer._map = layer._mapToAdd = null;

		return this;
	},

	hasLayer: function (layer) {
		return !!layer && (L.stamp(layer) in this._layers);
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	_addLayers: function (layers) {
		layers = layers ? (L.Util.isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_addZoomLimit: function (layer) {
		if (isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[L.stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	},

	_removeZoomLimit: function (layer) {
		var id = L.stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	},

	_updateZoomLevels: function () {
		var minZoom = Infinity,
		    maxZoom = -Infinity,
		    oldZoomSpan = this._getZoomSpan();

		for (var i in this._zoomBoundLayers) {
			var options = this._zoomBoundLayers[i].options;

			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}
	}
});

// Used in L.Marker and L.Popup for computing layer position from latlng optionally with offsets
// with or without freeze-panes. This also indicates in the returned object
// whether the object should be visible or not when freeze panes are active.
L.Layer.getLayerPositionVisibility = function (latlng, boundingClientRect, map, offset) {
	var splitPanesContext = map.getSplitPanesContext();

	if (!splitPanesContext) {
		return {
			position: map.latLngToLayerPoint(latlng).round(),
			visibility: 'visible'
		};
	}

	var splitPos = splitPanesContext.getSplitPos();
	var docPos = map.project(latlng);
	var docPosWithOffset = docPos.clone();
	if (offset) {
		docPosWithOffset._add(offset);
	}
	var pixelOrigin = map.getPixelOrigin();
	var mapPanePos = map._getMapPanePos();
	var layerSplitPos = splitPos.subtract(mapPanePos);

	var makeHidden = false;

	if (splitPos.x) {
		layerSplitPos.x += 1;
	}

	if (splitPos.y) {
		layerSplitPos.y += 1;
	}

	var layerPos = new L.Point(0, 0);
	var layerPosWithOffset = new L.Point(0, 0);
	var eps = new L.Point(boundingClientRect.width, boundingClientRect.height);

	if (docPosWithOffset.x <= splitPos.x) {
		// fixed region.
		layerPos.x = docPos.x - mapPanePos.x;
		layerPosWithOffset.x = docPosWithOffset.x - mapPanePos.x;
		if (splitPos.x - docPosWithOffset.x <= eps.x) {
			// Hide the object if it is close to the split *and* the non-fixed region has moved away from the fixed.
			makeHidden = (mapPanePos.x !== pixelOrigin.x);
		}
	}
	else {
		layerPos.x = docPos.x - pixelOrigin.x;
		layerPosWithOffset.x = docPosWithOffset.x - pixelOrigin.x;
		if (layerPosWithOffset.x < layerSplitPos.x) {
			// do not encroach the fixed region.
			makeHidden = true;
		}
	}

	if (docPosWithOffset.y <= splitPos.y) {
		// fixed region.
		layerPos.y = docPos.y - mapPanePos.y;
		layerPosWithOffset.y = docPosWithOffset.y - mapPanePos.y;
		if (splitPos.y - docPosWithOffset.y <= eps.y) {
			// Hide the marker if it is close to the split *and* the non-fixed region has moved away from the fixed.
			makeHidden = (mapPanePos.y !== pixelOrigin.y);
		}
	}
	else {
		layerPos.y = docPos.y - pixelOrigin.y;
		layerPosWithOffset.y = docPosWithOffset.y - pixelOrigin.y;
		if (layerPosWithOffset.y < layerSplitPos.y) {
			// do not encroach the fixed region.
			makeHidden = true;
		}
	}

	return {
		position: layerPos,
		visibility: makeHidden ? 'hidden' : 'visible'
	};
};
