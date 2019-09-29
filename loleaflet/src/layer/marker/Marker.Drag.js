/* -*- js-indent-level: 8 -*- */
/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */

L.Handler.MarkerDrag = L.Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;

		if (!this._draggable) {
			this._draggable = new L.Draggable(icon, icon, true);
		}

		this._draggable.on({
			down: this._onDown,
			dragstart: this._onDragStart,
			drag: this._onDrag,
			dragend: this._onDragEnd,
			up: this._onUp
		}, this).enable();

		L.DomUtil.addClass(icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable.off({
			down: this._onDown,
			dragstart: this._onDragStart,
			drag: this._onDrag,
			dragend: this._onDragEnd,
			up: this._onUp
		}, this).disable();

		if (this._marker._icon) {
			L.DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
		}
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	freezeX: function (boolChoice) {
		if (this._draggable)
			this._draggable.freezeX(boolChoice);
	},

	freezeY: function (boolChoice) {
		if (this._draggable)
			this._draggable.freezeY(boolChoice);
	},

	_onDown: function (e) {
		this._marker.fire('down', e);
	},

	_onDragStart: function (e) {
		this._marker
		    .closePopup()
		    .fire('movestart', e)
		    .fire('dragstart', e);
	},

	_onDrag: function (e) {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = L.DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			L.DomUtil.setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;
		e.latlng = latlng;

		marker
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onDragEnd: function (e) {
		this._marker
		    .fire('moveend', e)
		    .fire('dragend', e);
	},

	_onUp: function (e) {
		this._marker.fire('up', e);
	}
});
