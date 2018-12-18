/* -*- js-indent-level: 8 -*- */
/*
 * L.ClipboardContainer is used to overlay the hidden clipbaord container on the map
 */

L.ClipboardContainer = L.Layer.extend({

	initialize: function () {
		this._initLayout();
	},

	onAdd: function () {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		L.DomEvent.on(this._textArea, 'copy cut paste ' +
		              'keydown keypress keyup ' +
		              'compositionstart compositionupdate compositionend textInput',
		              this._map._handleDOMEvent, this._map);
	},

	onRemove: function () {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}

		L.DomEvent.off(this._textArea, 'copy cut paste ' +
		               'keydown keypress keyup ' +
		               'compositionstart compositionupdate compositionend textInput',
		               this._map._handleDOMEvent, this._map);
	},

	focus: function(focus) {
		if (focus === false) {
			this._textArea.blur();
		} else {
			this._textArea.focus();
		}
	},

	select: function() {
		this._textArea.select();
	},

	getValue: function() {
		return this._textArea.value;
	},

	setValue: function(val) {
		this._textArea.value = val;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		this.update();
	},

	update: function () {
		if (this._container && this._map && this._latlng) {
			var position = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(position);
		}
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'clipboard-container');
		this._container.id = 'doc-clipboard-container';
		this._textArea = L.DomUtil.create('input', 'clipboard', this._container);
		this._textArea.setAttribute('type', 'text');
		this._textArea.setAttribute('autocorrect', 'off');
		this._textArea.setAttribute('autocapitalize', 'off');
		this._textArea.setAttribute('autocomplete', 'off');
		this._textArea.setAttribute('spellcheck', 'false');
	},

	activeElement: function () {
		return this._textArea;
	},

	showCursor: function () {
		if (!this._map._docLayer._cursorMarker) {
			return;
		}

		this._map.addLayer(this._map._docLayer._cursorMarker);

		// move the hidden input field with the cursor
		var cursorPos = this._map._docLayer._visibleCursor.getNorthWest();
		L.DomUtil.setPosition(this._container, this._map.latLngToLayerPoint(L.latLng(cursorPos)).round());
	},

	hideCursor: function () {
		if (!this._map._docLayer._cursorMarker) {
			return;
		}

		this._map.removeLayer(this._map._docLayer._cursorMarker);
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.clipboardContainer = function () {
	return new L.ClipboardContainer();
};
