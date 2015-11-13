/*
 * L.Control.Buttons handles buttons such as bold, italic, etc.
 */

/* global vex */
L.Control.Buttons = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var buttonsName = 'leaflet-control-buttons',
		    container = L.DomUtil.create('div', buttonsName + '-container' + ' leaflet-bar');

		var sheetAlign = 'HorizontalAlignment {"HorizontalAlignment":{"type":"unsigned short", "value":"';

		this._buttons = {
			'bold':          {title: 'Bold',               uno: 'Bold',             iconName: 'bold.png'},
			'italic':        {title: 'Italic',             uno: 'Italic',           iconName: 'italic.png'},
			'underline':     {title: 'Underline',          uno: 'Underline',        iconName: 'underline.png'},
			'strikethrough': {title: 'Strike-through',     uno: 'Strikeout',        iconName: 'strikethrough.png'},
			'bullet'       : {title: 'Bullets ON/OFF',     uno: 'DefaultBullet',    iconName: 'defaultbullet.png'},
			'numbering'    : {title: 'Numbering ON/OFF',   uno: 'DefaultNumbering', iconName: 'defaultnumbering.png'},
			'alignleft':     {title: 'Align left',         uno: 'LeftPara', unosheet: sheetAlign + '1"}}',     iconName: 'alignleft.png'},
			'aligncenter':   {title: 'Center horizontaly', uno: 'CenterPara', unosheet: sheetAlign + '2"}}',   iconName: 'aligncenter.png'},
			'alignright':    {title: 'Align right',        uno: 'RightPara', unosheet: sheetAlign + '3"}}',    iconName: 'alignright.png'},
			'alignblock':    {title: 'Justified',          uno: 'JustifyPara', unosheet: sheetAlign + '4"}}',  iconName: 'alignblock.png'},
			'incindent':     {title: 'Increment indent',   uno: 'IncrementIndent',  iconName: 'incrementindent.png'},
			'decindent':     {title: 'Decrement indent',   uno: 'DecrementIndent',  iconName: 'decrementindent.png'},
			'save':          {title: 'Save',               uno: 'Save',             iconName: 'save.png'},
			'saveas':        {title: 'Save As',                                     iconName: 'saveas.png'},
			'undo':          {title: 'Undo',               uno: 'Undo',             iconName: 'undo.png'},
			'redo':          {title: 'Redo',               uno: 'Redo',             iconName: 'redo.png'},
			'edit':          {title: 'Enable editing',                              iconName: 'edit.png'},
			'selection':     {title: 'Enable selection',                            iconName: 'selection.png'},
			'presentation':  {title: 'Present',                                     iconName: 'presentation.png'}
		};
		var separator = ['alignleft', 'save', 'undo', 'bullet', 'edit', 'presentation'];
		for (var key in this._buttons) {
			var button = this._buttons[key];
			if (separator.indexOf(key) >= 0) {
				// add a separator
				L.DomUtil.create('span', 'leaflet-control-button-separator', container);
			}
			button.el = this._createButton(key, button.title, button.iconName,
				buttonsName, container, this._onButtonClick);
		}
		map.on('commandstatechanged', this._onStateChange, this);
		map.on('updatepermission', this._onPermissionUpdate, this);

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
		else if (button.uno && this._map._docLayer._permission === 'edit') {
			if (button.unosheet && this._map.getDocType() === 'spreadsheet') {
				this._map.toggleCommandState(button.unosheet);
			}
			else {
				this._map.toggleCommandState(button.uno);
			}
		}
		else if (id === 'edit' && !L.DomUtil.hasClass(button.el.firstChild, 'leaflet-control-buttons-disabled')) {
			if (this._map.getPermission() === 'edit') {
				this._map.setPermission('view');
			}
			else if (this._map.getPermission() === 'view') {
				this._map.setPermission('edit');
			}
		}
		else if (id === 'selection' && !L.DomUtil.hasClass(button.el.firstChild, 'leaflet-control-buttons-disabled')) {
			if (this._map.isSelectionEnabled()) {
				this._map.disableSelection();
				L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
			}
			else {
				this._map.enableSelection();
				L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-active');
			}
		}
		else if (id === 'presentation') {
			this._map.fire('fullscreen');
		}
	},

	_onStateChange: function (e) {
		var commandName = e.commandName;
		var state = e.state;
		for (var key in this._buttons) {
			var button = this._buttons[key];
			if ('.uno:' + button.uno === commandName) {
				if (state === 'true') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-active');
				}
				else if (state === 'false') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
				}
				else if (state === 'enabled' && this._map._docLayer._permission === 'edit') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else if (state === 'disabled') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
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
	},

	_onPermissionUpdate: function (e) {
		for (var id in this._buttons) {
			var button = this._buttons[id];
			if (button.uno) {
				if (e.perm !== 'edit') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
			}
			else if (id === 'edit') {
				if (e.perm === 'edit') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-active');
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else if (e.perm === 'view') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else if (e.perm === 'readonly') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
			}
			else if (id === 'selection') {
				if (e.perm === 'edit') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-active');
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else if (e.perm === 'view' || e.perm === 'readonly') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-active');
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
			}
		}
	}
});

L.control.buttons = function (options) {
	return new L.Control.Buttons(options);
};
