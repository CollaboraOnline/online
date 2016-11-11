/*
 * L.Control.DocumentRepair.
 */

L.Control.DocumentRepair = L.Control.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._initLayout();

		return this._container;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseClick, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + _('Repair Document') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var table = L.DomUtil.create('table', '', content);
		var tbody = this._tbody = L.DomUtil.create('tbody', '', table);
		var tr = L.DomUtil.create('tr', '', tbody);
		var th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Type')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Index')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Comment')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('User name')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Timestamp')));

		var inputButton = document.createElement('input');
		inputButton.type = 'button';
		inputButton.value = _('Jump to state');
		L.DomEvent.on(inputButton, 'click', this._onJumpClick, this);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		content.appendChild(inputButton);
	},

	createAction: function (type, index, comment, viewId, dateTime) {
		var row = L.DomUtil.create('tr', '', this._tbody);
		var td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(type));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(index));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(comment));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(viewId));

		// Show relative date by default, absolute one as tooltip.
		td = L.DomUtil.create('td', '', row);
		var relativeDateTime = jQuery.timeago(dateTime.replace(/,.*/, 'Z'));
		var span = document.createElement('span');
		span.title = dateTime;
		span.appendChild(document.createTextNode(relativeDateTime));
		td.appendChild(span);

		L.DomEvent.on(row, 'click', this._onRowClick, this);
		L.DomEvent.on(row, 'dblclick', this._onJumpClick, this);
	},

	fillAction: function (actions, type) {
		for (var iterator = 0; iterator < actions.length; ++iterator) {
			// No user name if the user in question is already disconnected.
			var userName = actions[iterator].userName ? actions[iterator].userName : '';
			if (parseInt(actions[iterator].viewId) === this._map._docLayer._viewId) {
				userName = _('You');
			}
			this.createAction(type, actions[iterator].index, actions[iterator].comment, userName, actions[iterator].dateTime);
		}
	},

	fillActions: function (data) {
		this.fillAction(data.Redo.actions, 'Redo');
		this.fillAction(data.Undo.actions, 'Undo');
	},

	show: function () {
		this._tbody.setAttribute('style', 'max-height:' + this._map.getSize().y / 2 + 'px');
		this._container.style.visibility = '';
	},


	_selectRow: function (row) {
		if (this._selected) {
			L.DomUtil.removeClass(this._selected, 'leaflet-popup-selected');
		}

		this._selected = row;
		L.DomUtil.addClass(this._selected, 'leaflet-popup-selected');
	},

	_onCloseClick: function (e) {
		this._map.enable(true);
		this._refocusOnMap();
		this.remove();
	},

	_onRowClick: function (e) {
		if (e.currentTarget && this._selected !== e.currentTarget) {
			this._selectRow(e.currentTarget);
		}
	},

	_onJumpClick: function (e) {
		if (this._selected) {
			var action = this._selected.childNodes[0].innerHTML;
			var index = parseInt(this._selected.childNodes[1].innerHTML);
			var command = {
				Repair: {
					type: 'boolean',
					value: true
				}
			};
			command[action] = {
				type: 'unsigned short',
				value: index + 1
			};
			this._map.sendUnoCommand('.uno:' + action, command);
			this._onCloseClick();
		}
	}
});

L.control.documentRepair = function (options) {
	return new L.Control.DocumentRepair(options);
};
