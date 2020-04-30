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
		this._clearButton();

		this._buildFormButton(map);
	},

	_buildFormButton: function(map) {
		// Create a frame around the text area
		this._frame = L.DomUtil.create('div', 'form-field-frame', this.getPane('formfieldPane'));
		var buttonAreaLatLng = new L.LatLngBounds(
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[0], this._map.getZoom()),
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[1], this._map.getZoom()));

		var buttonAreaLayer = new L.Bounds(
				this._map.latLngToLayerPoint(buttonAreaLatLng.getNorthWest()),
				this._map.latLngToLayerPoint(buttonAreaLatLng.getSouthEast()));

		// Use a small padding between the text and the frame
		var extraPadding = 2;
		var size = buttonAreaLayer.getSize();
		this._frame.style.width = (size.x + 1.5 * extraPadding) + 'px';

		this.getPane('formfieldPane').style.height = (size.y + 1.5 * extraPadding) + 'px';

		var framePos = new L.Point(buttonAreaLayer.min.x - extraPadding, buttonAreaLayer.min.y - extraPadding);
		L.DomUtil.setPosition(this._frame, framePos);

		// Add a drop down button to open the list
		this._button = L.DomUtil.create('button', 'form-field-button', this.getPane('formfieldPane'));
		var buttonPos = new L.Point(buttonAreaLayer.max.x + extraPadding, buttonAreaLayer.min.y - extraPadding);
		L.DomUtil.setPosition(this._button, buttonPos);
		this._button.style.width = this.getPane('formfieldPane').style.height;

		var image = L.DomUtil.create('img', 'form-field-button-image', this._button);
		image.src = 'images/unfold.svg';
	},

	onRemove: function () {
		this._clearButton();
	},

	_clearButton: function() {
		this.getPane('formfieldPane').innerHTML = '';
		if (this._frame) {
			L.DomUtil.remove(this._frame);
			this._frame = undefined;
		}
		if (this._button) {
			L.DomUtil.remove(this._button);
			this._button = undefined;
		}
	}

});
