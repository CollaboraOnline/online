/*
 * L.Control.Styles is used to display a dropdown list of styles
 */

L.Control.Styles = L.Control.extend({
	options: {
		info: '- Styles -'
	},

	onAdd: function (map) {
		var stylesName = 'leaflet-control-styles';
		this._container = L.DomUtil.create('select', stylesName + ' leaflet-bar');

		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('updatetoolbarcommandvalues', this._initList, this);
		map.on('commandstatechanged', this._onStateChange, this);
		L.DomEvent.on(this._container, 'change', this._onChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map.off('updatepermission', this._searchResultFound, this);
	},

	_addSeparator: function () {
		var item = L.DomUtil.create('option', '', this._container);
		item.disabled = true;
		item.value = 'separator';
		item.innerHTML = '&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;';
	},

	_initList: function (e) {
		if (e.commandName === '.uno:StyleApply') {
			var container = this._container;
			var first = L.DomUtil.create('option', '', container);
			first.innerHTML = this.options.info;
			if (this._map.getDocType() === 'text') {
				var styles = e.commandValues['ParagraphStyles'].slice(0, 12);
			}
			else if (this._map.getDocType() === 'presentation') {
				styles = e.commandValues['Default'];
			}
			else {
				styles = [];
			}

			this._addSeparator();
			if (e.commandValues['ClearStyle']) {
				var item = L.DomUtil.create('option', '', container);
				item.value = 'ClearStyle';
				item.innerHTML = e.commandValues['ClearStyle'];
			}
			styles.forEach(function (style) {
				var item = L.DomUtil.create('option', '', container);
				item.value = style;
				item.innerHTML = style;
			});
		}
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._container.disabled = false;
		}
		else {
			this._container.disabled = true;
		}
	},

	_onChange: function (e) {
		var style = e.target.value;
		if (style === this.options.info) {
			return;
		}
		if (style === 'ClearStyle') {
			this._map.clearStyle();
		}
		else if (this._map.getDocType() === 'text') {
			this._map.applyStyle(style, 'ParagraphStyles');
		}
		else if (this._map.getDocType() === 'presentation') {
			this._map.applyStyle(style, 'Default');
		}
		this._refocusOnMap();
	},

	_onStateChange: function (e) {
		if (e.commandName === '.uno:StyleApply') {
			// Fix 'Text Body' vs 'Text body'
			for (var i = 0; i < this._container.length; i++) {
				var value = this._container[i].value;
				if (value && value.toLowerCase() === e.state.toLowerCase()) {
					this._container.value = value;
				}
			}
		}
	}
});

L.control.styles = function (options) {
	return new L.Control.Styles(options);
};
