/*
 * L.Control.Presentation is used for common commands for slides.
 */

L.Control.Presentation = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var buttonsName = 'leaflet-control-presentation',
		    container = L.DomUtil.create('div', buttonsName + '-container' + ' leaflet-bar');

		this._buttons = {
			'insertpage':    {title: 'Insert Page',     iconName: 'insertpage.png'},
			'duplicatepage': {title: 'Duplicate Page',  iconName: 'duplicatepage.png'},
			'deletepage':    {title: 'Delete Page',     iconName: 'deletepage.png'}
		};

		for (var key in this._buttons) {
			var button = this._buttons[key];
			button.el = this._createButton(key, button.title, button.iconName,
				buttonsName, container, this._onButtonClick);
		}

		map.on('updateparts', this._updateDisabled, this);

		return container;
	},

	_updateDisabled: function (e) {
		if (e.docType === 'presentation') {
			return;
		}

		for (var key in this._buttons) {
			var button = this._buttons[key];
			L.DomUtil.addClass(button.el, 'leaflet-disabled');
			L.DomUtil.addClass(button.el, 'leaflet-control-buttons-disabled');
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
			this._map.deletePage();
		}
	}
});

L.control.presentation = function (options) {
	return new L.Control.Presentation(options);
};
