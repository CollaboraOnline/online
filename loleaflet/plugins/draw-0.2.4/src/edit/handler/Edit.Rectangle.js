/* -*- js-indent-level: 8 -*- */
L.Edit = L.Edit || {};

L.Edit.Rectangle = L.Edit.SimpleShape.extend({
	_createMoveMarker: function () {
		var bounds = this._shape.getBounds(),
		center = bounds.getCenter();

		this._moveMarker = this._createMarker(center, this.options.moveIcon);
		this._moveMarker.setOpacity(0);
	},

	_createResizeMarker: function () {
		var corners = this._getCorners();

		this._resizeMarkers = [];

		for (var i = 0, l = corners.length; i < l; i++) {
			this._resizeMarkers.push(this._createMarker(corners[i], this.options.resizeIcon));
			// Monkey in the corner index as we will need to know this for dragging
			this._resizeMarkers[i]._cornerIndex = i;
		}
	},

	_onMarkerDragStart: function (e) {
		L.Edit.SimpleShape.prototype._onMarkerDragStart.call(this, e);

		// Save a reference to the opposite point
		var corners = this._getCorners(),
		marker = e.target,
		currentCornerIndex  = marker._cornerIndex,
		oppositeCornerIndex = (currentCornerIndex + 4) % 8;

		this._oppositeCorner = corners[ oppositeCornerIndex % 2 ?  (oppositeCornerIndex + 1) % 8 : oppositeCornerIndex ];
		this._currentCorner  = corners[ currentCornerIndex  % 2 ?  (currentCornerIndex  + 1) % 8 : currentCornerIndex ];
		this._currentIndex = currentCornerIndex;

		this._toggleCornerMarkers(0, currentCornerIndex);
	},

	_onMarkerDragEnd: function (e) {
		var marker = e.target,
		bounds, center;

		// Reset move marker position to the center
		if (marker === this._moveMarker) {
			bounds = this._shape.getBounds();
			center = bounds.getCenter();

			marker.setLatLng(center);
		}

		this._toggleCornerMarkers(1);

		L.Edit.SimpleShape.prototype._onMarkerDragEnd.call(this, e);
	},

	_move: function (newCenter) {
		var latlngs = this._shape.getLatLngs(),
		bounds = this._shape.getBounds(),
		center = bounds.getCenter(),
		offset, newLatLngs = [];

		// Offset the latlngs to the new center
		for (var i = 0, l = latlngs.length; i < l; i++) {
			offset = [latlngs[i].lat - center.lat, latlngs[i].lng - center.lng];
			newLatLngs.push([newCenter.lat + offset[0], newCenter.lng + offset[1]]);
		}

		this._shape.setLatLngs(newLatLngs);

		// Reposition the resize markers
		this._repositionCornerMarkers();
	},

	_resize: function (latlng) {
		var bounds;

		if (this._currentIndex == 1 || this._currentIndex == 5)
			latlng.lng = this._currentCorner.lng;
		else if (this._currentIndex == 3 || this._currentIndex == 7)
			latlng.lat = this._currentCorner.lat;

		// Update the shape based on the current position of this corner and the opposite point
		this._shape.setBounds(L.latLngBounds(latlng, this._oppositeCorner));

		// Reposition the move marker
		bounds = this._shape.getBounds();
		this._moveMarker.setLatLng(bounds.getCenter());
	},

	_getCorners: function () {
		var bounds = this._shape.getBounds(),
		nw = bounds.getNorthWest(),
		ne = bounds.getNorthEast(),
		se = bounds.getSouthEast(),
		sw = bounds.getSouthWest(),
		center = bounds.getCenter(),
		north  = L.latLng(nw.lat, center.lng),
		south  = L.latLng(sw.lat, center.lng),
		west   = L.latLng(center.lat, nw.lng),
		east   = L.latLng(center.lat, ne.lng);

		return [nw, north, ne, east, se, south, sw, west];
	},

	_toggleCornerMarkers: function (opacity) {
		for (var i = 0, l = this._resizeMarkers.length; i < l; i++) {
			this._resizeMarkers[i].setOpacity(opacity);
		}
	},

	_repositionCornerMarkers: function () {
		var corners = this._getCorners();

		for (var i = 0, l = this._resizeMarkers.length; i < l; i++) {
			this._resizeMarkers[i].setLatLng(corners[i]);
		}
	}
});

L.Rectangle.addInitHook(function () {
	if (L.Edit.Rectangle) {
		this.editing = new L.Edit.Rectangle(this);

		if (this.options.editable) {
			this.editing.enable();
		}
	}
});
