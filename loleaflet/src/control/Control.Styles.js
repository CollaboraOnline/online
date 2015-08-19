/*
 * L.Control.Styles is used to display a dropdown list of styles
 */

L.Control.Styles = L.Control.extend({
	options: {
		info: '- Please select a style -'
	},

	onAdd: function (map) {
		var stylesName = 'leaflet-control-styles';
		this._container = L.DomUtil.create('select', stylesName + ' leaflet-bar'),

		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('updatestyles', this._initList, this);
		L.DomEvent.on(this._container, 'change', this._onChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map.off('updatepermission', this._searchResultFound, this);
	},

	_initList: function (e) {
		var container = this._container;
		var first = L.DomUtil.create('option', '', container);
		first.innerHTML = this.options.info;
		if (this._map._docLayer._docType === 'text') {
			var styles = e.styles.ParagraphStyles.slice(0, 12);
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
		if (this._map._docLayer._docType === 'text') {
			this._map.setStyle(style, 'ParagraphStyles');
		}
	}
});

L.control.styles = function (options) {
	return new L.Control.Styles(options);
};
