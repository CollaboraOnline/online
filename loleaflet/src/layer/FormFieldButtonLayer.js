/* -*- js-indent-level: 8 -*- */
/*
 * L.FormFieldButton is used to interact with text based form fields.
 */

L.FormFieldButton = L.Layer.extend({

	options: {
		pane: 'formfieldPane'
	},

	initialize: function (data) {
		if (data.type === 'drop-down') {
			var strTwips = data.textArea.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._buttonAreaTwips = [topLeftTwips, bottomRightTwips];
		}
	},

	onAdd: function (map) {
		if (this._button) {
			L.DomUtil.remove(this._button);
		}

		this._button = L.DomUtil.create('div', 'drop-down-button', this.getPane('formfieldPane'));
		var buttonAreaLatLng = new L.LatLngBounds(
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[0], this._map.getZoom()),
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[1], this._map.getZoom()));

		var buttonAreaLayer = new L.Bounds(
				this._map.latLngToLayerPoint(buttonAreaLatLng.getNorthWest()),
				this._map.latLngToLayerPoint(buttonAreaLatLng.getSouthEast()));

		var size = buttonAreaLayer.getSize();
		this._button.style.width  = size.x + 'px';
		this._button.style.height = size.y + 'px';

		var pos = buttonAreaLayer.min;
		L.DomUtil.setPosition(this._button, pos);
	},

	onRemove: function () {
		L.DomUtil.remove(this._button);
		this._button = undefined;
	},

});
