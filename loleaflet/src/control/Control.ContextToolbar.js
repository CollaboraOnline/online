/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ContextToolbar.
 */
/* global _UNO */

L.Control.ContextToolbar = L.Control.extend({
	options: {
		position: 'topleft',
	},

	statics: {
		TOOLBARS: {
			'TEXT_CURSOR_TOOLBAR': ['Paste'],
			'TEXT_SELECTION_TOOLBAR': ['Cut', 'Copy', 'Paste']
		}
	},

	initialize: function (options) {
		L.setOptions(this, options);

	},

	onAdd: function () {
		// console.log('==> ContextToolbar.onAdd');
		if (!this._container) {
			this._initLayout();
		}
		this.hide();
		return this._container;
	},

	onRemove: function () {
		if (this._bar)
			// remove all previous entries
			L.DomUtil.empty(this._bar);
		this.hide();
		this._latlng = null;
		// console.log('==> ContextToolbar.onRemove');
	},

	isInitialized: function () {
		return 	!!this._bar.firstChild;
	},

	isVisible: function () {
		return 	this._container && this._container.style.visibility === '';
	},

	hide: function () {
		this._container.style.visibility = 'hidden';
	},

	show: function () {
		this._container.style.visibility = '';
	},

	_createEntry: function (platform, command, noText, pos) {
		if (!command || command.length === 0)
			return;

		var tagTd = 'td';
		var entryTag = command.toLowerCase();
		var platformFragment = (platform && platform.length) ? '-' + platform + '-' : '';
		pos = (pos && pos.length) ? pos : 'middle';
		var flagEntryClass = 'loleaflet-context-' + entryTag; // this class is used only for retrieving the command type
		var genericButtonClass = 'loleaflet' + platformFragment + 'context-button';
		var specificButtonClass = 'loleaflet' + platformFragment + 'context-' + entryTag + '-button';
		var posEntryClass = 'loleaflet' + platformFragment + 'context-' + pos + '-entry';
		var classList = flagEntryClass + ' ' + genericButtonClass + ' ' + specificButtonClass + ' ' + posEntryClass;
		var entry = L.DomUtil.create(tagTd, classList, this._bar);
		if (!noText) {
			// get locale name for the command
			entry.innerHTML = _UNO('.uno:' + command);
		}
		var stopEvents = 'touchstart touchmove touchend mousedown mousemove mouseout mouseover mouseup mousewheel click scroll';

		L.DomEvent.on(entry, stopEvents,  L.DomEvent.stopPropagation)
			.on(entry, 'mousedown', this.onMouseDown, this)
			.on(entry, 'mouseup', this.onMouseUp, this);

		return entry;
	},

	_entryIs: function(name, entry) {
		var flagEntryClass = 'loleaflet-context-' + name;
		return L.DomUtil.hasClass(entry, flagEntryClass);
	},

	_initLayout: function () {
		// create an empty toolbar, it will be populated with command entries later
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp)
			this._container = L.DomUtil.create('div', 'loleaflet-ios-context-toolbar');
		else
			this._container = L.DomUtil.create('div', 'loleaflet-context-toolbar');

		var container;
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp)
			container = L.DomUtil.create('table', 'loleaflet-ios-context-table', this._container);
		else
			container = L.DomUtil.create('table', 'loleaflet-context-table', this._container);

		var tbody = L.DomUtil.create('tbody', '', container);
		this._bar = L.DomUtil.create('tr', '', tbody);
	},

	onAdded: function () {
		this.show();
	},

	setEntries: function(commands) {
		if (!this._bar)
			return;

		// commands is the name of a predefined toolbar ?
		if (typeof commands === 'string') {
			commands = L.Control.ContextToolbar.TOOLBARS[commands];
			if (!commands)
				return;
		}

		// remove all previous entries
		L.DomUtil.empty(this._bar);

		// check commands validity
		var validCommands = [];
		if (this._map && this._map._docLayer._internalCacheEmpty) {
			for (var k = 0; k < commands.length; ++k) {
				var cmd = commands[k];
				if (cmd === 'Paste')
					continue;
				validCommands.push(cmd);
			}
		} else {
			validCommands = commands;
		}
		if (!validCommands.length)
			return;

		var tagTd = 'td';
		var platform = '';
		var noText = true;
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			platform = 'ios';
			noText = false;
			this._leftroundedend = L.DomUtil.create(tagTd, 'loleaflet-ios-context-button loleaflet-ios-context-left', this._bar);
		}

		for (var i = 0; i < validCommands.length; ++i) {
			var command = validCommands[i];
			var pos;
			if (i === validCommands.length - 1)
				pos = 'last';
			else if (i === 0)
				pos = 'first';
			else
				pos = 'middle';
			this._createEntry(platform, command, noText, pos);
		}

		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			this._rightroundedend = L.DomUtil.create(tagTd, 'loleaflet-ios-context-button loleaflet-ios-context-right', this._bar);
		}
	},

	setPosition: function (latlng) {
		// hint: the toolbar should be populated earlier than set up the position
		if (this._map && this._bar && this.isInitialized() && latlng) {
			this._latlng = latlng;
			var pos = this._map.project(latlng);
			var maxBounds = this._map.getPixelBounds();
			var size = L.point(this._container.clientWidth,this._container.clientHeight);
			pos._add(L.point(-size.x / 2, -5 * size.y / 4));
			var bounds = new L.Bounds(pos, pos.add(size));
			if (!maxBounds.contains(bounds)) {
				var offset = L.point(0, 0);
				if (bounds.max.x > maxBounds.max.x) {
					offset.x = bounds.max.x - maxBounds.max.x;
				}
				if (bounds.max.y > maxBounds.max.y) {
					offset.y = bounds.max.y - maxBounds.max.y;
				}
				pos._subtract(offset);
				if (bounds.min.x < maxBounds.min.x) {
					offset.x = maxBounds.min.x - bounds.min.x;
				}
				if (bounds.min.y < maxBounds.min.y) {
					offset.y = maxBounds.min.y - bounds.min.y;
				}
				pos._add(offset);
			}
			var containerPoint = this._map.latLngToContainerPoint(this._map.unproject(pos));
			L.DomUtil.setPosition(this._container, containerPoint);
			this.show();
		}
	},

	onMouseDown: function (e) {
		L.DomUtil.addClass(e.target || e.srcElement, 'loleaflet-context-down');
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	onMouseUp: function (e) {
		var target = e.target || e.srcElement;
		if (this._entryIs('cut', target)) {
			this._map._socket.sendMessage('uno .uno:Cut');
			this._map._docLayer._internalCacheEmpty = false;
		}
		else if (this._entryIs('copy', target)) {
			this._map._socket.sendMessage('uno .uno:Copy');
			this._map._docLayer._internalCacheEmpty = false;
		}
		else if (this._entryIs('paste', target)) {
			this._map._socket.sendMessage('uno .uno:Paste');
		}

		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
		setTimeout(L.bind(this.onClick, this, target), 0);
	},

	onClick: function (e) {
		L.DomUtil.removeClass(e, 'loleaflet-context-down');
		this.remove();
	}
});

L.control.contextToolbar = function (options) {
	return new L.Control.ContextToolbar(options);
};
