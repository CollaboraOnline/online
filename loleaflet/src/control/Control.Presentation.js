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
			'insertpage':    {title: 'Insert Page',          uno: 'InsertPage',        iconName: 'insertpage.png'},
			'duplicatepage': {title: 'Duplicate Page',       uno: 'DuplicatePage',     iconName: 'duplicatepage.png'},
			'deletepage':    {title: 'Delete Page',          uno: 'DeletePage',        iconName: 'deletepage.png'}
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
		var button = this._buttons[id];
		var docLayer = this._map._docLayer;

		// TO DO: Deleting all the pages causes problem.
		if (id === 'deletepage' && docLayer._parts === 1) {
			return;
		}

		if (button.uno) {
			L.Socket.sendMessage('uno .uno:' + button.uno);
		}

		// TO DO: We should fire these events after server response
		// Unfortunately server does not send any response.
		if (id === 'insertpage' || id === 'duplicatepage') {
			this._map.fire('insertpage', {
				selectedPart: docLayer._selectedPart,
				parts: 		  docLayer._parts
			});

			docLayer._parts++;
			this._map.setPart('next');
		}
		else if (id === 'deletepage') {
			this._map.fire('deletepage', {
				selectedPart: docLayer._selectedPart,
				parts: 		  docLayer._parts
			});

			docLayer._parts--;
			if (docLayer._selectedPart >= docLayer._parts) {
				docLayer._selectedPart--;
			}

			this._map.setPart(docLayer._selectedPart);
		}
	}
});

L.control.presentation = function (options) {
	return new L.Control.Presentation(options);
};
