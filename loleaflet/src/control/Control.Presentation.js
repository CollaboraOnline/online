/*
 * L.Control.Presentation is used for common commands for slides.
 */

/* global vex */
L.Control.Presentation = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var buttonsName = 'leaflet-control-presentation',
		    container = L.DomUtil.create('div', buttonsName + '-container' + ' leaflet-bar');

		this._buttons = {
			'insertpage':    {title: 'Insert Page',     uno: 'InsertPage',		iconName: 'insertpage.png'},
			'duplicatepage': {title: 'Duplicate Page',  uno: 'DuplicatePage',	iconName: 'duplicatepage.png'},
			'deletepage':    {title: 'Delete Page',     uno: 'DeletePage',		iconName: 'deletepage.png'}
		};

		for (var key in this._buttons) {
			var button = this._buttons[key];
			button.el = this._createButton(key, button.title, button.iconName,
				buttonsName, container, this._onButtonClick);
		}

		map.on('commandstatechanged', this._onStateChange, this);
		map.on('updatepermission', this._onPermissionUpdate, this);

		return container;
	},

	_onPermissionUpdate: function (e) {
		for (var id in this._buttons) {
			var button = this._buttons[id];
			if (button.uno) {
				if (e.perm !== 'edit' || this._map.getDocType() !== 'presentation') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
			}
		}
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
		if (L.DomUtil.hasClass(e.target.parentNode, 'leaflet-disabled')) {
			return;
		}
		var id = e.target.id;

		if (id === 'insertpage') {
			this._map.insertPage();
		}
		else if (id === 'duplicatepage') {
			this._map.duplicatePage();
		}
		else if (id === 'deletepage') {
			vex.dialog.confirm({
				message: 'Are you sure you want to delete this page?',
				callback: L.bind(this._onDelete, this)
			});
		}
	},

	_onStateChange: function (e) {
		var commandName = e.commandName;
		var enabled = e.state;
		for (var key in this._buttons) {
			var button = this._buttons[key];
			if ('.uno:' + button.uno === commandName) {
				if (enabled === 'true' && this._map._docLayer._permission === 'edit') {
					L.DomUtil.removeClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
				else if (enabled === 'false') {
					L.DomUtil.addClass(button.el.firstChild, 'leaflet-control-buttons-disabled');
				}
			}
		}
	},

	_onDelete: function (e) {
		if (e !== false) {
			this._map.deletePage();
		}
	}
});

L.control.presentation = function (options) {
	return new L.Control.Presentation(options);
};
