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

			var styles = [];
			var topStyles = [];
			if (this._map.getDocType() === 'text') {
				// The list contains a total of 100+ styles, the first 7 are
				// the default styles (as shown on desktop writer), we then
				// also show a selection of 12 more styles.
				styles = e.commandValues.ParagraphStyles.slice(7, 19);
				topStyles = e.commandValues.ParagraphStyles.slice(0, 7);
			}
			else if (this._map.getDocType() === 'presentation' ||
				       this._map.getDocType() === 'drawing') {
				styles = e.commandValues.Default;
			}
			else if (this._map.getDocType() === 'spreadsheet') {
				styles = e.commandValues.CellStyles;
			}

			var commands = e.commandValues.Commands;
			if (commands && commands.length > 0) {
				this._addSeparator();
				commands.forEach(function (command) {
					var item = L.DomUtil.create('option', '', container);
					item.value = command.id;
					item.innerHTML = command.text.toLocaleString();
				});
			}

			if (topStyles.length > 0) {
				this._addSeparator();

				topStyles.forEach(function (style) {
					var item = L.DomUtil.create('option', '', container);
					item.value = style;
					item.innerHTML = style.toLocaleString();
				});
			}

			if (styles.length > 0) {
				this._addSeparator();

				styles.forEach(function (style) {
					var item = L.DomUtil.create('option', '', container);
					item.value = style;
					item.innerHTML = style.toLocaleString();
				});
			}
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
		if (style.startsWith('.uno:')) {
			this._map.sendUnoCommand(style);
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
