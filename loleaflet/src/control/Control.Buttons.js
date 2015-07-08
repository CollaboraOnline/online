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
			'alignleft':     {title: 'Align left',         uno: 'AlignLeft',   iconName: 'alignleft.png'},
			'aligncenter':   {title: 'Center horizontaly', uno: 'AlignCenter', iconName: 'aligncenter.png'},
			'alignright':    {title: 'Align right',        uno: 'AlignRight',  iconName: 'alignright.png'},
			'alignblock':    {title: 'Justified',          uno: 'AlignBlock',  iconName: 'alignblock.png'}
		};
		for (var key in this._buttons) {
			var button = this._buttons[key];
			button.el = this._createButton(key, button.title, button.iconName,
				buttonsName, container, this._onButtonClick);
		}
		map.on('statechanged', this._onStateChange, this);

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
		if (button.active) {
			L.DomUtil.removeClass(e.target, 'leaflet-control-buttons-active');
			button.active = false;
		}
		else {
			L.DomUtil.addClass(e.target, 'leaflet-control-buttons-active');
			button.active = true;
		}
		this._map.socket.send('uno .uno:' + button.uno);
	},

	_onStateChange: function (e) {
		var unoCmd = e.state.match('.uno:(.*)=')[1];
		var state = e.state.match('.*=(.*)')[1];
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
	}
});

L.Map.mergeOptions({
	buttonsControl: true
});

L.Map.addInitHook(function () {
	this.buttonsControl = new L.Control.Buttons();
	this.addControl(this.buttonsControl);
});

L.control.buttons = function (options) {
	return new L.Control.Buttons(options);
};
