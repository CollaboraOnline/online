/* -*- js-indent-level: 8 -*- */
/*
 * L.FormFieldButton is used to interact with text based form fields.
 */
/* global $ */
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
			this._buttonData = data;
		}
	},

	onAdd: function (map) {
		this._clearButton();

		this._buildFormButton(map);
	},

	_buildFormButton: function(map) {
		this._container = L.DomUtil.create('div', 'form-field-button-container', this.getPane('formfieldPane'));

		// Create a frame around the text area
		this._frame = L.DomUtil.create('div', 'form-field-frame', this._container);
		var buttonAreaLatLng = new L.LatLngBounds(
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[0], this._map.getZoom()),
				map._docLayer._twipsToLatLng(this._buttonAreaTwips[1], this._map.getZoom()));

		var buttonAreaLayer = new L.Bounds(
				this._map.latLngToLayerPoint(buttonAreaLatLng.getNorthWest()),
				this._map.latLngToLayerPoint(buttonAreaLatLng.getSouthEast()));

		// Use a small padding between the text and the frame
		var extraPadding = 2;
		var size = buttonAreaLayer.getSize();
		this.frameWidth = size.x + 1.5 * extraPadding;
		this.frameHeight = size.y + 1.5 * extraPadding;
		this._frame.style.width = this.frameWidth + 'px';
		this._container.style.height = this.frameHeight + 'px';

		this.framePos = new L.Point(buttonAreaLayer.min.x - extraPadding, buttonAreaLayer.min.y - extraPadding);
		L.DomUtil.setPosition(this._frame, this.framePos);

		// Add a drop down button to open the list
		this._button = L.DomUtil.create('button', 'form-field-button', this._container);
		var buttonPos = new L.Point(buttonAreaLayer.max.x + extraPadding, buttonAreaLayer.min.y - extraPadding);
		L.DomUtil.setPosition(this._button, buttonPos);
		this._button.style.width = this._container.style.height;

		var image = L.DomUtil.create('img', 'form-field-button-image', this._button);
		image.src = 'images/unfold.svg';

		this._button.addEventListener('click', this._onClickDropDown);

		// Build list of items
		this._dropDownList = L.DomUtil.create('div', 'drop-down-field-list', this.getPane('formfieldPane'));
		$('.drop-down-field-list').hide();
		var listPos = this.framePos;
		L.DomUtil.setPosition(this._dropDownList, listPos);
		this._dropDownList.style.minWidth = (this.frameWidth + this.frameHeight) + 'px';

		var itemList = this._buttonData.params.items;
		var selected = parseInt(this._buttonData.params.selected);
		for (var i = 0; i < itemList.length; ++i) {
			var option = L.DomUtil.create('div', 'drop-down-field-list-item', this._dropDownList);
			option.innerHTML = itemList[i];
			option.addEventListener('click', this._onListItemSelect);
			// Stop propagation to the main document
			option.addEventListener('mouseup', function(event) {event.stopPropagation();});
			option.addEventListener('mousedown', function(event) {event.stopPropagation();});
			if (i === selected)
				option.classList.add('selected');
		}
	},

	onRemove: function () {
		this._clearButton();
	},

	_onClickDropDown: function() {
		$('.drop-down-field-list').show();
	},

	_onListItemSelect: function(event) {
		$('.drop-down-field-list-item.selected').removeClass('selected');
		event.target.classList.add('selected');
		// TODO: send back
		$('.drop-down-field-list').hide();
		event.stopPropagation();
		console.warn(event.target.textContent);
	},

	_clearButton: function() {
		this.getPane('formfieldPane').innerHTML = '';
		this._frame = undefined;
		this._button = undefined;
	}

});
