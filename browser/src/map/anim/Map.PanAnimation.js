/* -*- js-indent-level: 8 -*- */
/*
 * Extends L.Map to handle panning animations.
 */

L.Map.include({

	setView: function (center, zoom, reset) {
		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(L.latLng(center), zoom, this.options.maxBounds);

		if (this._loaded && !reset && zoom === this._zoom) {
			// try animating pan or zoom
			var animated = this._tryAnimatedPan(center);

			if (animated) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	panBy: function (offset) {
		offset = L.point(offset).round();

		if (!offset.x && !offset.y)
			return this;

		//If we pan too far then chrome gets issues with tiles
		// and makes them disappear or appear in the wrong place (slightly offset) #2602
		if (!this.getSize().contains(offset)) {
			this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
			return this;
		}

		this.fire('movestart');
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
		this.fire('move').fire('moveend');

		return this;
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		L.DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._floor();

		// don't animate too far unless animate: true specified in options
		if (!this.getSize().contains(offset)) { return false; }

		this.panBy(offset);

		return true;
	}
});
