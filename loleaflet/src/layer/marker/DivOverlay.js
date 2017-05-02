/*
 * L.DivOverlay
 */

L.DivOverlay = L.Layer.extend({

	initialize: function (latLngBounds, options) {
		this._latLngBounds = L.latLngBounds(latLngBounds);
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;
		if (!this._container) {
			this._initLayout();
		}
		map._panes.overlayPane.appendChild(this._container);
	},

	onRemove: function (map) {
		map.removeLayer(this._annotation);
		map._panes.overlayPane.removeChild(this._container);
	},

	setLatLngBounds: function (latLngBounds) {
		this._latLngBounds = L.latLngBounds(latLngBounds);
		this.update();
	},

	update: function () {
		if (this._container && this._map) {
			var topLeft = this._map.latLngToLayerPoint(this._latLngBounds.getNorthWest());
			var size = this._map.latLngToLayerPoint(this._latLngBounds.getSouthEast()).subtract(topLeft);
			L.DomUtil.setPosition(this._container, topLeft);
			this._container.style.width = size.x + 'px';
			this._container.style.height = size.y + 'px';
		}
		if (this._annotation) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
		}
	},

	openAnnotation: function () {
		if (this._map && this._annotation && !this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit()) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
			this._map.addLayer(this._annotation);
			this._annotation.show();
		}
	},

	editAnnotation: function () {
		if (this._map && this._annotation) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
			this._map.addLayer(this._annotation);
			this._annotation.edit();
			this._annotation.focus();
		}
	},

	closePopup: function () {
		if (this._map && this._annotation) {
			this._annotation.show();
			this._map.removeLayer(this._annotation);
		}
	},

	closeAnnotation: function (e) {
		if (this._map && this._annotation && this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit() &&
		    !this._annotation.getBounds().contains(e.layerPoint)) {
			this._map.removeLayer(this._annotation);
		}
	},

	_onMouseLeave: function (e) {
		if (this._map && this._annotation && this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit() &&
		    !this._latLngBounds.contains(e.latlng)) {
			this._map.removeLayer(this._annotation);
		}
	},

	bindAnnotation: function (annotation) {
		this._annotation = annotation;
		if (!this._handlersAdded) {
			this.on('mouseover', this.openAnnotation, this);
			this.on('mouseout', this.closeAnnotation, this);
			this._annotation.on('AnnotationMouseLeave', this._onMouseLeave, this);
			this._handlersAdded = true;
		}
		return this;
	},

	unbindAnnotation: function () {
		if (this._annotation) {
			this.off('mouseover', this.openAnnotation, this);
			this.off('mouseout', this.closeAnnotation, this);
			this._annotation.off('AnnoationMouseLeave', this._onMouseLeave, this);
			this._handlerAdded = false;
			this._annotation = null;
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'loleaflet-div-layer');
		L.DomEvent.on(this._container, 'mouseover', this._fireMouseEvents, this);
		L.DomEvent.on(this._container, 'mouseout', this._fireMouseEvents, this);
		L.DomUtil.setOpacity(this._container, this.options.opacity);
		this.update();
	},

	_fireMouseEvents: function (e) {
		var containerPoint = this._map.mouseEventToContainerPoint(e),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint);

		this.fire(e.type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	}
});

L.divOverlay = function (latLngBounds, options) {
	return new L.DivOverlay(latLngBounds, options);
};

