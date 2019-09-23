/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ */
L.Control.JSDialogBuilder = L.Control.extend({

	_controlHandlers: {},

	_setup: function() {
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._ignoreHandler;
	},

	_containerHandler: function() {
		return true;
	},

	_ignoreHandler: function() {
		return false;
	},

	_radiobuttonControl: function(parentContainer, data) {
		var radiobutton = L.DomUtil.create('input', '', parentContainer);
		radiobutton.type = 'radiobutton';
		radiobutton.value = data.text;

		return false;
	},

	_checkboxControl: function(parentContainer, data) {
		var checkbox = L.DomUtil.createWithId('input', data.id, parentContainer);
		checkbox.type = 'checkbox';
		var checkboxLabel = L.DomUtil.create('label', '', parentContainer);
		checkboxLabel.innerHTML = data.text;
		checkboxLabel.for = data.id;

		return false;
	},

	_spinfieldControl: function(parentContainer, data) {
		var spinfield = L.DomUtil.create('input', '', parentContainer);
		spinfield.type = 'number';
		spinfield.value = data.text;

		return false;
	},

	_editControl: function(parentContainer, data) {
		var edit = L.DomUtil.create('input', '', parentContainer);
		edit.value = data.text;

		return false;
	},

	_pushbuttonControl: function(parentContainer, data) {
		var pushbutton = L.DomUtil.create('button', '', parentContainer);
		pushbutton.innerHTML = data.text;

		return false;
	},

	_comboboxControl: function(parentContainer, data) {
		var listbox = L.DomUtil.create('select', '', parentContainer);
		listbox.value = data.text;

		return false;
	},

	_fixedtextControl: function(parentContainer, data) {
		var fixedtext = L.DomUtil.create('p', '', parentContainer);
		fixedtext.innerHTML = data.text;

		return false;
	},

	build: function(parent, data, currentIsContainer, currentIsVertival, columns) {
		var currentInsertPlace = parent;
		var currentHorizontalRow = parent;

		if (currentIsContainer && !currentIsVertival)
			currentHorizontalRow = L.DomUtil.create('tr', '', parent);

		for (var childIndex in data) {
			var childData = data[childIndex];
			var childType = childData.type;
			var childIsEnabled = childData.enabled;
			var processChildren = true;

			if (childIsEnabled === false)
				continue;

			if (currentIsContainer) {
				var horizontalOverflow = (childIndex > 0 && columns && (childIndex % columns == 0));
				var newRow = currentIsVertival || horizontalOverflow;
				if (newRow) {
					currentHorizontalRow = L.DomUtil.create('tr', '', parent);
					currentInsertPlace = L.DomUtil.create('td', '', currentHorizontalRow);
				} else
					currentInsertPlace = L.DomUtil.create('td', '', currentHorizontalRow);
			}

			var childIsContainer = (childType == 'container' || childType == 'borderwindow');
			var childIsVertical = childData.vertical === true;
			var childColumns = childData.cols;

			var childObject = null;
			if (childIsContainer && childType != 'borderwindow')
				childObject = L.DomUtil.create('table', '', currentInsertPlace);
			else
				childObject = currentInsertPlace;

			$(childObject).css('border-style', 'solid');
			$(childObject).css('border-width', '1px');
			$(childObject).css('border-color', 'black');

			var handler = this._controlHandlers[childType];

			if (handler)
				processChildren = handler(childObject, childData);
			else
				console.warn('Unsupported control type: \"' + childType + '\"');

			if (processChildren && childData.children != undefined)
				this.build(childObject, childData.children, childIsContainer, childIsVertical, childColumns);
		}
	}
});

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup();
	return builder;
};
