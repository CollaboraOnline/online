/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ _ _UNO */

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
		this._controlHandlers['htmlcontrol'] = this._htmlControl;
		this._controlHandlers['grid'] = this._gridHandler;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['calcfuncpanel'] = this._calcFuncListPanelHandler;
		this._controlHandlers['paneltabs'] = this._panelTabsHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._toolboxHandler;
		this._controlHandlers['toolitem'] = this._toolitemHandler;
		this._controlHandlers['colorsample'] = this._colorSampleControl;
		this._controlHandlers['divcontainer'] = this._divContainerHandler;
		this._controlHandlers['colorlistbox'] = this._colorControl;
		this._controlHandlers['borderstyle'] = this._borderControl;

		this._controlHandlers['mainmenu'] = this._containerHandler;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._menuItemHandlers['inserttable'] = this._insertTableMenuItem;

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:CharBackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;
		this._toolitemHandlers['.uno:ResetAttributes'] = this._clearFormattingControl;

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

		builder.wizard.setCurrentScrollPosition();

		if (objectType == 'toolbutton' && eventType == 'click') {
			builder.map.sendUnoCommand(data);
		} else if (object) {
			data = typeof data === 'string' ? data.replace('"', '\\"') : data;
			var message = 'dialogevent ' + (window.sidebarId !== undefined ? window.sidebarId : -1) +
			    ' {\"id\":\"' + object.id + '\", \"cmd\": \"' + eventType + '\", \"data\":\"' + data + '\"}';
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
								return function() { lhandler(leventData); };
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

		return text.replace(/[^\d.-]/g, '').trim();
	},

	_gradientStyleToLabel: function(state) {
		switch (state) {
		case 'NONE':
			return _('None');

		case 'SOLID':
			return _('Solid');

		case 'LINEAR':
			return _('Linear');

		case 'AXIAL':
			return _('Axial');

		case 'RADIAL':
			return _('Radial');

		case 'ELLIPTICAL':
			return _('Ellipsoid');

		// no, not a typo (square - quadratic, rect - square) - same as in the core
		case 'SQUARE':
			return _('Quadratic');

		case 'RECT':
			return _('Square');

		case 'MAKE_FIXED_SIZE':
			return _('Fixed size');
		}

		return '';
	},

	_containerHandler: function(parentContainer, data, builder) {
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

	_explorableEntry: function(parentContainer, data, contentNode, builder, valueNode, iconPath, updateCallback) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');
		if (data && data.id)
			sectionTitle.id = data.id;

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = '';
		console.debug('sectionTitle.id' + sectionTitle.id);
		if (sectionTitle.id === 'paperformat' || sectionTitle.id === 'orientation' || sectionTitle.id === 'masterslide' || sectionTitle.id === 'SdTableDesignPanel')
			iconPath = 'images/lc_'+ sectionTitle.id.toLowerCase() +'.svg';
		if (iconPath) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			icon.src = iconPath;
			icon.alt = '';
			titleClass = 'menu-entry-with-icon';
		}
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);

		var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);
		if (valueNode) {
			var valueDiv = L.DomUtil.create('div', 'entry-value', rightDiv);
			valueDiv.appendChild(valueNode);
		}

		var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', rightDiv);
		arrowSpan.innerHTML = '>';

		var updateFunction = function(titleSpan) {
			var state = null;
			if (data.id)
				state = builder._getUnoStateForItemId(data.id, builder);

			if (state) {
				titleSpan.innerHTML = state;
			} else {
				titleSpan.innerHTML = data.text;
			}
		};

		updateCallback ? updateCallback(titleSpan) : updateFunction(titleSpan);

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === data.command || e.commandName === builder._mapWindowIdToUnoCommand(data.id))
				if (updateCallback)
					updateCallback(titleSpan);
				else
					updateFunction(titleSpan);
		}, this);

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = data.text;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		if (!data.nosubmenu)
		{
			$(contentDiv).hide();
			if (builder.wizard) {
				$(sectionTitle).click(function(event, data) {
					builder.wizard.goLevelDown(contentDiv, data);
					if (contentNode.onshow)
						contentNode.onshow();
				});
			} else {
				console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}
		else
			$(sectionTitle).hide();
	},

	_calcFunctionEntry: function(parentContainer, data, contentNode, builder) {
		var sectionTitle = L.DomUtil.create('div', 'func-entry ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');
		if (data && data.id)
			sectionTitle.id = data.id;

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = 'func-name';
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);
		titleSpan.innerHTML = data.text;

		var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);
		var arrowSpan = L.DomUtil.create('div', 'func-info-icon', rightDiv);
		arrowSpan.innerHTML = '';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = data.text;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		if (builder.wizard) {
			var that = this;
			$(rightDiv).click(function() {
				builder.wizard.goLevelDown(contentDiv);
				if (contentNode.onshow)
					contentNode.onshow();
			});
			$(leftDiv).click(function() {
				that.map._socket.sendMessage('completefunction index=' + data.index);
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_generateMenuIconName: function(commandName) {
		// command has no parameter
		if (commandName.indexOf('?') === -1)
			return commandName.toLowerCase();

		if (commandName.indexOf('SpellCheckIgnoreAll') !== -1)
			return 'spellcheckignoreall';
		if (commandName.indexOf('SpellCheckIgnore') !== -1)
			return 'spellcheckignore';
		if (commandName === 'LanguageStatus?Language:string=Current_LANGUAGE_NONE')
			return 'selectionlanugagenone';
		if (commandName === 'LanguageStatus?Language:string=Current_RESET_LANGUAGES')
			return 'selectionlanugagedefault';
		if (commandName === 'LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE')
			return 'paragraphlanugagenone';
		if (commandName === 'LanguageStatus?Language:string=Paragraph_RESET_LANGUAGES')
			return 'paragraphlanugagedefault';
		if ((this.map.getDocType() === 'spreadsheet' || this.map.getDocType() === 'presentation') &&
            commandName.indexOf('LanguageStatus?Language:string=Paragraph_') !== -1)
			return 'paragraphlanugagesuggestion';
		if ((this.map.getDocType() === 'spreadsheet' || this.map.getDocType() === 'presentation') &&
            commandName.indexOf('LanguageStatus?Language:string=Current_') !== -1)
			return 'selectionlanugagesuggestion';
		return commandName.toLowerCase();
	},

	_explorableMenu: function(parentContainer, title, children, builder, customContent, dataid) {
		dataid = dataid || 0;
		var icon = null;
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		var commandName = dataid;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, sectionTitle);
			var iconPath = 'images/lc_' + iconName + '.svg';
			icon = L.DomUtil.create('img', '', iconSpan);
			icon.src = iconPath;
			icon.alt = '';
			icon.addEventListener('error', function() {
				icon.style.display = 'none';
			});

			var titleSpan2 = L.DomUtil.create('span', 'menu-entry-with-icon flex-fullwidth', sectionTitle);
			titleSpan2.innerHTML = title;
		}
		else {
			var titleSpan = L.DomUtil.create('span', 'sub-menu-title', sectionTitle);
			titleSpan.innerHTML = title;
		}
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
		data.text = builder._cleanText(data.children[0].text);
		var contentNode = data.children[1];

		builder._explorableEntry(parentContainer, data, contentNode, builder);

		return false;
	},

	_panelHandler: function(parentContainer, data, builder) {
		var contentNode = data.children[0];

		var entryId = contentNode.id;
		var iconPath = null;

		if (entryId && entryId.length) {
			iconPath = builder._createIconPath(entryId);
		}

		builder._explorableEntry(parentContainer, data, contentNode, builder, null, iconPath);

		return false;
	},

	_calcFuncListPanelHandler: function(parentContainer, data, builder) {
		var contentNode = data.children[0];

		builder._calcFunctionEntry(parentContainer, data, contentNode, builder);

		return false;
	},

	_createTabClick: function(builder, t, tabs, contentDivs, labels)
	{
		return function() {
			$(tabs[t]).addClass('selected');
			for (var i = 0; i < tabs.length; i++) {
				if (i !== t)
				{
					$(tabs[i]).removeClass('selected');
					$(contentDivs[i]).hide();
				}
			}
			$(contentDivs[t]).show();
			builder.wizard.selectedTab(labels[t]);
		};
	},

	_panelTabsHandler: function(parentContainer, data, builder) {
		var tabsContainer = L.DomUtil.create('div', 'ui-tabs mobile-wizard ui-widget');
		var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content mobile-wizard ui-widget', parentContainer);

		var tabs = [];
		var contentDivs = [];
		var labels = [];
		for (var tabIdx = 0; tabIdx < data.length; tabIdx++) {
			var item = data[tabIdx];

			var title = builder._cleanText(item.text);

			var tab = L.DomUtil.create('div', 'ui-tab mobile-wizard', tabsContainer);
			tab.id = title;
			tabs[tabIdx] = tab;

			var label = L.DomUtil.create('span', 'ui-tab-content mobile-wizard unolabel', tab);
			label.innerHTML = title;
			labels[tabIdx] = title;

			var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', contentsContainer);
			contentDiv.title = title;

			builder._currentDepth++;
			if (item.children)
			{
				for (var i = 0; i < item.children.length; i++) {
					builder.build(contentDiv, [item.children[i]]);
				}
			}
			else // build ourself inside there
			{
				builder.build(contentDiv, [item]);
			}
			builder._currentDepth--;

			$(contentDiv).hide();
			contentDivs[tabIdx] = contentDiv;
		}

		if (builder.wizard) {
			builder.wizard.setTabs(tabsContainer);

			for (var t = 0; t < tabs.length; t++) {
				// to get capture of 't' right has to be a sub fn.
				var fn = builder._createTabClick(
					builder, t, tabs, contentDivs, labels);
				$(tabs[t]).click(fn);
			}
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
		$(tabs[0]).click();
		builder.wizard.goLevelDown(contentDivs[0]);

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

		checkbox.addEventListener('change', function() {
			builder.callback('checkbox', 'change', checkbox, this.checked, builder);
		});

		var customCommand = builder._mapWindowIdToUnoCommand(data.id);

		var updateFunction = function() {
			var state = builder._getUnoStateForItemId(data.id, builder);

			if (!state) {
				var items = builder.map['stateChangeHandler'];
				state = items.getItemValue(data.command);
			}
			if (!state)
				state = data.checked;

			if (state && state === 'true' || state === 1 || state === '1')
				$(checkbox).attr('checked', 'checked');
			else if (state)
				$(checkbox).removeAttr('checked', 'checked');
		};

		updateFunction();

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === customCommand ? customCommand : data.command)
				updateFunction();
		}, this);

		if (data.hidden)
			$(checkbox).hide();

		return false;
	},

	_unitToVisibleString: function(unit) {
		if (unit == 'inch') {
			return '\"';
		} else if (unit == 'percent') {
			return '%';
		} else if (unit == 'degree') {
			return '°';
		}
		return unit;
	},

	_mapWindowIdToUnoCommand: function(id) {
		switch (id) {
		case 'beforetextindent':
		case 'aftertextindent':
		case 'firstlineindent':
			return '.uno:LeftRightParaMargin';

		case 'aboveparaspacing':
		case 'belowparaspacing':
			return '.uno:ULSpacing';

		case 'rowheight':
			return '.uno:TableRowHeight';

		case 'columnwidth':
			return '.uno:TableColumWidth';

		case 'decimalplaces':
		case 'leadingzeroes':
		case 'negativenumbersred':
		case 'thousandseparator':
			return '.uno:NumberFormat';

		case 'linetransparency':
			return '.uno:LineTransparence';

		case 'settransparency':
			return '.uno:FillTransparence';

		case 'FIELD_TRANSPARENCY':
			return '.uno:FillShadowTransparency';

		case 'gradientstyle':
		case 'fillgrad1':
		case 'fillgrad2':
		case 'gradangle':
			return '.uno:FillGradient';

		case 'setbrightness':
			return '.uno:GrafLuminance';

		case 'setcontrast':
			return '.uno:GrafContrast';

		case 'setgraphtransparency':
			return '.uno:GrafTransparence';

		case 'setred':
			return '.uno:GrafRed';

		case 'setgreen':
			return '.uno:GrafGreen';

		case 'setblue':
			return '.uno:GrafBlue';

		case 'setgamma':
			return '.uno:GrafGamma';

		case 'selectwidth':
		case 'selectheight':
			return '.uno:Size';

		case 'horizontalpos':
		case 'verticalpos':
			return '.uno:Position';

		case 'transtype':
			return '.uno:FillFloatTransparence';
		}

		return null;
	},

	_getUnoStateForItemId: function(id, builder) {
		var items = builder.map['stateChangeHandler'];
		var state = null;

		switch (id) {
		case 'beforetextindent':
			state = items.getItemValue('.uno:LeftRightParaMargin');
			if (state)
				return state.left.replace(',', '.');
			break;

		case 'aftertextindent':
			state = items.getItemValue('.uno:LeftRightParaMargin');
			if (state) {
				return state.right.replace(',', '.');
			}
			break;

		case 'firstlineindent':
			state = items.getItemValue('.uno:LeftRightParaMargin');
			if (state)
				return state.firstline.replace(',', '.');
			break;

		case 'aboveparaspacing':
			state = items.getItemValue('.uno:ULSpacing');
			if (state)
				return state.upper.replace(',', '.');
			break;

		case 'belowparaspacing':
			state = items.getItemValue('.uno:ULSpacing');
			if (state)
				return state.lower.replace(',', '.');
			break;

		case 'rowheight':
			state = items.getItemValue('.uno:TableRowHeight');
			if (state)
				return state.replace(',', '.');
			break;

		case 'columnwidth':
			state = items.getItemValue('.uno:TableColumWidth');
			if (state)
				return state.replace(',', '.');
			break;

		case 'decimalplaces':
			state = items.getItemValue('.uno:NumberFormat');
			if (state) {
				state = state.split(',');
				if (state.length > 2)
					return state[2];
			}
			break;

		case 'leadingzeroes':
			state = items.getItemValue('.uno:NumberFormat');
			if (state) {
				state = state.split(',');
				if (state.length > 3)
					return state[3];
			}
			break;

		case 'negativenumbersred':
			state = items.getItemValue('.uno:NumberFormat');
			if (state) {
				state = state.split(',');
				if (state.length > 1)
					return state[1];
			}
			return;

		case 'thousandseparator':
			state = items.getItemValue('.uno:NumberFormat');
			if (state) {
				state = state.split(',');
				if (state.length > 0)
					return state[0];
			}
			return;

		case 'linetransparency':
			state = items.getItemValue('.uno:LineTransparence');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'settransparency':
			state = items.getItemValue('.uno:FillTransparence');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'FIELD_TRANSPARENCY':
			state = items.getItemValue('.uno:FillShadowTransparency');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'fillstyle':
			state = items.getItemValue('.uno:FillStyle');
			if (state) {
				switch (state) {
				case 'NONE':
					return _('None');

				case 'SOLID':
					return _('Color');

				case 'GRADIENT':
					return _('Gradient');

				case 'HATCH':
					return _('Hatching');

				case 'BITMAP':
					// FIXME: can be bitmap or pattern, for now we cant import bitmap
					return _('Pattern');
				}
			}
			break;

		case 'fillattr':
			var hatch = items.getItemValue('.uno:FillHatch');
			var bitmap = items.getItemValue('.uno:FillBitmap');
			if (hatch || bitmap) {
				// TODO
			}
			break;

		case 'gradientstyle':
			state = items.getItemValue('.uno:FillGradient');
			if (state) {
				return builder._gradientStyleToLabel(state.style);
			}
			break;

		case 'gradangle':
			state = items.getItemValue('.uno:FillGradient');
			if (state) {
				return state.angle;
			}
			break;

		case 'fillgrad1':
			state = items.getItemValue('.uno:FillGradient');
			if (state) {
				return state.startcolor;
			}
			break;

		case 'fillgrad2':
			state = items.getItemValue('.uno:FillGradient');
			if (state) {
				return state.endcolor;
			}
			break;

		case 'setbrightness':
			state = items.getItemValue('.uno:GrafLuminance');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setcontrast':
			state = items.getItemValue('.uno:GrafContrast');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setgraphtransparency':
			state = items.getItemValue('.uno:GrafTransparence');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setred':
			state = items.getItemValue('.uno:GrafRed');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setgreen':
			state = items.getItemValue('.uno:GrafGreen');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setblue':
			state = items.getItemValue('.uno:GrafBlue');
			if (state) {
				return state.replace(',', '.');
			}
			break;

		case 'setgamma':
			state = items.getItemValue('.uno:GrafGamma');
			if (state) {
				return String(state.replace(',', '.') / 100.0);
			}
			break;

		case 'selectwidth':
			state = items.getItemValue('.uno:Size');
			if (state) {
				return String(L.mm100thToInch(state.split('x')[0]).toFixed(2));
			}
			break;

		case 'selectheight':
			state = items.getItemValue('.uno:Size');
			if (state) {
				return String(L.mm100thToInch(state.split('x')[1]).toFixed(2));
			}
			break;

		case 'horizontalpos':
			state = items.getItemValue('.uno:Position');
			if (state) {
				return String(L.mm100thToInch(state.split('/')[0]).toFixed(2));
			}
			break;

		case 'verticalpos':
			state = items.getItemValue('.uno:Position');
			if (state) {
				return String(L.mm100thToInch(state.split('/')[1]).toFixed(2));
			}
			break;

		case 'transtype':
			state = items.getItemValue('.uno:FillFloatTransparence');
			if (state) {
				return builder._gradientStyleToLabel(state.style);
			}
			break;
		}

		return null;
	},

	_getTitleForControlWithId: function(id) {
		switch (id) {

		case 'fillgrad1':
			return _('From');

		case 'fillgrad2':
			return _('To');
		}

		return null;
	},

	_spinfieldControl: function(parentContainer, data, builder, customCallback) {
		if (data.label) {
			var fixedTextData = { text: data.label };
			builder._fixedtextControl(parentContainer, fixedTextData, builder);
		}

		var div = L.DomUtil.create('div', 'spinfieldcontainer', parentContainer);
		div.id = data.id;

		var commandName = data.id ? data.id.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var image = L.DomUtil.create('img', 'spinfieldimage', div);
			var icon = builder._createIconPath(data.id);
			image.src = icon;
			icon.alt = '';
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

		if (data.readOnly === true)
			$(spinfield).attr('readOnly', 'true');

		var updateFunction = function() {
			var value = builder._getUnoStateForItemId(data.id, builder);

			if (!value && data.text != undefined)
				value = data.text;
			else if (!value && data.children && data.children.length)
				value = data.children[0].text;

			$(spinfield).attr('value', builder._cleanValueFromUnits(value));
		};

		updateFunction();

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === builder._mapWindowIdToUnoCommand(data.id))
				updateFunction();
		}, this);

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
		data.text = title;

		var entries = [];
		for (var index in data.entries) {
			var style = 'ui-combobox-text';
			if ((data.selectedEntries && index == data.selectedEntries[0])
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

		builder._explorableEntry(parentContainer, data, contentNode, builder, valueNode, iconPath);

		return false;
	},

	_valuesetControl: function (parentContainer, data, builder) {
		var elem;
		var image;
		var image64;

		if (!data.entries || data.entries.length === 0) {
			return false;
		}

		for (var index in data.entries) {
			image = data.entries[index].image;
			image64 = data.entries[index].image64;
			if (image) {
				image = image.substr(0, image.lastIndexOf('.'));
				image = image.substr(image.lastIndexOf('/') + 1);
				image = 'url("images/' + image + '.svg")';
			}

			if (image64) {
				image = 'url("' + image64 + '")';
			}

			elem = L.DomUtil.create('div', 'layout ' +
				(data.entries[index].selected ? ' loleaflet-context-down' : ''), parentContainer);
			$(elem).data('id', data.entries[index].id);
			$(elem).click(function () {
				builder.callback('valueset', 'selected', { id: data.id }, $(this).data('id'), builder);
			});

			elem.style.setProperty('background', image + ' no-repeat center', 'important');
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

	_htmlControl: function(parentContainer, data) {
		var container = L.DomUtil.create('div', 'mobile-wizard', parentContainer);
		container.appendChild(data.content);
		container.id = data.id;
		if (data.style && data.style.length) {
			L.DomUtil.addClass(container, data.style);
		}

		if (data.hidden)
			$(container).hide();

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

	// make a class identifier from parent's id by walking up the tree
	_getParentId : function(it) {
		while (it.parent && !it.id)
			it = it.parent;
		if (it && it.id)
			return '-' + it.id;
		else
			return '';
	},

	// Create a DOM node with an identifiable parent class
	_createIdentifiable : function(type, classNames, parentContainer, data) {
		return L.DomUtil.create(
			type, classNames + this._getParentId(data),
			parentContainer);
	},

	_unoToolButton: function(parentContainer, data, builder) {
		var button = null;

		var div = this._createIdentifiable('div', 'ui-content unospan', parentContainer, data);

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

			var updateFunction = function() {
				var items = builder.map['stateChangeHandler'];
				var state = items.getItemValue(data.command);

				if (state && state === 'true')
					$(button).addClass('selected');
				else
					$(button).removeClass('selected');
			};

			updateFunction();

			builder.map.on('commandstatechanged', function(e) {
				if (e.commandName === data.command)
					updateFunction();
			}, this);

		} else {
			button = L.DomUtil.create('label', 'ui-content unolabel', div);
			button.innerHTML = builder._cleanText(data.text);
		}

		$(div).click(function () {
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

	_sendColorCommand: function(builder, data, color) {
		var gradientItem;

		if (data.id === 'fillgrad1') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillGradient');
			gradientItem.startcolor = color;
			return '.uno:FillGradient?FillGradientJSON:string=' + JSON.stringify(gradientItem);
		} else if (data.id === 'fillgrad2') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillGradient');
			gradientItem.endcolor = color;
			return '.uno:FillGradient?FillGradientJSON:string=' + JSON.stringify(gradientItem);
		}

		var command = data.command + '?Color:string=' + color;

		// update the item state as we send
		var items = builder.map['stateChangeHandler'];
		items.setItemValue(data.command, parseInt('0x' + color));

		builder.map.sendUnoCommand(command);
	},

	_getDefaultColorForCommand: function(command) {
		if (command == '.uno:BackColor')
			return '#';
		else if (command == '.uno:CharBackColor')
			return '#';
		else if (command == '.uno:BackgroundColor')
			return '#';
		return 0;
	},

	_getCurrentColor: function(data, builder) {
		var selectedColor = parseInt(builder.map['stateChangeHandler'].getItemValue(data.command));

		if (!selectedColor || selectedColor < 0)
			selectedColor = builder._getUnoStateForItemId(data.id, builder);

		if (!selectedColor || selectedColor < 0)
			selectedColor = builder._getDefaultColorForCommand(data.command);

		selectedColor = selectedColor.toString(16);

		while (selectedColor != '#' && selectedColor.length < 6) {
			selectedColor = '0' + selectedColor;
		}

		if (selectedColor[0] != '#')
			selectedColor = '#' + selectedColor;

		return selectedColor;
	},

	_clearFormattingControl: function(parentContainer, data, builder) {
		var iconPath = builder._createIconPath(data.command);
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard-widebutton ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		if (data && data.id)
			sectionTitle.id = data.id;

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = '';
		if (iconPath) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			icon.src = iconPath;
			icon.alt = '';
			titleClass = 'menu-entry-with-icon';
		}
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);
		titleSpan.innerHTML =  builder._cleanText(_UNO(data.command));

		$(sectionTitle).click(function () {
			builder.callback('toolbutton', 'click', sectionTitle, data.command, builder);
		});
		return false;
	},

	_borderControlItem: function(parentContainer, data, builder, i) {
		var button = null;

		var div = this._createIdentifiable('div', 'ui-content unospan', parentContainer, data);

		var buttonId = 'border-' + i;
		button = L.DomUtil.create('img', 'ui-content borderbutton', div);
		button.src = 'images/fr0' + i + '.svg';
		button.id = buttonId;

		$(div).click(function () {
			var color = 0;
			// Find our associated color picker
			var item = L.LOUtil.findItemWithAttributeRecursive(data.parent, 'command', '.uno:FrameLineColor');
			if (item)
				color = builder._getCurrentColor(item, builder);
			window.setBorderStyle(i, color);
		});
	},

	_borderControl: function(parentContainer, data, builder) {
		var bordercontrollabel = L.DomUtil.create('p', 'mobile-wizard ui-text', parentContainer);
		bordercontrollabel.innerHTML = _('Cell borders');
		bordercontrollabel.id = data.id + 'label';
		for (var i = 1; i < 13; ++i)
			builder._borderControlItem(parentContainer, data, builder, i);
	},

	_colorControl: function(parentContainer, data, builder) {
		var titleOverride = builder._getTitleForControlWithId(data.id);
		if (titleOverride)
			data.text = titleOverride;

		data.id = data.id ? data.id : (data.command ? data.command.replace('.uno:', '') : undefined);

		data.text = builder._cleanText(data.text);

		var valueNode =  L.DomUtil.create('div', 'color-sample-selected', null);
		var selectedColor = null;

		var updateFunction = function (titleSpan) {
			selectedColor = builder._getCurrentColor(data, builder);
			valueNode.style.backgroundColor = selectedColor;
			if (titleSpan)
				titleSpan.innerHTML = data.text;
		}.bind(this);

		updateFunction(null);

		var iconPath = builder._createIconPath(data.command);
		var noColorControl = (data.command !== '.uno:FontColor' && data.command !== '.uno:Color');

		var callback = function(color) {
			builder._sendColorCommand(builder, data, color);
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

		builder._explorableEntry(parentContainer, data, contentNode, builder, valueNode, iconPath, updateFunction);
		return false;
	},

	_lineWidthControl: function(parentContainer, data, builder) {
		var values = [ 0.0,
			0.5,
			0.8,
			1.0,
			1.5,
			2.3,
			3.0,
			4.5,
			6.0 ];

		var currentWidth = parseInt(builder.map['stateChangeHandler'].getItemValue('.uno:LineWidth'));
		var currentWidthText = currentWidth ? String(parseFloat(currentWidth)/100.0) : '0.5';

		var lineData = { min: 0.5, max: 5, id: 'linewidth', text: currentWidthText, readOnly: true };

		var callbackFunction = function(objectType, eventType, object) {
			var newValue = 0;
			if (eventType == 'plus') {
				$(object).find('input').val(function(i, oldVal) {
					var index = 1;
					newValue = values[0];
					while (newValue <= oldVal && index < values.length)
						newValue = values[index++];
					return newValue;
				});
			} else if (eventType == 'minus') {
				$(object).find('input').val(function(i, oldVal) {
					if (oldVal > 0.0)
					{
						var index = values.length - 1;
						newValue = values[index];
						while (newValue >= oldVal && index > 0)
							newValue = values[index--];
					}
					else
						newValue = 0.0;
					return newValue;
				});
			}
			var command = '.uno:LineWidth?Width:double=' + newValue.toFixed(1);
			builder.map.sendUnoCommand(command);
		};

		builder._spinfieldControl(parentContainer, lineData, builder, callbackFunction);
	},

	_subMenuHandler: function(parentContainer, data, builder) {
		var title = data.text;
		builder._explorableMenu(parentContainer, title, data.children, builder, undefined, data.id);

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

		if (data.hyperlink) {
			menuEntry = L.DomUtil.create('a', 'context-menu-link', menuEntry);
			menuEntry.href = '#';
		}

		var icon = null;
		var commandName = data.command && data.command.substring(0, '.uno:'.length) === '.uno:' ? data.command.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, menuEntry);
			var iconPath = 'images/lc_' + iconName + '.svg';
			icon = L.DomUtil.create('img', '', iconSpan);
			icon.src = iconPath;
			icon.alt = '';
			icon.addEventListener('error', function() {
				icon.style.display = 'none';
			});
		}
		if (data.checked && data.checked === true) {
			L.DomUtil.addClass(menuEntry, 'menu-entry-checked');
		}

		var titleSpan = L.DomUtil.create('span', '', menuEntry);
		titleSpan.innerHTML = title;
		var paddingClass = icon ? 'menu-entry-with-icon' : 'menu-entry-no-icon';
		L.DomUtil.addClass(titleSpan, paddingClass);

		if (builder.wizard) {
			$(menuEntry).click(function() {
				if (window.insertionMobileWizard)
					window.onClick(null, 'insertion_mobile_wizard');
				else if (window.mobileMenuWizard)
					$('#main-menu-state').click();
				else if (window.contextMenuWizard) {
					window.contextMenuWizard = false;
					builder.map.fire('closemobilewizard');
				}

				// before close the wizard then execute the action
				if (data.executionType === 'action') {
					builder.map.menubar._executeAction(undefined, data);
				} else if (data.executionType === 'callback') {
					data.callback();
				} else if (!builder.map._clip || !builder.map._clip.filterExecCopyPaste(data.command)) {
					// Header / footer is already inserted.
					if ((data.command.startsWith('.uno:InsertPageHeader') ||
					     data.command.startsWith('.uno:InsertPageFooter')) &&
					    data.checked && data.checked === true) {
						return;
					}
					builder.map.sendUnoCommand(data.command);
				}
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

		builder._explorableMenu(parentContainer, title, data.children, builder, content, data.id);
	},

	// link each node to its parent, should do one recursive descent
	_parentize: function(data, parent) {
		if (data.parent)
			return;
		if (data.children !== undefined) {
			for (var idx in data.children) {
				this._parentize(data.children[idx], data);
			}
		}
		data.parent = parent;
	},

	_addMissingLabels: function(data) {
		if (!this._missingLabelData) {
			this._missingLabelData = {};
			var labelData = {
				// This adds a label widget just before the
				// control with id 'linestyle'
				'linestyle' : _('Line style:')
			};

			var mLD = this._missingLabelData;
			Object.keys(labelData).forEach(function(controlId) {
				mLD[controlId] = {
					id: controlId + 'label',
					type: 'fixedtext',
					text: labelData[controlId],
					enabled: 'true'
				};
			});
		}

		for (var idx = 0; idx < data.length; ++idx) {
			if (!data[idx])
				continue;
			var controlId = data[idx].id;
			if (controlId && this._missingLabelData.hasOwnProperty(controlId)) {
				data.splice(idx, 0, this._missingLabelData[controlId]);
				++idx;
			}
		}
	},

	_amendJSDialogData: function(data) {
		// Called from build() which is already recursive,
		// so no need to recurse here over 'data'.
		this._addMissingLabels(data);
	},

	build: function(parent, data) {
		this._amendJSDialogData(data);
		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;
			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;
			var needsToCreateContainer =
				childType == 'panel' || childType == 'frame';

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var childObject = needsToCreateContainer ? L.DomUtil.createWithId('div', childData.id, parent) : parent;

			var handler = this._controlHandlers[childType];
			var twoPanelsAsChildren =
			    childData.children && childData.children.length == 2
			    && childData.children[0] && childData.children[0].type == 'panel'
			    && childData.children[1] && childData.children[1].type == 'panel';

			if (twoPanelsAsChildren) {
				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, childData.children, this);
			} else {
				if (handler)
					processChildren = handler(childObject, childData, this);
				else
					console.warn('Unsupported control type: \"' + childType + '\"');

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
				}
			}
		}
	}
});

L.Control.JSDialogBuilder.getMenuStructureForMobileWizard = function(menu, mainMenu, itemCommand) {
	if (itemCommand.includes('sep'))
		return null;

	var itemText = '';
	if (menu.name)
		itemText = menu.name;

	var itemType = 'submenu';
	var executionType = 'menu';
	if (mainMenu) {
		itemType = 'mainmenu';
		executionType = 'menu';
	} else if (menu.callback) {
		itemType = 'menuitem';
		executionType = 'callback';
	} else if (!menu.items) {
		itemType = 'menuitem';
		executionType = 'command';
	}

	var menuStructure = {
		type : itemType,
		enabled : true,
		text : itemText,
		executionType : executionType,
		children : []
	};
	if (itemCommand)
		menuStructure['command'] = itemCommand;
	if (menu.icon)
		menuStructure['checked'] = true;
	if (menu.callback)
		menuStructure['callback'] = menu.callback;
	if (menu.isHtmlName)
		menuStructure['hyperlink'] = true;

	if (mainMenu) {
		for (var menuItem in menu) {
			var subItemCommand = menu[menuItem].command ? menu[menuItem].command : menuItem;
			var element = this.getMenuStructureForMobileWizard(menu[menuItem], false, subItemCommand);
			if (element)
				menuStructure['children'].push(element);
		}
	} else if (itemType == 'submenu') {
		for (menuItem in menu.items) {
			element = this.getMenuStructureForMobileWizard(menu.items[menuItem], false, menuItem);
			if (element)
				menuStructure['children'].push(element);
		}
		if (menu.command) {
			menuStructure.id = menu.command.substring(5).toLowerCase();
		}
	}

	return menuStructure;
};

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup(options);
	return builder;
};
