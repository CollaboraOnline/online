/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ w2ui */
L.Control.JSDialogBuilder = L.Control.extend({

	/* Handler is a function which takes three parameters:
	 * parentContainer - place where insert the content
	 * data - data of a control under process
	 * builder - current builder reference
	 *
	 * returns boolean: true if children should be processed
	 * and false otherwise
	 */
	_controlHandlers: {},
	_toolitemHandlers: {},

	_currentDepth: 0,

	_setup: function(options) {
		this.wizard = options.mobileWizard;
		this.map = options.map;
		this.callback = options.callback ? options.callback : this._defaultCallbackHandler;

		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['grid'] = this._containerHandler;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._containerHandler;
		this._controlHandlers['toolitem'] = this._toolitemHandler;

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:CharFontName'] = this._fontNameControl;
		this._toolitemHandlers['.uno:FontHeight'] = this._fontHeightControl;

		this._currentDepth = 0;
	},

	_toolitemHandler: function(parentContainer, data, builder) {
		if (data.command) {
			var handler = builder._toolitemHandlers[data.command];

			if (handler)
				handler(parentContainer, data, builder);
			else if (data.text) {
				builder._unoToolButton(parentContainer, data, builder);
			} else
				console.warn('Unsupported toolitem type: \"' + data.command + '\"');
		}

		return false;
	},

	// by default send new state to the core
	_defaultCallbackHandler: function(objectType, eventType, object, data, builder) {
		console.debug('control: \'' + objectType + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

		if (objectType == 'toolbutton' && eventType == 'click') {
			builder.map.sendUnoCommand(data);
		}
	},

	_cleanText: function(text) {
		return text.replace('~', '');
	},

	_containerHandler: function() {
		return true;
	},

	_ignoreHandler: function() {
		return false;
	},

	_getGridColumns: function(children) {
		var columns = 0;
		for (var index in children) {
			if (parseInt(children[index].left) > columns)
				columns = parseInt(children[index].left);
		}
		return columns + 1;
	},

	_getGridRows: function(children) {
		var rows = 0;
		for (var index in children) {
			if (parseInt(children[index].top) > rows)
				rows = parseInt(children[index].top);
		}
		return rows + 1;
	},

	_getGridChild: function(children, row, col) {
		for (var index in children) {
			if (parseInt(children[index].top) == row
				&& parseInt(children[index].left) == col)
				return children[index];
		}
		return null;
	},

	_gridHandler: function(parentContainer, data, builder) {
		var columns = builder._getGridColumns(data.children);
		var rows = builder._getGridRows(data.children);
		var index = 0;

		var table = L.DomUtil.create('table', '', parentContainer);
		for (var row = 0; row < rows; row++) {
			var tr = L.DomUtil.create('tr', '', table);
			for (var col = 0; col < columns; col++) {
				var td = L.DomUtil.create('td', '', tr);
				var child = builder._getGridChild(data.children, row, col);

				if (child) {
					var childObject = null;
					if (child.type == 'container')
						childObject = L.DomUtil.create('table', '', td);
					else
						childObject = td;

					builder.build(childObject, [child], data.type);
					index++;
				}

				if (index > data.children.length) {
					console.warn('index > data.children.length');
					return false;
				}
			}
		}

		return false;
	},

	_explorableEntry: function(parentContainer, title, contentNode, builder) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		sectionTitle.innerHTML = title;

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = title;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		if (builder.wizard) {
			$(sectionTitle).click(function() { builder.wizard.goLevelDown(contentDiv); });
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_frameHandler: function(parentContainer, data, builder) {
		var title = builder._cleanText(data.children[0].text);
		var contentNode = data.children[1];

		builder._explorableEntry(parentContainer, title, contentNode, builder);

		return false;
	},

	_panelHandler: function(parentContainer, data, builder) {
		var title = data.children[0].id;
		var contentNode = data.children[0];

		builder._explorableEntry(parentContainer, title, contentNode, builder);

		return false;
	},

	_radiobuttonControl: function(parentContainer, data, builder) {
		var radiobutton = L.DomUtil.createWithId('input', data.id, parentContainer);
		radiobutton.type = 'radio';

		var radiobuttonLabel = L.DomUtil.create('label', '', parentContainer);
		radiobuttonLabel.innerHTML = builder._cleanText(data.text);
		radiobuttonLabel.for = data.id;

		if (data.enabled == 'false')
			$(radiobutton).attr('disabled', 'disabled');

		if (data.checked == 'true')
			$(radiobutton).attr('checked', 'checked');

		radiobutton.addEventListener('change', function() {
			builder.callback('radiobutton', 'change', radiobutton, this.checked, builder);
		});

		if (data.hidden)
			$(radiobutton).hide();

		return false;
	},

	_checkboxControl: function(parentContainer, data, builder) {
		var checkbox = L.DomUtil.createWithId('input', data.id, parentContainer);
		checkbox.type = 'checkbox';
		var checkboxLabel = L.DomUtil.create('label', '', parentContainer);
		checkboxLabel.innerHTML = builder._cleanText(data.text);
		checkboxLabel.for = data.id;

		if (data.enabled == 'false')
			$(checkbox).attr('disabled', 'disabled');

		if (data.checked == 'true')
			$(checkbox).attr('checked', 'checked');

		checkbox.addEventListener('change', function() {
			builder.callback('checkbox', 'change', checkbox, this.checked, builder);
		});

		if (data.hidden)
			$(checkbox).hide();

		return false;
	},

	_spinfieldControl: function(parentContainer, data, builder) {
		var spinfield = L.DomUtil.create('input', '', parentContainer);
		spinfield.type = 'number';

		if (data.enabled == 'false')
			$(spinfield).attr('disabled', 'disabled');

		if (data.children && data.children.length) {
			// TODO: units
			$(spinfield).attr('value', data.children[0].text.replace('%', ''));
		}

		spinfield.addEventListener('change', function() {
			builder.callback('spinfield', 'change', spinfield, this.value, builder);
		});

		if (data.hidden)
			$(spinfield).hide();

		return false;
	},

	_editControl: function(parentContainer, data, builder) {
		var edit = L.DomUtil.create('input', '', parentContainer);
		edit.value = builder._cleanText(data.text);

		if (data.enabled == 'false')
			$(edit).attr('disabled', 'disabled');

		edit.addEventListener('change', function() {
			builder.callback('edit', 'change', edit, this.value, builder);
		});

		if (data.hidden)
			$(edit).hide();

		return false;
	},

	_pushbuttonControl: function(parentContainer, data, builder) {
		var pushbutton = L.DomUtil.create('button', '', parentContainer);
		pushbutton.innerHTML = builder._cleanText(data.text);

		if (data.enabled == 'false')
			$(pushbutton).attr('disabled', 'disabled');

		$(pushbutton).click(function () {
			builder.callback('pushbutton', 'click', pushbutton, data.command, builder);
		});

		if (data.hidden)
			$(pushbutton).hide();

		return false;
	},

	_comboboxControl: function(parentContainer, data, builder) {
		if (!data.entries || data.entries.length == 0)
			return false;

		var listbox = L.DomUtil.create('select', '', parentContainer);
		listbox.value = builder._cleanText(data.text);

		if (data.enabled == 'false')
			$(listbox).attr('disabled', 'disabled');

		var selected = null;
		if (parseInt(data.selectedCount) > 0) {
			// TODO: multiselection listbox
			selected = data.selectedEntries[0];
		}

		for (var index in data.entries) {
			var option = L.DomUtil.create('option', '', listbox);
			option.innerHTML = data.entries[index];

			if (selected == index)
				$(option).attr('selected', 'selected');
		}

		if (data.hidden)
			$(listbox).hide();

		listbox.addEventListener('change', function() {
			builder.callback('combobox', 'change', listbox, this.value, builder);
		});

		return false;
	},

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('p', '', parentContainer);
		fixedtext.innerHTML = builder._cleanText(data.text);

		if (data.hidden)
			$(fixedtext).hide();

		return false;
	},

	_createIconPathFronUnoCommand: function(command) {
		var commandName = command.substring('.uno:'.length);
		return 'images/lc_' + commandName.toLowerCase() + '.svg';
	},

	_unoToolButton: function(parentContainer, data, builder) {
		var button = null;

		var span = L.DomUtil.create('span', 'ui-content unospan', parentContainer);

		if (data.command) {
			var id = data.command.substr('.uno:'.length);
			var icon = builder._createIconPathFronUnoCommand(data.command);

			button = L.DomUtil.create('img', 'ui-content unobutton', span);
			$(button).css('background', 'url(' + icon + ')');
			button.id = id;

			var label = L.DomUtil.create('label', 'ui-content unolabel', span);
			label.for = id;
			label.innerHTML = data.text;
		} else {
			button = L.DomUtil.create('label', 'ui-content unolabel', span);
			button.innerHTML = builder._cleanText(data.text);
		}

		$(button).click(function () {
			builder.callback('toolbutton', 'click', button, data.command, builder);
		});

		if (data.enabled == 'false')
			$(button).attr('disabled', 'disabled');

		return false;
	},

	_colorControl: function(parentContainer, data) {
		var colorContainer = L.DomUtil.create('div', '', parentContainer);

		if (data.enabled == 'false')
			$(colorContainer).attr('disabled', 'disabled');

		var toolbar = $(colorContainer);
		var items = [{type: 'color',  id: 'color'}];
		toolbar.w2toolbar({
			name: 'colorselector',
			tooltip: 'bottom',
			items: items
		});
		w2ui['colorselector'].set('color', {color: '#ff0033'});

		return false;
	},

	_lineWidthControl: function(parentContainer, data, builder) {
		data.children = [ { text: '0.5' },
							{ text: '0.8' },
							{ text: '1.0' },
							{ text: '1.5' },
							{ text: '2.3' },
							{ text: '3.0' },
							{ text: '4.5' },
							{ text: '6.0' } ];
		builder._spinfieldControl(parentContainer, data, builder);
	},

	_fontNameControl: function(parentContainer, data, builder) {
		data.entries = [ 'Liberation Sans' ];
		builder._comboboxControl(parentContainer, data, builder);
	},

	_fontHeightControl: function(parentContainer, data, builder) {
		data.entries = [ '8', '10', '11', '12', '14', '16', '24', '32', '48' ];
		builder._comboboxControl(parentContainer, data, builder);
	},

	build: function(parent, data) {
		var currentInsertPlace = parent;
		var currentHorizontalRow = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			var childType = childData.type;
			var processChildren = true;

			currentHorizontalRow = L.DomUtil.create('tr', '', parent);
			currentInsertPlace = L.DomUtil.create('td', '', currentHorizontalRow);

			var childIsContainer = (childType == 'container' || childType == 'borderwindow'
				|| childType == 'grid' || childType == 'toolbox') && childData.children.length > 1;

			var childObject = null;
			if (childType != 'borderwindow' && childIsContainer)
				childObject = L.DomUtil.create('table', '', currentInsertPlace);
			else {
				childObject = currentInsertPlace;
			}

			var handler = this._controlHandlers[childType];

			if (handler)
				processChildren = handler(childObject, childData, this);
			else
				console.warn('Unsupported control type: \"' + childType + '\"');

			if (processChildren && childData.children != undefined)
				this.build(childObject, childData.children);
		}
	}
});

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup(options);
	return builder;
};
