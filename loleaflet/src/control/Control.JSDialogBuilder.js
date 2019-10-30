/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ _ */

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
	_menuItemHandlers: {},
	_colorPickers: [],

	_currentDepth: 0,

	_setup: function(options) {
		this._clearColorPickers();
		this.wizard = options.mobileWizard;
		this.map = options.map;
		this.callback = options.callback ? options.callback : this._defaultCallbackHandler;

		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['comboboxentry'] = this._comboboxEntry;
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['valueset'] = this._valuesetControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['grid'] = this._gridHandler;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['paneltabs'] = this._panelTabsHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._containerHandler;
		this._controlHandlers['toolitem'] = this._toolitemHandler;
		this._controlHandlers['colorsample'] = this._colorSampleControl;
		this._controlHandlers['divcontainer'] = this._divContainerHandler;

		this._controlHandlers['chartTypeSelector'] = this._chartTypeControl;

		this._controlHandlers['mainmenu'] = this._containerHandler;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._menuItemHandlers['inserttable'] = this._insertTableMenuItem;

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;

		this._currentDepth = 0;
	},

	_clearColorPickers: function() {
		this._colorPickers = [];
		L.ColorPicker.ID = 0;
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
		console.debug('control: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

		if (objectType == 'toolbutton' && eventType == 'click') {
			builder.map.sendUnoCommand(data);
		} else if (object) {
			var message = 'dialogevent ' + window.sidebarId + ' {\"id\":\"' + object.id + '\", \"cmd\": \"' + eventType + '\", \"data\":\"' + data + '\"}';
			builder.map._socket.sendMessage(message);
		}
	},

	_setupHandlers: function (controlElement, handlers) {
		if (handlers) {
			for (var i = 0; i < handlers.length; ++i) {
				var event = handlers[i].event;
				var handler = handlers[i].handler;
				if (!L.isEmpty(event) && handler) {
					if (event === 'click') {
						var eventData = {
							id: controlElement.id
						};
						$(controlElement).click(
							// avoid to access mutable variable (that is `i` dependent) in closure
							(function (lhandler, leventData) {
								return function() { lhandler(leventData) };
							})(handler, eventData)
						);
					}
				}
			}
		}
	},

	_cleanText: function(text) {
		if (!text)
			return '';
		return text.replace('~', '');
	},

	_cleanValueFromUnits: function(text) {
		if (!text)
			return '';
		return text.replace('″', '')
			.replace('%', '');
	},

	_containerHandler: function(parentContainer, data, builder) {
		if (data.enabled == 'false')
			return false;

		if (data.cols && data.rows) {
			return builder._gridHandler(parentContainer, data, builder);
		}

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

	_swapControls: function(controls, indexA, indexB) {
		var tmp = controls[indexA];
		controls[indexA] = controls[indexB];
		controls[indexB] = tmp;
	},

	/// reorder widgets in case of vertical placement of labels and corresponding controls
	/// current implementation fits for 2 column views
	_gridHandler: function(parentContainer, data, builder) {
		var children = data.children;
		if (children) {
			var count = children.length;
			for (var i = 0; i < count - 2; i++) {
				if (children[i].type == 'fixedtext' && children[i+1].type == 'fixedtext') {
					builder._swapControls(children, i+1, i+2);
				}
			}
		}

		return true;
	},

	_explorableEntry: function(parentContainer, title, contentNode, builder, valueNode, iconPath) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = '';
		if (iconPath) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			icon.src = iconPath;
			titleClass = 'menu-entry-with-icon'
		}
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);
		titleSpan.innerHTML = title;

		var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);
		if (valueNode) {
			var valueDiv = L.DomUtil.create('div', 'entry-value', rightDiv);
			valueDiv.appendChild(valueNode);
		}

		var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', rightDiv);
		arrowSpan.innerHTML = '>';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = title;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		if (builder.wizard) {
			$(sectionTitle).click(function() {
				builder.wizard.goLevelDown(contentDiv);
				if (contentNode.onshow)
					contentNode.onshow();
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_explorableMenu: function(parentContainer, title, children, builder, customContent) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		var titleSpan = L.DomUtil.create('span', 'sub-menu-title', sectionTitle);
		titleSpan.innerHTML = title;
		var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', sectionTitle);
		arrowSpan.innerHTML = '>';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = title;

		if (customContent) {
			contentDiv.appendChild(customContent);
		} else {
			builder._currentDepth++;
			for (var i = 0; i < children.length; i++) {
				builder.build(contentDiv, [children[i]]);
			}
			builder._currentDepth--;
		}

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
		var title = data.text;
		var contentNode = data.children[0];

		builder._explorableEntry(parentContainer, title, contentNode, builder);

		return false;
	},

	_panelTabsHandler: function(parentContainer, data, builder) {
		var tabsContainer = L.DomUtil.create('div', 'ui-tabs mobile-wizard ui-widget');
		var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content mobile-wizard ui-widget', parentContainer);

		var title1 = builder._cleanText(data[0].text);

		var tab1 = L.DomUtil.create('div', 'ui-tab mobile-wizard', tabsContainer);

		var label = L.DomUtil.create('span', 'ui-tab-content mobile-wizard unolabel', tab1);
		label.innerHTML = title1;

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', contentsContainer);
		contentDiv.title = title1;

		builder._currentDepth++;
		for (var i = 0; i < data[0].children.length; i++) {
			builder.build(contentDiv, [data[0].children[i]]);
		}
		builder._currentDepth--;

		$(contentDiv).hide();


		var tab2 = L.DomUtil.create('div', 'ui-tab mobile-wizard', tabsContainer);

		var title2 = builder._cleanText(data[1].text);

		var label2 = L.DomUtil.create('span', 'ui-tab-content mobile-wizard unolabel', tab2);
		label2.innerHTML = title2;

		var contentDiv2 = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', contentsContainer);
		contentDiv2.title = title2;

		builder._currentDepth++;
		for (i = 0; i < data[1].children.length; i++) {
			builder.build(contentDiv2, [data[1].children[i]]);
		}
		builder._currentDepth--;

		$(contentDiv2).hide();
		if (builder.wizard) {
			builder.wizard.setTabs(tabsContainer);

			$(tab1).click(function() {
				$(tab1).addClass('selected');
				$(tab2).removeClass('selected');
				$(contentDiv).show();
				$(contentDiv2).hide();
			});

			$(tab2).click(function() {
				$(tab2).addClass('selected');
				$(tab1).removeClass('selected');
				$(contentDiv).hide();
				$(contentDiv2).show();
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}

		$(tab1).click();
		builder.wizard.goLevelDown(contentDiv);

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
		var div = L.DomUtil.createWithId('div', data.id, parentContainer);

		var checkboxLabel = L.DomUtil.create('label', '', div);
		checkboxLabel.innerHTML = builder._cleanText(data.text);
		checkboxLabel.for = data.id;
		var checkbox = L.DomUtil.createWithId('input', data.id, div);
		checkbox.type = 'checkbox';

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

	_unitToVisibleString: function(unit) {
		if (unit == 'inch') {
			return _('\"');
		} else if (unit == 'percent') {
			return _('%');
		}

		return unit;
	},

	_spinfieldControl: function(parentContainer, data, builder, customCallback) {
		if (data.label) {
			var fixedTextData = { text: data.label };
			builder._fixedtextControl(parentContainer, fixedTextData, builder);
		}

		var div = L.DomUtil.create('div', 'spinfieldcontainer', parentContainer);
		div.id = data.id;

		var commandName = data.id ? data.id.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName)) {
			var image = L.DomUtil.create('img', 'spinfieldimage', div);
			var icon = builder._createIconPath(data.id);
			image.src = icon;
		}

		var spinfield = L.DomUtil.create('input', 'spinfield', div);
		spinfield.type = 'number';

		if (data.unit) {
			var unit = L.DomUtil.create('span', 'spinfieldunit', div);
			unit.innerHTML = builder._unitToVisibleString(data.unit);
		}

		var controlsContainer = L.DomUtil.create('div', 'sinfieldcontrols', div);
		var minus = L.DomUtil.create('div', 'minus', controlsContainer);
		minus.innerHTML = '-';
		var plus = L.DomUtil.create('div', 'plus', controlsContainer);
		plus.innerHTML = '+';

		if (data.min != undefined)
			$(spinfield).attr('min', data.min);

		if (data.max != undefined)
			$(spinfield).attr('max', data.max);

		if (data.enabled == 'false')
			$(spinfield).attr('disabled', 'disabled');

		if (data.text != undefined)
			$(spinfield).attr('value', builder._cleanValueFromUnits(data.text));
		else if (data.children && data.children.length)
			$(spinfield).attr('value', builder._cleanValueFromUnits(data.children[0].text));

		spinfield.addEventListener('change', function() {
			if (customCallback)
				customCallback();
			else
				builder.callback('spinfield', 'set', div, this.value, builder);
		});

		plus.addEventListener('click', function() {
			if (customCallback)
				customCallback('spinfield', 'plus', div, this.value, builder);
			else
				builder.callback('spinfield', 'plus', div, this.value, builder);
		});

		minus.addEventListener('click', function() {
			if (customCallback)
				customCallback('spinfield', 'minus', div, this.value, builder);
			else
				builder.callback('spinfield', 'minus', div, this.value, builder);
		});

		if (data.hidden)
			$(spinfield).hide();

		return false;
	},

	_editControl: function(parentContainer, data, builder) {
		var edit = L.DomUtil.create('input', '', parentContainer);
		edit.value = builder._cleanText(data.text);
		edit.id = data.id;

		if (data.enabled == 'false')
			$(edit).attr('disabled', 'disabled');

		edit.addEventListener('change', function() {
			builder.callback('edit', 'change', edit, this.value, builder);
		});

		if (data.hidden)
			$(edit).hide();

		return false;
	},

	_pushbuttonControl: function(parentContainer, data, builder, customCallback) {
		var pushbutton = L.DomUtil.create('button', '', parentContainer);
		pushbutton.innerHTML = builder._cleanText(data.text);
		pushbutton.id = data.id;

		if (data.enabled == 'false')
			$(pushbutton).attr('disabled', 'disabled');

		$(pushbutton).click(function () {
			if (customCallback)
				customCallback();
			else
				builder.callback('pushbutton', 'click', pushbutton, data.command, builder);
		});

		if (data.hidden)
			$(pushbutton).hide();

		return false;
	},

	_setIconAndNameForCombobox: function(data) {
		if (data.command == '.uno:CharFontName') {
			data.text = _('Font Name');
		} else if (data.command == '.uno:FontHeight') {
			data.text = _('Font Size');
		}
	},

	_comboboxControl: function(parentContainer, data, builder) {
		// TODO: event listener in the next level...

		if (!data.entries || data.entries.length === 0)
			return false;

		builder._setIconAndNameForCombobox(data);

		var title = data.text;
		var valueNode = null;
		if (data.selectedEntries) {
			if (title && title.length) {
				var value = data.entries[data.selectedEntries[0]];
				valueNode = L.DomUtil.create('div', '', null);
				valueNode.innerHTML = value;
			} else {
				title = data.entries[data.selectedEntries[0]];
			}
		}
		title = builder._cleanText(title);

		var entries = [];
		for (var index in data.entries) {
			var style = 'ui-combobox-text';
			if (index == data.selectedEntries[0]
				|| data.entries[index] == title) {
				style += ' selected';
			}

			var entry = { type: 'comboboxentry', text: data.entries[index], pos: index, parent: data, style: style };
			entries.push(entry);
		}

		var contentNode = {type: 'container', children: entries};

		var iconPath = null;
		if (data.command)
			iconPath = builder._createIconPath(data.command);

		builder._explorableEntry(parentContainer, title, contentNode, builder, valueNode, iconPath);

		return false;
	},

	_valuesetControl: function (parentContainer, data, builder) {
		var elem;
		var image;

		if (!data.entries || data.entries.length === 0) {
			return false;
		}

		for (var index in data.entries) {
			image = data.entries[index].image;
			image = image.substr(0, image.lastIndexOf('.'));
			image = image.substr(image.lastIndexOf('/') + 1);
			elem = L.DomUtil.create('div', 'layout ' + image +
				(data.entries[index].selected ? ' loleaflet-context-down' : ''), parentContainer);
			$(elem).data('id', data.entries[index].id);
			$(elem).click(function () {
				builder.callback('valueset', 'selected', { id: data.id }, $(this).data('id'), builder);
			});
		}

		return false;
	},

	_comboboxEntry: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('p', 'mobile-wizard', parentContainer);
		fixedtext.innerHTML = builder._cleanText(data.text);
		fixedtext.parent = data.parent;

		if (data.style && data.style.length)
			L.DomUtil.addClass(fixedtext, data.style);

		$(fixedtext).click(function () {
			builder.callback('combobox', 'selected', fixedtext.parent, data.pos + ';' + fixedtext.innerHTML, builder);
		});
	},

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('p', 'mobile-wizard', parentContainer);
		fixedtext.innerHTML = builder._cleanText(data.text);
		fixedtext.id = data.id;
		if (data.style && data.style.length) {
			L.DomUtil.addClass(fixedtext, data.style);
		} else {
			L.DomUtil.addClass(fixedtext, 'ui-text');
		}

		if (data.hidden)
			$(fixedtext).hide();

		return false;
	},

	_createIconPath: function(name) {
		if (!name)
			return '';

		var cleanName = name;
		var prefixLength = '.uno:'.length;
		if (name.substr(0, prefixLength) == '.uno:')
			cleanName = name.substr(prefixLength);
		return 'images/lc_' + cleanName.toLowerCase() + '.svg';
	},

	_unoToolButton: function(parentContainer, data, builder) {
		var button = null;

		var div = L.DomUtil.create('div', 'ui-content unospan', parentContainer);

		if (data.command) {
			var id = data.command.substr('.uno:'.length);
			div.id = id;

			var icon = builder._createIconPath(data.command);
			var buttonId = id + 'img';

			button = L.DomUtil.create('img', 'ui-content unobutton', div);
			button.src = icon;
			button.id = buttonId;

			var label = L.DomUtil.create('span', 'ui-content unolabel', div);
			label.for = buttonId;
			label.innerHTML = data.text;
		} else {
			button = L.DomUtil.create('label', 'ui-content unolabel', div);
			button.innerHTML = builder._cleanText(data.text);
		}

		$(button).click(function () {
			builder.callback('toolbutton', 'click', button, data.command, builder);
		});

		if (data.enabled == 'false')
			$(button).attr('disabled', 'disabled');

		return false;
	},

	_divContainerHandler: function (parentContainer, data, builder) {
		if (!(data.children && data.children.length))
			return false;

		var divElem = L.DomUtil.create('div', 'mobile-wizard', parentContainer);
		if (data.style && data.style.length)
			L.DomUtil.addClass(divElem, data.style);
		for (var i = 0; i < data.children.length; ++i) {
			var entry = data.children[i];
			var handle = builder._controlHandlers[entry.type];
			if (handle) {
				handle(divElem, entry, builder);
			}
		}
		builder._setupHandlers(divElem, data.handlers);
		return false;
	},

	_colorSampleControl: function (parentContainer, data, builder) {
		var sampleSizeClass = 'color-sample-small';
		if (data.size === 'big')
			sampleSizeClass = 'color-sample-big';
		var colorSample = L.DomUtil.create('div', 'mobile-wizard ' + sampleSizeClass, parentContainer);
		colorSample.id = data.id;
		colorSample.style.backgroundColor = data.color;
		colorSample.name = data.color.substring(1);

		if (data.size === 'big') {
			var selectionMarker = L.DomUtil.create('div', 'colors-container-tint-mark', colorSample);
			if (data.selected) {
				selectionMarker.style.visibility = 'visible';
			} else {
				selectionMarker.style.visibility = 'hidden';
			}
		} else if (data.selected && data.mark) {
			colorSample.appendChild(data.mark);
			L.DomUtil.addClass(colorSample, 'colors-container-selected-basic-color');
		}

		 builder._setupHandlers(colorSample, data.handlers);

		 return false;
	},

	_colorControl: function(parentContainer, data, builder) {
		var title = data.text;
		title = builder._cleanText(title);

		var selectedColor = L.ColorPicker.BASIC_COLORS[1];
		var valueNode =  L.DomUtil.create('div', 'color-sample-selected', null);
		valueNode.style.backgroundColor = selectedColor;

		var iconPath = builder._createIconPath(data.command);
		var noColorControl = data.command !== '.uno:FontColor';

		var callback = function(color) {
			var command = data.command + '?Color:string=' + color;
			console.log(command);
			builder.map.sendUnoCommand(command);
		};

		var colorPickerControl = new L.ColorPicker(
			valueNode,
			{
				selectedColor: selectedColor,
				noColorControl: noColorControl,
				selectionCallback: callback
			});
		builder._colorPickers.push(colorPickerControl);

		// color control panel
		var colorsContainer = colorPickerControl.getContainer();

		var contentNode = {type: 'container', children: [colorsContainer], onshow: L.bind(colorPickerControl.onShow, colorPickerControl)};

		builder._explorableEntry(parentContainer, title, contentNode, builder, valueNode, iconPath);
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

	_chartTypeControl: function(parentContainer, data, builder) {
		data.entries = [ 'Bar', 'Column', 'Pie', 'Area', 'Line' ];
		data.title = 'ChartType';
		builder._comboboxControl(parentContainer, data, builder);
	},

	_subMenuHandler: function(parentContainer, data, builder) {
		var title = data.text;
		builder._explorableMenu(parentContainer, title, data.children, builder);

		return false;
	},

	_menuItemHandler: function(parentContainer, data, builder) {
		var title = data.text;
		// separator
		if (title === '') {
			return false;
		}

		var id = data.id;
		if (id) {
			var handler = builder._menuItemHandlers[id];
			if (handler) {
				handler(parentContainer, data, builder);
				return;
			}
		}

		var menuEntry = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);

		var icon = null;
		var commandName = data.command ? data.command.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName)) {
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + commandName.toLowerCase(), menuEntry);
			var iconPath = 'images/lc_' + commandName.toLowerCase() + '.svg';
			icon = L.DomUtil.create('img', '', iconSpan);
			icon.src = iconPath;
		}
		var titleSpan = L.DomUtil.create('span', '', menuEntry);
		titleSpan.innerHTML = title;
		var paddingClass = icon ? 'menu-entry-with-icon' : 'menu-entry-no-icon';
		L.DomUtil.addClass(titleSpan, paddingClass);

		if (builder.wizard) {
			$(menuEntry).click(function() {
				if (data.executionType === 'action') {
					builder.map.menubar._executeAction(undefined, data.id);
				} else {
					builder.map.sendUnoCommand(data.command)
				}
				if (window.insertionMobileWizard)
					window.onClick(null, 'insertion_mobile_wizard');
				else if (window.mobileMenuWizard)
					$('#main-menu-state').click()
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}

		return false;
	},

	_insertTableMenuItem: function(parentContainer, data, builder) {
		var title = data.text;

		var content = L.DomUtil.create('div', 'inserttablecontrols');

		var rowsData = { min: 0, id: 'rows', text: '2', label: _('Rows') };
		var colsData = { min: 0, id: 'cols', text: '2', label: _('Columns') };

		var callbackFunction = function(objectType, eventType, object) {
			if (eventType == 'plus') {
				$(object).find('input').val(function(i, oldval) {
					return parseInt(oldval, 10) + 1;
				});
			} else if (eventType == 'minus') {
				$(object).find('input').val(function(i, oldval) {
					if (oldval > 0)
						return parseInt(oldval, 10) - 1;
					else
						return 0;
				});
			}
		};

		builder._spinfieldControl(content, rowsData, builder, callbackFunction);
		builder._spinfieldControl(content, colsData, builder, callbackFunction);

		var buttonData = { text: _('Insert table') };
		builder._pushbuttonControl(content, buttonData, builder, function() {
			var rowsCount = parseInt($('#rows > input.spinfield').get(0).value);
			var colsCount = parseInt($('#cols > input.spinfield').get(0).value);
			builder.map.sendUnoCommand('.uno:InsertTable?Columns=' + colsCount + '&Rows=' + rowsCount);
			builder.map.fire('closemobilewizard');
		});

		builder._explorableMenu(parentContainer, title, data.children, builder, content);
	},

	build: function(parent, data) {
		for (var childIndex in data) {
			var childData = data[childIndex];
			var childType = childData.type;
			var processChildren = true;
			var isPanelOrFrame = childType == 'panel' || childType == 'frame';

			var childObject = isPanelOrFrame ? L.DomUtil.create('div', '', parent) : parent;

			var handler = this._controlHandlers[childType];

			var twoPanelsAsChildren = childData.children
				&& (childData.children.length == 4 || childData.children.length == 5)
				&& childData.children[0] && childData.children[0].type == 'panel'
				&& childData.children[2] && childData.children[2].type == 'panel';

			if (twoPanelsAsChildren) {
				var tabsData = [childData.children[0], childData.children[2]];

				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, tabsData, this);
			} else {
				if (handler)
					processChildren = handler(childObject, childData, this);
				else
					console.warn('Unsupported control type: \"' + childType + '\"');

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children);
			}
		}
	}
});

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup(options);
	return builder;
};
