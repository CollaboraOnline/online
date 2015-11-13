/*
 * L.Control.Fonts is used to display a dropdown list of fonts
 */

L.Control.Fonts = L.Control.extend({
	options: {
		fontsInfo: '- Fonts -',
		sizesInfo: '- Sizes -'
	},

	onAdd: function (map) {
		var fontsName = 'leaflet-control-fonts';
		var sizesName = 'leaflet-control-sizes';
		this._container = L.DomUtil.create('div', 'leaflet-control-fonts-container');
		this._fontSelect = L.DomUtil.create('select', fontsName + ' leaflet-bar', this._container);
		this._sizeSelect = L.DomUtil.create('select', sizesName + ' leaflet-bar', this._container);

		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('updatetoolbarcommandvalues', this._initList, this);
		map.on('commandstatechanged', this._onStateChange, this);
		L.DomEvent.on(this._fontSelect, 'change', this._onChangeFont, this);
		L.DomEvent.on(this._sizeSelect, 'change', this._onChangeSize, this);

		return this._container;
	},

	onRemove: function (map) {
		map.off('updatepermission', this._searchResultFound, this);
	},

	_initList: function (e) {
		if (e.commandName === '.uno:CharFontName') {
			this._commandValues = e.commandValues;
			var container = this._fontSelect;
			var first = L.DomUtil.create('option', '', container);
			first.innerHTML = this.options.fontsInfo;
			var fonts = e.commandValues;
			for (var font in fonts) {
				var item = L.DomUtil.create('option', '', container);
				item.value = font;
				item.innerHTML = font;
			}

			// Don't show any font sizes yet
			first = L.DomUtil.create('option', '', this._sizeSelect);
			first.innerHTML = this.options.sizesInfo;
		}
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._fontSelect.disabled = false;
			this._sizeSelect.disabled = false;
		}
		else {
			this._fontSelect.disabled = true;
			this._sizeSelect.disabled = true;
		}
	},

	_onChangeFont: function (e) {
		var font = e.target.value;
		if (font === this.options.fontsInfo) {
			return;
		}
		this._updateSizeList(font);
		this._map.applyFont(font);
		this._refocusOnMap();
	},

	_onChangeSize: function (e) {
		var size = e.target.value;
		if (size === this.options.sizesInfo) {
			return;
		}
		this._map.applyFontSize(size);
		this._refocusOnMap();
	},

	_updateSizeList: function (font) {
		var container = this._sizeSelect;
		var oldSize = this._sizeSelect.value;
		for (var i = container.options.length - 1; i >= 0; i--) {
			container.remove(i);
		}
		var first = L.DomUtil.create('option', '', container);
		first.innerHTML = this.options.sizesInfo;
		var sizes = this._commandValues[font];
		sizes.forEach(function (size) {
			var item = L.DomUtil.create('option', '', container);
			item.value = size;
			item.innerHTML = size;
		});
		this._setFontSize(oldSize);
	},

	_setFontSize: function (fontSize) {
		for (var i = 0; i < this._sizeSelect.length; i++) {
			var value = this._sizeSelect[i].value;
			if (value === fontSize) {
				this._sizeSelect.value = fontSize;
				return;
			}
		}
		// we have a new font size, like 18.2
		var item = L.DomUtil.create('option', '', this._sizeSelect);
		item.value = fontSize;
		item.innerHTML = fontSize;
		this._sizeSelect.value = fontSize;
	},

	_onStateChange: function (e) {
		if (e.commandName === '.uno:CharFontName') {
			for (var i = 0; i < this._fontSelect.length; i++) {
				var value = this._fontSelect[i].value;
				if (value && value.toLowerCase() === e.state.toLowerCase()) {
					this._fontSelect.value = value;
					this._updateSizeList(value);
					return;
				}
			}
			// we have a new font name
			var item = L.DomUtil.create('option', '', this._fontSelect);
			item.value = e.state;
			item.innerHTML = e.state;
			this._fontSelect.value = e.state;
		}
		else if (e.commandName === '.uno:FontHeight') {
			if (e.state === '0') {
				e.state = '';
			}
			this._setFontSize(e.state);
		}
	}
});

L.control.fonts = function (options) {
	return new L.Control.Fonts(options);
};
