/*
 * L.Control.Buttons handles buttons such as bold, italic, etc.
 */

L.Control.Buttons = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var buttonsName = 'leaflet-control-buttons',
		    container = L.DomUtil.create('div', buttonsName + '-container' + ' leaflet-bar');

		this._buttons = {
			'bold':          {title: 'Bold',               uno: 'Bold',        iconName: 'bold.png'},
			'italic':        {title: 'Italic',             uno: 'Italic',      iconName: 'italic.png'},
			'underline':     {title: 'Underline',          uno: 'Underline',   iconName: 'underline.png'},
			'strikethrough': {title: 'Strike-through',     uno: 'Strikeout',   iconName: 'strikethrough.png'},
			'alignleft':     {title: 'Align left',         uno: 'LeftPara',    iconName: 'alignleft.png'},
			'aligncenter':   {title: 'Center horizontaly', uno: 'CenterPara',  iconName: 'aligncenter.png'},
			'alignright':    {title: 'Align right',        uno: 'RightPara',   iconName: 'alignright.png'},
			'alignblock':    {title: 'Justified',          uno: 'JustifyPara', iconName: 'alignblock.png'},
			'save':          {title: 'Save',               uno: 'Save',        iconName: 'save.png'},
			'saveas':        {title: 'Save As',            uno: '',            iconName: 'saveas.png'}
		};
		for (var key in this._buttons) {
			var button = this._buttons[key];
			if (key === 'alignleft' || key === 'save') {
				// add a separator
				L.DomUtil.create('span', 'leaflet-control-button-separator', container);
			}
			button.el = this._createButton(key, button.title, button.iconName,
				buttonsName, container, this._onButtonClick);
		}
		map.on('commandstatechanged', this._onStateChange, this);

		return container;
	},

	_createButton: function (id, title, iconName, className, container, fn) {
		var link = L.DomUtil.create('a', className, container);
		link.href = '#';
		link.title = title;
		var img = L.DomUtil.create('img', className, link);
		img.id = id;
		img.src = L.Icon.Default.imagePath + '/' + iconName;

		L.DomEvent
		    .on(link, 'mousedown dblclick', L.DomEvent.stopPropagation)
		    .on(link, 'click', L.DomEvent.stop)
		    .on(link, 'click', fn, this)
		    .on(link, 'click', this._refocusOnMap, this);

		return link;
	},

	_onButtonClick: function (e) {
		var id = e.target.id;
		var button = this._buttons[id];
		if (id === 'saveas') {
			vex.dialog.open({
				message: 'Save as:',
				input: this._getDialogHTML(),
				callback: L.bind(this._onSaveAs, this)
			});
		}
		else {
			this._map.toggleCommandState(button.uno);
		}
	},

	_onStateChange: function (e) {
		var unoCmd = e.unoCmd;
		var state = e.state;
		for (var key in this._buttons) {
			var button = this._buttons[key];
			if (button.uno === unoCmd) {
				if (state === 'true') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-active');
				}
				else if (state === 'false') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
				}
			}
		}
	},

	_getDialogHTML: function () {
		return (
			'<label for="url">URL</label>' +
			'<input name="url" type="text" value=' + this._map._docLayer.options.doc + '/>' +
			'<label for="format">Format</label>' +
			'<input name="format" type="text" />' +
			'<label for="options">Options</label>' +
			'<input name="options" type="text" />');
	},

	_onSaveAs: function (e) {
		if (e !== false) {
			this._map.saveAs(e.url, e.format, e.options);
		}
	}
});

L.control.buttons = function (options) {
	return new L.Control.Buttons(options);
};
