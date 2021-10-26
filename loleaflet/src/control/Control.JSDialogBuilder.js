/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global app $ w2ui _ _UNO L */

L.Control.JSDialogBuilder = L.Control.extend({

	options: {
		// window id
		windowId: null,
		// reference to map
		map: null,
		// reference to the parent container
		mobileWizard: null,
		// css class name added to the html nodes
		cssClass: 'mobile-wizard',

		// create only icon without label
		noLabelsForUnoButtons: false,

		// create labels next to the icon
		useInLineLabelsForUnoButtons: false
	},

	windowId: null,

	/* Handler is a function which takes three parameters:
	 * parentContainer - place where insert the content
	 * data - data of a control under process
	 * builder - current builder reference
	 *
	 * returns boolean: true if children should be processed
	 * and false otherwise
	 */
	_controlHandlers: null,
	_toolitemHandlers: null,
	_menuItemHandlers: null,
	_menus: null,
	_colorPickers: null,

	_currentDepth: 0,

	setWindowId: function (id) {
		this.windowId = id;
	},

	_setup: function(options) {
		this._clearColorPickers();
		this.wizard = options.mobileWizard;
		this.map = options.map;
		this.windowId = options.windowId;
		this.callback = options.callback ? options.callback : this._defaultCallbackHandler;

		this._colorPickers = [];

		this._controlHandlers = {};
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['basespinfield'] = this.baseSpinField;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['metricfield'] = this._metricfieldControl;
		this._controlHandlers['formattedfield'] = this._formattedfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['multilineedit'] = this._multiLineEditControl;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['okbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['comboboxentry'] = this._comboboxEntry;
		this._controlHandlers['listbox'] = this._listboxControl;
		this._controlHandlers['valueset'] = this._valuesetControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['htmlcontrol'] = this._htmlControl;
		this._controlHandlers['expander'] = this._expanderHandler;
		this._controlHandlers['grid'] = this._gridHandler;
		this._controlHandlers['alignment'] = this._alignmentHandler;
		this._controlHandlers['buttonbox'] = this._buttonBox;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['calcfuncpanel'] = this._calcFuncListPanelHandler;
		this._controlHandlers['tabcontrol'] = this._tabsControlHandler;
		this._controlHandlers['tabpage'] = this._containerHandler;
		this._controlHandlers['paneltabs'] = this._panelTabsHandler;
		this._controlHandlers['singlepanel'] = this._singlePanelHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['dialog'] = this._containerHandler;
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
		this._controlHandlers['treelistbox'] = this._treelistboxControl;
		this._controlHandlers['iconview'] = this._iconViewControl;
		this._controlHandlers['drawingarea'] = this._drawingAreaControl;
		this._controlHandlers['rootcomment'] = this._rootCommentControl;
		this._controlHandlers['comment'] = this._commentControl;
		this._controlHandlers['emptyCommentWizard'] = this._rootCommentControl;
		this._controlHandlers['separator'] = this._separatorControl;
		this._controlHandlers['menubutton'] = this._menubuttonControl;
		this._controlHandlers['spinner'] = this._spinnerControl;
		this._controlHandlers['spinnerimg'] = this._spinnerImgControl;

		this._controlHandlers['mainmenu'] = this._containerHandler;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._menuItemHandlers = {};
		this._menuItemHandlers['inserttable'] = this._insertTableMenuItem;

		this._toolitemHandlers = {};
		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:CharBackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;
		this._toolitemHandlers['.uno:ResetAttributes'] = this._formattingControl;
		this._toolitemHandlers['.uno:SetDefault'] = this._formattingControl;
		this._toolitemHandlers['.uno:FormatPaintbrush'] = this._formattingControl;

		this._toolitemHandlers['.uno:InsertFormula'] = function () {};
		this._toolitemHandlers['.uno:SetBorderStyle'] = function () {};
		this._toolitemHandlers['.uno:TableCellBackgroundColor'] = function () {};

		this._menus = {};
		this._menus['Menu Statistic'] = [
			{text: _UNO('.uno:SamplingDialog', 'spreadsheet'), uno: '.uno:SamplingDialog'},
			{text: _UNO('.uno:DescriptiveStatisticsDialog', 'spreadsheet'), uno: '.uno:DescriptiveStatisticsDialog'},
			{text: _UNO('.uno:AnalysisOfVarianceDialog', 'spreadsheet'), uno: '.uno:AnalysisOfVarianceDialog'},
			{text: _UNO('.uno:CorrelationDialog', 'spreadsheet'), uno: '.uno:CorrelationDialog'},
			{text: _UNO('.uno:CovarianceDialog', 'spreadsheet'), uno: '.uno:CovarianceDialog'},
			{text: _UNO('.uno:ExponentialSmoothingDialog', 'spreadsheet'), uno: '.uno:ExponentialSmoothingDialog'},
			{text: _UNO('.uno:MovingAverageDialog', 'spreadsheet'), uno: '.uno:MovingAverageDialog'},
			{text: _UNO('.uno:RegressionDialog', 'spreadsheet'), uno: '.uno:RegressionDialog'},
			{text: _UNO('.uno:TTestDialog', 'spreadsheet'), uno: '.uno:TTestDialog'},
			{text: _UNO('.uno:FTestDialog', 'spreadsheet'), uno: '.uno:FTestDialog'},
			{text: _UNO('.uno:ZTestDialog', 'spreadsheet'), uno: '.uno:ZTestDialog'},
			{text: _UNO('.uno:ChiSquareTestDialog', 'spreadsheet'), uno: '.uno:ChiSquareTestDialog'},
			{text: _UNO('.uno:FourierAnalysisDialog', 'spreadsheet'), uno: '.uno:FourierAnalysisDialog'}
		];
		this._menus['FormattingMarkMenu'] = [
			{text: _UNO('.uno:InsertNonBreakingSpace', 'text'), uno: 'InsertNonBreakingSpace'},
			{text: _UNO('.uno:InsertHardHyphen', 'text'), uno: 'InsertHardHyphen'},
			{text: _UNO('.uno:InsertSoftHyphen', 'text'), uno: 'InsertSoftHyphen'},
			{text: _UNO('.uno:InsertZWSP', 'text'), uno: 'InsertZWSP'},
			{text: _UNO('.uno:InsertZWNBSP', 'text'), uno: 'InsertZWNBSP'},
			{text: _UNO('.uno:InsertLRM', 'text'), uno: 'InsertLRM'},
			{text: _UNO('.uno:InsertRLM', 'text'), uno: 'InsertRLM'}
		];
		this._menus['FormatMenu'] = [
			{text: _UNO('.uno:Bold', 'text'), uno: 'Bold'},
			{text: _UNO('.uno:Italic', 'text'), uno: 'Italic'},
			{text: _UNO('.uno:Underline', 'text'), uno: 'Underline'},
			{text: _UNO('.uno:UnderlineDouble', 'text'), uno: 'UnderlineDouble'},
			{text: _UNO('.uno:Strikeout', 'text'), uno: 'Strikeout'},
			{text: _UNO('.uno:Overline', 'text'), uno: 'Overline'},
			{type: 'separator'},
			{text: _UNO('.uno:SuperScript', 'text'), uno: 'SuperScript'},
			{text: _UNO('.uno:SubScript', 'text'), uno: 'SubScript'},
			{type: 'separator'},
			{text: _UNO('.uno:Shadowed', 'text'), uno: 'Shadowed'},
			{text: _UNO('.uno:OutlineFont', 'text'), uno: 'OutlineFont'},
			{type: 'separator'},
			{text: _UNO('.uno:Grow', 'text'), uno: 'Grow'},
			{text: _UNO('.uno:Shrink', 'text'), uno: 'Shrink'},
			{type: 'separator'},
			{text: _UNO('.uno:ChangeCaseToUpper', 'text'), uno: 'ChangeCaseToUpper'},
			{text: _UNO('.uno:ChangeCaseToLower', 'text'), uno: 'ChangeCaseToLower'},
			{text: _UNO('.uno:ChangeCaseRotateCase', 'text'), uno: 'ChangeCaseRotateCase'},
			{type: 'separator'},
			{text: _UNO('.uno:ChangeCaseToSentenceCase', 'text'), uno: 'ChangeCaseToSentenceCase'},
			{text: _UNO('.uno:ChangeCaseToTitleCase', 'text'), uno: 'ChangeCaseToTitleCase'},
			{text: _UNO('.uno:ChangeCaseToToggleCase', 'text'), uno: 'ChangeCaseToToggleCase'},
			{type: 'separator'},
			{text: _UNO('.uno:SmallCaps', 'text'), uno: 'SmallCaps'}
		];
		this._menus['FormatBulletsMenu'] = [
			{text: _UNO('.uno:DefaultBullet', 'text'), uno: 'DefaultBullet'},
			{type: 'separator'},
			{text: _UNO('.uno:DecrementLevel', 'text'), uno: 'DecrementLevel'},
			{text: _UNO('.uno:IncrementLevel', 'text'), uno: 'IncrementLevel'},
			{text: _UNO('.uno:DecrementSubLevels', 'text'), uno: 'DecrementSubLevels'},
			{text: _UNO('.uno:IncrementSubLevels', 'text'), uno: 'IncrementSubLevels'},
			{type: 'separator'},
			{text: _UNO('.uno:MoveDown', 'text'), uno: 'MoveDown'},
			{text: _UNO('.uno:MoveUp', 'text'), uno: 'MoveUp'},
			{text: _UNO('.uno:MoveDownSubItems', 'text'), uno: 'MoveDownSubItems'},
			{text: _UNO('.uno:MoveUpSubItems', 'text'), uno: 'MoveUpSubItems'},
			{type: 'separator'},
			{text: _UNO('.uno:InsertNeutralParagraph', 'text'), uno: 'InsertNeutralParagraph'},
			{text: _UNO('.uno:NumberingStart', 'text'), uno: 'NumberingStart'},
			{text: _UNO('.uno:RemoveBullets', 'text'), uno: 'RemoveBullets'},
			{type: 'separator'},
			{text: _UNO('.uno:JumpDownThisLevel', 'text'), uno: 'JumpDownThisLevel'},
			{text: _UNO('.uno:JumpUpThisLevel', 'text'), uno: 'JumpUpThisLevel'},
			{text: _UNO('.uno:ContinueNumbering', 'text'), uno: 'ContinueNumbering'}
		];
		this._menus['ConditionalFormatMenu'] = [
			{text: _UNO('.uno:ConditionalFormatDialog', 'spreadsheet'), uno: 'ConditionalFormatDialog'},
			{text: _UNO('.uno:ColorScaleFormatDialog', 'spreadsheet'), uno: 'ColorScaleFormatDialog'},
			{text: _UNO('.uno:DataBarFormatDialog', 'spreadsheet'), uno: 'DataBarFormatDialog'},
			{text: _UNO('.uno:IconSetFormatDialog', 'spreadsheet'), uno: 'IconSetFormatDialog'},
			{text: _UNO('.uno:CondDateFormatDialog', 'spreadsheet'), uno: 'CondDateFormatDialog'},
			{type: 'separator'},
			{text: _UNO('.uno:ConditionalFormatManagerDialog', 'spreadsheet'), uno: 'ConditionalFormatManagerDialog'}
		];

		this._currentDepth = 0;
	},

	_clearColorPickers: function() {
		this._colorPickers = [];
		L.ColorPicker.ID = 0;
	},

	_preventDocumentLosingFocusOnClick: function(div) {
		$(div).on('mousedown',function (e) {
			e.preventDefault();
			e.stopPropagation();
		});
	},

	_toolitemHandler: function(parentContainer, data, builder) {
		if (data.command || data.postmessage) {
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

		if (builder.map.uiManager.isUIBlocked())
			return;

		console.debug('control: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

		if (builder.wizard.setCurrentScrollPosition)
			builder.wizard.setCurrentScrollPosition();

		if (objectType == 'toolbutton' && eventType == 'click') {
			// encode spaces
			var encodedCommand = data.replace(' ', '%20');
			builder.map.sendUnoCommand(encodedCommand);
		} else if (object) {
			data = typeof data === 'string' ? data.replace('"', '\\"') : data;
			var windowId = builder.windowId !== null && builder.windowId !== undefined ? builder.windowId :
								(window.mobileDialogId !== undefined ? window.mobileDialogId :
								(window.sidebarId !== undefined ? window.sidebarId : -1));
			var message = 'dialogevent ' + windowId
					+ ' {\"id\":\"' + object.id
				+ '\", \"cmd\": \"' + eventType
				+ '\", \"data\": \"' + (typeof(data) === 'object' ? encodeURIComponent(JSON.stringify(data)) : data)
				+ '\", \"type\": \"' + objectType + '\"}';
			app.socket.sendMessage(message);
		}
	},

	baseSpinField: function(parentContainer, data, builder, customCallback) {
		var controls = {};
		if (data.label) {
			var fixedTextData = { text: data.label };
			builder._fixedtextControl(parentContainer, fixedTextData, builder);
		}

		var div = L.DomUtil.create('div', 'spinfieldcontainer', parentContainer);
		div.id = data.id;
		controls['container'] = div;

		var spinfield = L.DomUtil.create('input', 'spinfield', div);
		spinfield.type = 'number';
		controls['spinfield'] = spinfield;

		if (data.unit) {
			var unit = L.DomUtil.create('span', 'spinfieldunit', div);
			unit.innerHTML = builder._unitToVisibleString(data.unit);
		}

		if (data.min != undefined)
			$(spinfield).attr('min', data.min);

		if (data.max != undefined)
			$(spinfield).attr('max', data.max);

		if (data.step != undefined)
			$(spinfield).attr('step', data.step);

		if (data.enabled === 'false' || data.enabled === false) {
			$(spinfield).attr('disabled', 'disabled');
		}

		if (data.readOnly === true)
			$(spinfield).attr('readOnly', 'true');

		if (data.hidden)
			$(spinfield).hide();

		spinfield.addEventListener('change', function() {
			var attrdisabled = $(spinfield).attr('disabled');
			if (attrdisabled !== 'disabled') {
				if (customCallback)
					customCallback('spinfield', 'change', div, this.value, builder);
				else
					builder.callback('spinfield', 'change', div, this.value, builder);
			}
		});

		return controls;
	},

	listenNumericChanges: function (data, builder, controls, customCallback) {
		// It listens server state changes using GetControlState
		// to avoid unit conversion
		builder.map.on('commandstatechanged', function(e) {
			var value = e.state[builder._getFieldFromId(data.id)];
			if (value) {
				if (customCallback)
					customCallback();
				else
					builder.callback('spinfield', 'value', controls.container, this.value, builder);
			}
		}, this);

		controls.spinfield.addEventListener('change', function() {
			if (customCallback)
				customCallback();
			else
				builder.callback('spinfield', 'value', controls.container, this.value, builder);
		});
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

	_toolboxHandler: function(parentContainer, data) {
		if (data.enabled === false || data.enabled === 'false') {
			for (var index in data.children) {
				data.children[index].enabled = false;
			}
		}

		return true;
	},

	_containerHandler: function(parentContainer, data, builder) {
		if (data.cols && data.rows) {
			return builder._gridHandler(parentContainer, data, builder);
		}

		return true;
	},

	_alignmentHandler: function(parentContainer, data, builder) {
		L.DomUtil.addClass(parentContainer, 'ui-alignment');
		return builder._containerHandler(parentContainer, data, builder);
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
		var rows = builder._getGridRows(data.children);
		var cols = builder._getGridColumns(data.children);

		var table = L.DomUtil.create('table', builder.options.cssClass + ' ui-grid', parentContainer);
		for (var row = 0; row < rows; row++) {
			var rowNode = L.DomUtil.create('tr', builder.options.cssClass, table);
			for (var col = 0; col < cols; col++) {
				var child = builder._getGridChild(data.children, row, col);
				var colNode = L.DomUtil.create('td', builder.options.cssClass, rowNode);

				if (child) {
					if (child.width)
						$(colNode).attr('colspan', parseInt(child.width));

					builder.build(colNode, [child], false, false);
				}
			}
		}

		return false;
	},

	_buttonBox: function(parentContainer, data, builder) {
		var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box '
												+ (data.layoutstyle ? data.layoutstyle : ''), parentContainer);

		var leftAlignButtons = [];
		var rightAlignButton = [];

		for (var i in data.children) {
			var child = data.children[i];
			if (child.id === 'help')
				leftAlignButtons.push(child);
			else
				rightAlignButton.push(child);
		}

		var left = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box-left', container);

		for (i in leftAlignButtons) {
			child = leftAlignButtons[i];
			builder._controlHandlers['pushbutton'](left, child, builder);
		}

		var right = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box-right', container);
		if (data.layoutstyle && data.layoutstyle === 'end')
			L.DomUtil.addClass(container, 'end');

		for (i in rightAlignButton) {
			child = rightAlignButton[i];
			builder._controlHandlers['pushbutton'](right, child, builder);
		}

		return false;
	},

	_getListBoxUpdateType: function(id) {
		if (id) {
			if (id === 'numberformatcombobox')
				return 'index';
			else if (id === 'fontsizecombobox')
				return 'value';
		}
		return false;
	},

	_updateListBox: function(builder, sectionTitle, data, state) {
		if (!sectionTitle)
			return;

		var updateBy = builder._getListBoxUpdateType(data.id);

		if (updateBy === 'index')
			sectionTitle.innerHTML = data.entries[state];
		else if (updateBy === 'value')
			sectionTitle.innerHTML = state;

		if (builder.refreshSidebar) {
			builder.wizard._refreshSidebar(0);
			builder.refreshSidebar = false;
		}
	},

	_explorableEntry: function(parentContainer, data, content, builder, valueNode, iconURL, updateCallback) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');
		if (data && data.id)
			sectionTitle.id = data.id;

		if (data.enabled === 'false' || data.enabled === false)
			$(sectionTitle).addClass('disabled');

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = '';

		switch (sectionTitle.id)
		{
		case 'paperformat':
		case 'orientation':
		case 'masterslide':
		case 'SdTableDesignPanel':
		case 'ChartTypePanel':
		case 'rotation':
			iconURL = L.LOUtil.getImageURL('lc_'+ sectionTitle.id.toLowerCase() +'.svg');
			break;
		}
		if (iconURL) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			icon.src = iconURL;
			icon.alt = '';
			titleClass = 'menu-entry-with-icon';
		}
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);

		if (!valueNode && data.command) {
			var items = builder.map['stateChangeHandler'];
			var val = items.getItemValue(data.command);
			if (val)
				valueNode = L.DomUtil.create('div', '', null);
		}

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

			if (state && builder._getListBoxUpdateType(data.id)) {
				titleSpan.innerHTML = data.text;
				builder._updateListBox(builder, valueNode?valueDiv:titleSpan, data, state);
			} else if (state) {
				titleSpan.innerHTML = state;
			} else {
				titleSpan.innerHTML = data.text;
			}
		};

		updateCallback ? updateCallback(titleSpan) : updateFunction(titleSpan);

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === data.command || e.commandName === builder._mapWindowIdToUnoCommand(data.id))
			{
				if (updateCallback)
					updateCallback(titleSpan);
				else
					updateFunction(titleSpan);
			}

		}, this);

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		contentDiv.title = data.text;

		var contentData = content.length ? content : [content];
		var contentNode = contentData.length === 1 ? contentData[0] : null;

		builder._currentDepth++;
		builder.build(contentDiv, contentData);
		builder._currentDepth--;

		if (!data.nosubmenu)
		{
			$(contentDiv).hide();
			if (builder.wizard) {
				if (data.enabled !== 'false' && data.enabled !== false) {
					$(sectionTitle).click(function(event, data) {
						builder.wizard.goLevelDown(contentDiv, data);
						if (contentNode && contentNode.onshow)
							contentNode.onshow();
					});
				} else {
					$(arrowSpan).hide();
				}
			} else {
				console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}
		else
			$(sectionTitle).hide();
	},

	_calcFunctionEntry: function(parentContainer, data, contentNode, builder) {
		var sectionTitle = L.DomUtil.create('div', 'func-entry ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);
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

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		contentDiv.title = data.text;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		if (builder.wizard) {
			var that = this;
			var functionName = data.functionName;
			$(rightDiv).click(function() {
				builder.wizard.goLevelDown(contentDiv);
				if (contentNode.onshow)
					contentNode.onshow();
			});
			$(leftDiv).click(function() {
				if (functionName !== '') {
					app.socket.sendMessage('completefunction name=' + functionName);
					that.map.fire('closemobilewizard');
				}
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_expanderHandler: function(parentContainer, data, builder) {
		if (data.children.length > 0) {
			var container = L.DomUtil.create('div', 'ui-expander-container ' + builder.options.cssClass, parentContainer);
			container.id = data.id;

			if (data.children[0].text && data.children[0].text !== '') {
				var expander = L.DomUtil.create('div', 'ui-expander ' + builder.options.cssClass, container);
				var label = L.DomUtil.create('span', 'ui-expander-label ' + builder.options.cssClass, expander);
				label.innerText = builder._cleanText(data.children[0].text);

				if (data.children.length > 1)
					$(label).addClass('expanded');

				$(expander).click(function () {
					builder.callback('expander', 'toggle', data, null, builder);
				});
			}

			var expanderChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, container);

			var children = [];
			var startPos = 1;

			if (data.children[0].type === 'grid' ||
				data.children[0].type === 'container') {
				startPos = 0;
			}

			for (var i = startPos; i < data.children.length; i++) {
				children.push(data.children[i]);
			}

			builder.build(expanderChildren, children);
		} else {
			return true;
		}

		return false;
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
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		var commandName = dataid;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, sectionTitle);
			var iconURL = L.LOUtil.getImageURL('lc_' + iconName + '.svg');
			icon = L.DomUtil.create('img', '', iconSpan);
			icon.src = iconURL;
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

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
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
		if (data.children.length > 1) {
			var frame = L.DomUtil.create('div', 'ui-frame ' + builder.options.cssClass, parentContainer);
			frame.id = data.id;
			var label = L.DomUtil.create('span', 'ui-frame-label ' + builder.options.cssClass, frame);
			label.innerText = builder._cleanText(data.children[0].text);

			var frameChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, parentContainer);

			var children = [];
			for (var i = 1; i < data.children.length; i++) {
				children.push(data.children[i]);
			}

			builder.build(frameChildren, children);
		} else {
			return builder._containerHandler(parentContainer, data, builder);
		}

		return false;
	},

	_panelHandler: function(parentContainer, data, builder) {
		var content = data.children;
		var contentData = content.length ? content : [content];
		var contentNode = contentData.length === 1 ? contentData[0] : null;

		var iconPath = null;
		if (contentNode) {
			var entryId = contentNode.id;
			if (entryId && entryId.length) {
				iconPath = builder._createIconURL(entryId);
			}
		}

		builder._explorableEntry(parentContainer, data, content, builder, null, iconPath);
		return false;
	},

	_calcFuncListPanelHandler: function(parentContainer, data, builder) {
		var contentNode = data.children[0];

		builder._calcFunctionEntry(parentContainer, data, contentNode, builder);

		return false;
	},

	_createTabClick: function(builder, t, tabs, contentDivs, tabIds)
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
			builder.wizard.selectedTab(tabIds[t]);
		};
	},

	_tabsControlHandler: function(parentContainer, data, builder) {
		if (data.tabs) {
			var tabs = 0;
			for (var tabIdx = 0; data.children && tabIdx < data.children.length; tabIdx++) {
				if (data.children[tabIdx].type === 'tabpage')
					tabs++;
			}
			var isMultiTabJSON = tabs > 1;

			var tabsContainer = L.DomUtil.create('div', 'ui-tabs ' + builder.options.cssClass + ' ui-widget');
			tabsContainer.id = data.id;
			var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content ' + builder.options.cssClass + ' ui-widget', parentContainer);

			tabs = [];
			var contentDivs = [];
			var tabIds = [];
			var singleTabId = null;
			for (tabIdx = 0; tabIdx < data.tabs.length; tabIdx++) {
				var item = data.tabs[tabIdx];

				var title = builder._cleanText(item.text);

				var tab = L.DomUtil.create('div', 'ui-tab ' + builder.options.cssClass, tabsContainer);
				tab.id = item.name + '-tab-label';
				tab.number = item.id - 1;

				var isSelectedTab = data.selected == item.id;
				if (isSelectedTab) {
					$(tab).addClass('selected');
					singleTabId = tabIdx;
				}

				var tabContext = item.context;
				if (tabContext) {
					var tabHasCurrentContext = builder.map.context.context !== ''
											&& tabContext.indexOf(builder.map.context.context) !== -1;
					var tabHasDefultContext = tabContext.indexOf('default') !== -1;

					if (!tabHasCurrentContext && !tabHasDefultContext) {
						$(tab).addClass('hidden');
					}
				}

				tabs[tabIdx] = tab;
				tabIds[tabIdx] = item.name;

				var label = L.DomUtil.create('span', 'ui-tab-content ' + builder.options.cssClass + ' unolabel', tab);
				label.innerHTML = title;

				var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, contentsContainer);
				contentDiv.id = item.name;

				if (!isSelectedTab)
					$(contentDiv).hide();
				contentDivs[tabIdx] = contentDiv;
			}

			if (builder.wizard) {
				builder.wizard.setTabs(tabsContainer, builder);

				for (var t = 0; t < tabs.length; t++) {
					// to get capture of 't' right has to be a sub fn.
					var fn = function(id) {
						return function() {
							builder._createTabClick(builder, id, tabs, contentDivs, tabIds)();
							if (data.tabs[id].id - 1 >= 0)
								builder.callback('tabcontrol', 'selecttab', tabsContainer, data.tabs[id].id - 1, builder);
						};
					};
					$(tabs[t]).click(fn(t));
				}
			} else {
				console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}

		if (isMultiTabJSON) {
			var tabId = 0;
			for (tabIdx = 0; tabIdx < data.children.length; tabIdx++) {
				tab = data.children[tabIdx];

				if (tab.type !== 'tabpage')
					continue;

				builder.build(contentDivs[tabId], [tab], false, false);
				tabId++;
			}

			return false;
		} else {
			for (tabIdx = 0; tabIdx < data.children.length; tabIdx++) {
				tab = data.children[tabIdx];

				if (tab.type !== 'tabpage')
					continue;

				builder.build(contentDivs[singleTabId], [tab], false, false);
				break;
			}

			return false;
		}
	},

	_panelTabsHandler: function(parentContainer, data, builder) {
		var tabsContainer = L.DomUtil.create('div', 'ui-tabs ' + builder.options.cssClass + ' ui-widget');
		var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content ' + builder.options.cssClass + ' ui-widget', parentContainer);

		var tabs = [];
		var contentDivs = [];
		var labels = [];
		for (var tabIdx = 0; tabIdx < data.length; tabIdx++) {
			var item = data[tabIdx];

			var title = builder._cleanText(item.text);

			var tab = L.DomUtil.create('div', 'ui-tab ' + builder.options.cssClass, tabsContainer);
			tab.id = title;
			tabs[tabIdx] = tab;

			var label = L.DomUtil.create('span', 'ui-tab-content ' + builder.options.cssClass + ' unolabel', tab);
			label.innerHTML = title;
			labels[tabIdx] = title;

			var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, contentsContainer);
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
			builder.wizard.setTabs(tabsContainer, builder);

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

	_singlePanelHandler: function(parentContainer, data, builder) {
		var item = data[0];
		if (item.children) {
			var child = item.children[0];
			builder.build(parentContainer, [child]);
		}
		return false;
	},

	_radiobuttonControl: function(parentContainer, data, builder) {
		var container = L.DomUtil.createWithId('div', data.id, parentContainer);
		L.DomUtil.addClass(container, 'radiobutton');
		L.DomUtil.addClass(container, builder.options.cssClass);

		var radiobutton = L.DomUtil.create('input', '', container);
		radiobutton.type = 'radio';

		if (data.group)
			radiobutton.name = data.group;

		var radiobuttonLabel = L.DomUtil.create('label', '', container);
		radiobuttonLabel.innerHTML = builder._cleanText(data.text);
		radiobuttonLabel.for = data.id;

		var toggleFunction = function() {
			builder.callback('radiobutton', 'change', container, this.checked, builder);
		};

		$(radiobuttonLabel).click(function () {
			$(radiobutton).prop('checked', true);
			toggleFunction.bind({checked: true})();
		});

		if (data.enabled === 'false' || data.enabled === false)
			$(radiobutton).attr('disabled', 'disabled');

		if (data.checked === 'true' || data.checked === true)
			$(radiobutton).prop('checked', true);

		radiobutton.addEventListener('change', toggleFunction);

		if (data.hidden)
			$(radiobutton).hide();

		return false;
	},

	_checkboxControl: function(parentContainer, data, builder) {
		var div = L.DomUtil.createWithId('div', data.id, parentContainer);
		L.DomUtil.addClass(div, 'checkbutton');
		L.DomUtil.addClass(div, builder.options.cssClass);

		var checkbox = L.DomUtil.create('input', builder.options.cssClass, div);
		checkbox.type = 'checkbox';
		var checkboxLabel = L.DomUtil.create('label', builder.options.cssClass, div);
		checkboxLabel.innerHTML = builder._cleanText(data.text);
		checkboxLabel.for = data.id;

		var toggleFunction = function() {
			builder.callback('checkbox', 'change', div, this.checked, builder);
		};

		$(checkboxLabel).click(function () {
			var status = $(checkbox).is(':checked');
			$(checkbox).prop('checked', !status);
			toggleFunction.bind({checked: !status})();
		});

		if (data.enabled === 'false' || data.enabled === false) {
			$(checkboxLabel).addClass('disabled');
			$(checkbox).prop('disabled', true);
		}

		checkbox.addEventListener('change', toggleFunction);

		var customCommand = builder._mapWindowIdToUnoCommand(data.id);

		var updateFunction = function() {
			var state = builder._getUnoStateForItemId(data.id, builder);

			if (!state) {
				var items = builder.map['stateChangeHandler'];
				state = items.getItemValue(data.command);
			}
			if (!state)
				state = data.checked;

			if (state && state === 'true' || state === true || state === 1 || state === '1')
				$(checkbox).prop('checked', true);
			else if (state)
				$(checkbox).prop('checked', false);
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

		case 'numberformatcombobox':
			return '.uno:NumberFormatType';

		case 'fontsizecombobox':
			return '.uno:FontHeight';
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

		case 'numberformatcombobox':
			state = items.getItemValue('.uno:NumberFormatType');
			if (state) {
				return state;
			}
			break;

		case 'fontsizecombobox':
			state = items.getItemValue('.uno:FontHeight');
			if (state) {
				return state;
			}
			break;

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

		case 'fillattr':
			state = items.getItemValue('.uno:FillPageColor');
			if (state) {
				return state;
			}
			break;

		case 'fillattr2':
			state = items.getItemValue('.uno:FillPageGradient');
			if (state) {
				return state.startcolor;
			}
			break;

		case 'fillattr3':
			state = items.getItemValue('.uno:FillPageGradient');
			if (state) {
				return state.endcolor;
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
		}

		return null;
	},

	_getFieldFromId: function(id) {
		switch (id) {
		case 'aboveparaspacing':
			return 'upper';
		case 'belowparaspacing':
			return 'lower';
		case 'beforetextindent':
			return 'left';
		case 'aftertextindent':
			return 'right';
		case 'firstlineindent':
			return 'firstline';
		default:
			return id;
		}
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
		var controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);

		var updateFunction = function() {
			var value = builder._getUnoStateForItemId(data.id, builder);

			if (!value && data.text != undefined)
				value = data.text;
			else if (!value && data.children && data.children.length)
				value = data.children[0].text;

			$(controls.spinfield).attr('value', builder._cleanValueFromUnits(value));
		};

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === builder._mapWindowIdToUnoCommand(data.id))
				updateFunction();
		}, this);

		controls.spinfield.addEventListener('change', function() {
			if (customCallback)
				customCallback();
			else
				builder.callback('spinfield', 'set', controls.container, this.value, builder);
		});

		updateFunction();

		return false;
	},

	_formattedfieldControl: function(parentContainer, data, builder, customCallback) {
		var value, units, controls;

		// formatted control does not contain unit property
		units = data.text.split(' ');
		if (units.length == 2) {
			data.unit = units[1];
		}

		controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);

		builder.listenNumericChanges(data, builder, controls, customCallback);

		value = parseFloat(data.value);
		$(controls.spinfield).attr('value', value);

		return false;
	},


	_metricfieldControl: function(parentContainer, data, builder, customCallback) {
		var value;
		var controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);
		builder.listenNumericChanges(data, builder, controls, customCallback);

		value = parseFloat(data.value);
		$(controls.spinfield).attr('value', value);

		return false;
	},

	_editControl: function(parentContainer, data, builder, callback) {
		var edit = L.DomUtil.create('input', 'ui-edit ' + builder.options.cssClass, parentContainer);
		edit.value = builder._cleanText(data.text);
		edit.id = data.id;

		if (data.enabled === 'false' || data.enabled === false)
			$(edit).prop('disabled', true);

		edit.addEventListener('keyup', function() {
			if (callback)
				callback(this.value);
			else
				builder.callback('edit', 'change', edit, this.value, builder);
		});

		edit.addEventListener('click', function(e) {
			e.stopPropagation();
		});

		if (data.hidden)
			$(edit).hide();

		if (data.placeholder)
			$(edit).attr('placeholder', data.placeholder);

		return false;
	},

	_multiLineEditControl: function(parentContainer, data, builder, callback) {
		var controlType = 'textarea';
		if (data.cursor && (data.cursor === 'false' || data.cursor === false))
			controlType = 'p';

		var edit = L.DomUtil.create(controlType, 'ui-textarea ' + builder.options.cssClass, parentContainer);

		if (controlType === 'textarea')
			edit.value = builder._cleanText(data.text);
		else
		{
			data.text = data.text.replace(/(?:\r\n|\r|\n)/g, '<br>');
			edit.innerHTML = builder._cleanText(data.text);
		}

		edit.id = data.id;

		if (data.enabled === 'false' || data.enabled === false)
			$(edit).prop('disabled', true);

		edit.addEventListener('change', function() {
			if (callback)
				callback(this.value);
			else
				builder.callback('edit', 'change', edit, this.value, builder);
		});

		if (data.hidden)
			$(edit).hide();

		return false;
	},

	_customPushButtonTextForId: function(buttonId) {
		if (buttonId == 'validref')
			return _('Select range');

		return '';
	},

	_pushbuttonControl: function(parentContainer, data, builder, customCallback) {
		var wrapper = L.DomUtil.create('div', '', parentContainer); // need for freemium overlay
		var pushbutton = L.DomUtil.create('button', '', wrapper);
		var customText = builder._customPushButtonTextForId(data.id);
		pushbutton.innerHTML = customText !== '' ? customText : builder._cleanText(data.text);
		pushbutton.id = data.id;

		if (data.enabled === 'false' || data.enabled === false)
			$(pushbutton).prop('disabled', true);

		$(pushbutton).click(function () {
			if (customCallback)
				customCallback();
			else
				builder.callback('pushbutton', 'click', pushbutton, data.command, builder);
		});

		builder.map.disableFreemiumItem(data, wrapper, pushbutton);
		if (data.hidden)
			$(pushbutton).hide();

		return false;
	},

	_setIconAndNameForCombobox: function(data) {
		if (data.command == '.uno:CharFontName') {
			data.text = _('Font Name');
		} else if (data.command == '.uno:FontHeight') {
			data.text = _('Font Size');
		} else if (data.command == '.uno:StyleApply') {
			data.text = _('Style');
		}
	},

	_explorableEditControl: function(parentContainer, data, builder) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);
		$(sectionTitle).css('justify-content', 'space-between');
		if (data && data.id)
			sectionTitle.id = data.id;

		var leftDiv = L.DomUtil.create('div', 'ui-header-left combobox', sectionTitle);

		var editCallback = function(value) {
			builder.callback('combobox', 'change', data, value, builder);
		};
		builder._controlHandlers['edit'](leftDiv, data, builder, editCallback);

		var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);

		var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', rightDiv);
		arrowSpan.innerHTML = '>';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		contentDiv.title = data.text;

		var entries = [];
		if (data.entries) {
			for (var index in data.entries) {
				var style = 'ui-combobox-text';
				if ((data.selectedEntries && index == data.selectedEntries[0])
					|| data.entries[index] == data.text) {
					style += ' selected';
				}

				var entry = { type: 'comboboxentry', text: data.entries[index], pos: index, parent: data, style: style };
				entries.push(entry);
			}
		}

		var contentNode = {type: 'container', children: entries};

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		if (!data.nosubmenu)
		{
			$(contentDiv).hide();
			if (builder.wizard) {
				$(sectionTitle).click(function(event, data) {
					builder.wizard.goLevelDown(contentDiv, data);
					if (contentNode && contentNode.onshow)
						contentNode.onshow();
				});
			} else {
				console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}
		else
			$(sectionTitle).hide();
	},

	_comboboxControl: function(parentContainer, data, builder) {
		if (data.id === 'applystyle' ||
			data.id === 'fontnamecombobox' ||
			data.id === 'fontsizecombobox' ||
			data.id === 'fontsize' ||
			data.id === 'FontBox' ||
			data.id === 'rotation' ||
			data.id === 'LB_ANGLE' ||
			data.id === 'LB_DISTANCE') {
			builder._listboxControl(parentContainer, data, builder);
		} else if (data.id === 'searchterm' ||
			data.id === 'replaceterm') {
			// Replace combobox with edit in mobile find & replace dialog
			var callback = function(value) {
				builder.callback('combobox', 'change', data, value, builder);
			};

			builder._controlHandlers['edit'](parentContainer, data, builder, callback);
		}
		else
			builder._explorableEditControl(parentContainer, data, builder);
	},

	_listboxControl: function(parentContainer, data, builder) {
		var title = data.text;
		var selectedEntryIsString = false;
		if (data.selectedEntries) {
			selectedEntryIsString = isNaN(parseInt(data.selectedEntries[0]));
			if (title && title.length) {
				// pass
			} else if (selectedEntryIsString)
				title = builder._cleanText(data.selectedEntries[0]);
			else if (data.entries && data.entries.length > data.selectedEntries[0])
				title = data.entries[data.selectedEntries[0]];
		}
		title = builder._cleanText(title);

		var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-listbox-container ', parentContainer);
		container.id = data.id;

		var listbox = L.DomUtil.create('select', builder.options.cssClass + ' ui-listbox ', container);
		var listboxArrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', container);
		listboxArrow.id = 'listbox-arrow-' + data.id;

		if (data.enabled === false || data.enabled === 'false')
			$(listbox).attr('disabled', 'disabled');

		$(listbox).change(function() {
			builder.callback('combobox', 'selected', data, $(this).val()+ ';' + $(this).text(), builder);
		});

		if (typeof(data.entries) === 'object') {
			for (var index in data.entries) {
				var isSelected = false;
				if ((data.selectedEntries && index == data.selectedEntries[0])
					|| (data.selectedEntries && selectedEntryIsString && data.entries[index] === data.selectedEntries[0])
					|| data.entries[index] == title) {
					isSelected = true;
				}

				var option = L.DomUtil.create('option', '', listbox);
				option.value = index;
				option.innerText = data.entries[index];
				if (isSelected)
					option.selected = 'true';
			}
		}

		return false;
	},

	_treelistboxEntry: function (parentContainer, treeViewData, entry, builder) {
		if (entry.text == '<dummy>')
			return;

		var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

		var li = L.DomUtil.create('li', builder.options.cssClass, parentContainer);

		if (!disabled && entry.state == null) {
			li.draggable = true;

			li.ondragstart = function drag(ev) {
				ev.dataTransfer.setData('text', entry.row);
				builder.callback('treeview', 'dragstart', treeViewData, entry.row, builder);

				$('.ui-treeview').addClass('droptarget');
			};

			li.ondragend = function () { $('.ui-treeview').removeClass('droptarget'); };
			li.ondragover = function (event) { event.preventDefault(); };
		}

		var span = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-entry ' + (entry.children ? ' ui-treeview-expandable' : 'ui-treeview-notexpandable'), li);

		var expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander ', span);

		if (entry.selected && (entry.selected === 'true' || entry.selected === true))
			$(span).addClass('selected');

		if (entry.state) {
			var checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', span);
			checkbox.type = 'checkbox';

			if (entry.state === 'true' || entry.state === true)
				checkbox.checked = true;

			if (!disabled) {
				$(checkbox).change(function() {
					if (this.checked) {
						builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
					} else {
						builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
					}
				});
			}
		}

		var text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', span);
		text.innerText = entry.text;

		if (entry.children) {
			var ul = L.DomUtil.create('ul', builder.options.cssClass, li);
			for (var i in entry.children) {
				builder._treelistboxEntry(ul, treeViewData, entry.children[i], builder);
			}

			var toggleFunction = function() {
				$(span).toggleClass('collapsed');
			};

			if (!disabled) {
				if (entry.ondemand) {
					L.DomEvent.on(expander, 'click', function() {
						if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
							builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
						toggleFunction();
					});
				} else {
					$(expander).click(toggleFunction);
				}

				// block expand/collapse on checkbox
				if (entry.state)
					$(checkbox).click(toggleFunction);
			}

			if (entry.ondemand)
				L.DomUtil.addClass(span, 'collapsed');
		}

		if (!disabled && entry.state == null) {
			var singleClick = treeViewData.singleclickactivate === 'true' || treeViewData.singleclickactivate === true;
			$(text).click(function() {
				$('#' + treeViewData.id + ' .ui-treeview-entry').removeClass('selected');
				$(span).addClass('selected');

				builder.callback('treeview', 'select', treeViewData, entry.row, builder);
				if (singleClick) {
					builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
				}
			});

			if (!singleClick) {
				$(text).dblclick(function() {
					$('#' + treeViewData.id + ' .ui-treeview-entry').removeClass('selected');
					$(span).addClass('selected');

					builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
				});
			}
		}
	},

	_headerlistboxEntry: function (parentContainer, treeViewData, entry, builder) {
		var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

		if (entry.selected && (entry.selected === 'true' || entry.selected === true))
			$(parentContainer).addClass('selected');

		for (var i in entry.columns) {
			var td = L.DomUtil.create('td', '', parentContainer);
			td.innerText = entry.columns[i].text;

			if (!disabled) {
				$(td).click(function() {
					$('#' + treeViewData.id + ' .ui-listview-entry').removeClass('selected');
					$(parentContainer).addClass('selected');

					builder.callback('treeview', 'select', treeViewData, entry.row, builder);
				});
			}
		}
	},

	_treelistboxControl: function (parentContainer, data, builder) {
		var table = L.DomUtil.create('table', builder.options.cssClass + ' ui-treeview', parentContainer);
		table.id = data.id;

		var disabled = data.enabled === 'false' || data.enabled === false;
		if (disabled)
			L.DomUtil.addClass(table, 'disabled');

		var tbody = L.DomUtil.create('tbody', builder.options.cssClass + ' ui-treeview-body', table);

		var isHeaderListBox = data.headers && data.headers.length !== 0;
		if (isHeaderListBox) {
			var headers = L.DomUtil.create('tr', builder.options.cssClass + ' ui-treeview-header', tbody);
			for (var h in data.headers) {
				var header = L.DomUtil.create('th', builder.options.cssClass, headers);
				header.innerText = data.headers[h].text;
			}
		}

		if (!disabled) {
			tbody.ondrop = function (ev) {
				ev.preventDefault();
				var row = ev.dataTransfer.getData('text');
				builder.callback('treeview', 'dragend', data, row, builder);
				$('.ui-treeview').removeClass('droptarget');
			};

			tbody.ondragover = function (event) { event.preventDefault(); };
		}

		if (!data.entries || data.entries.length === 0) {
			L.DomUtil.addClass(table, 'empty');
			return false;
		}

		if (isHeaderListBox) {
			// list view with headers
			for (var i in data.entries) {
				var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
				builder._headerlistboxEntry(tr, data, data.entries[i], builder);
			}
		} else {
			// tree view
			var ul = L.DomUtil.create('ul', builder.options.cssClass, tbody);

			for (i in data.entries) {
				builder._treelistboxEntry(ul, data, data.entries[i], builder);
			}
		}

		return false;
	},

	_iconViewEntry: function (parentContainer, parentData, entry, builder) {
		var disabled = parentData.enabled === 'false' || parentData.enabled === false;

		if (entry.selected && (entry.selected === 'true' || entry.selected === true))
			$(parentContainer).addClass('selected');

		var icon = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-icon', parentContainer);
		var img = L.DomUtil.create('img', builder.options.cssClass, icon);
		if (entry.image)
			img.src = entry.image;
		img.alt = entry.text;

		var text = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-text', parentContainer);
		text.innerText = entry.text;

		if (!disabled) {
			$(parentContainer).click(function() {
				$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
				builder.callback('iconview', 'select', parentData, entry.row, builder);
			});
			$(parentContainer).dblclick(function() {
				$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
				builder.callback('iconview', 'activate', parentData, entry.row, builder);
			});
			builder._preventDocumentLosingFocusOnClick(parentContainer);
		}
	},

	_scrollIntoViewBlockOption: function(option) {
		if (option === 'nearest' || option === 'center') {
			// compatibility with older firefox
			var match = window.navigator.userAgent.match(/Firefox\/([0-9]+)\./);
			var firefoxVer = match ? parseInt(match[1]) : 58;
			var blockOption = firefoxVer >= 58 ? option : 'start';
			return blockOption;
		}

		return option;
	},

	_iconViewControl: function (parentContainer, data, builder) {
		var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview', parentContainer);
		container.id = data.id;

		var disabled = data.enabled === 'false' || data.enabled === false;
		if (disabled)
			L.DomUtil.addClass(container, 'disabled');

		for (var i in data.entries) {
			var entry = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-entry', container);
			builder._iconViewEntry(entry, data, data.entries[i], builder);
		}

		var firstSelected = $(container).children('.selected').get(0);
		var blockOption = builder._scrollIntoViewBlockOption('nearest');
		if (firstSelected)
			firstSelected.scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});

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
				image = 'url("' + L.LOUtil.getImageURL(image + '.svg') + '")';
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
		var fixedtext = L.DomUtil.create('p', builder.options.cssClass, parentContainer);
		fixedtext.innerHTML = builder._cleanText(data.text);
		fixedtext.parent = data.parent;

		if (data.style && data.style.length)
			L.DomUtil.addClass(fixedtext, data.style);

		$(fixedtext).click(function () {
			builder.refreshSidebar = true;
			builder.callback('combobox', 'selected', fixedtext.parent, data.pos + ';' + fixedtext.innerHTML, builder);
		});
	},

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('p', builder.options.cssClass, parentContainer);
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

	_separatorControl: function(parentContainer, data) {
		// don't create new control, style current parent

		L.DomUtil.addClass(parentContainer, 'ui-separator');
		if (data.orientation && data.orientation === 'vertical') {
			L.DomUtil.addClass(parentContainer, 'vertical');
		} else {
			L.DomUtil.addClass(parentContainer, 'horizontal');
		}

		return false;
	},

	_drawingAreaControl: function(parentContainer, data, builder) {
		if (data.image) {
			var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-drawing-area-container', parentContainer);
			container.id = data.id;

			var image = L.DomUtil.create('img', builder.options.cssClass + ' ui-drawing-area', container);
			image.src = data.image.replace(/\\/g, '');
			image.alt = data.text;
			image.title = data.text;
			builder.map.uiManager.enableTooltip(image);

			if (data.loading && data.loading === 'true') {
				var loaderContainer = L.DomUtil.create('div', 'ui-drawing-area-loader-container', container);
				L.DomUtil.create('div', 'ui-drawing-area-loader', loaderContainer);
			}
			if (data.placeholderText && data.placeholderText === 'true') {
				var spanContainer = L.DomUtil.create('div', 'ui-drawing-area-placeholder-container', container);
				var span = L.DomUtil.create('span', 'ui-drawing-area-placeholder', spanContainer);
				span.innerText = data.text;
			}
			L.DomEvent.on(image, 'click touchend', function(e) {
				var x = 0;
				var y = 0;

				if (e.offsetX) {
					x = e.offsetX;
					y = e.offsetY;
				} else if (e.changedTouches && e.changedTouches.length) {
					x = e.changedTouches[e.changedTouches.length-1].pageX - $(image).offset().left;
					y = e.changedTouches[e.changedTouches.length-1].pageY - $(image).offset().top;
				}

				var coordinates = (x / image.offsetWidth) + ';' + (y / image.offsetHeight);
				builder.callback('drawingarea', 'click', container, coordinates, builder);
			}, this);
		}
		return false;
	},

	_menubuttonControl: function(parentContainer, data, builder) {
		var ids = data.id.split(':');

		var menuId = null;
		if (ids.length > 1)
			menuId = ids[1];

		data.id = ids[0];

		if (menuId && builder._menus[menuId]) {
			var noLabels = builder.options.noLabelsForUnoButtons;
			builder.options.noLabelsForUnoButtons = false;

			// command is needed to generate image
			if (!data.command)
				data.command = menuId;

			var options = {hasDropdownArrow: true};
			var control = builder._unoToolButton(parentContainer, data, builder, options);

			$(control.container).tooltip({disabled: true});

			$(control.container).unbind('click');
			$(control.container).click(function () {
				$(control.container).w2menu({
					items: builder._menus[menuId],
					onSelect: function (event) {
						builder.map.sendUnoCommand('.uno:' + event.item.uno);
					}
				});
			});

			builder.options.noLabelsForUnoButtons = noLabels;
		} else if (data.text) {
			var button = L.DomUtil.create('div', 'menubutton ' + builder.options.cssClass, parentContainer);
			button.id = data.id;
			if (data.image) {
				var image = L.DomUtil.create('img', '', button);
				image.src = data.image;
			}
			var label = L.DomUtil.create('span', '', button);
			label.innerText = data.text;
			L.DomUtil.create('i', 'arrow', button);

			$(button).click(function () {
				builder.callback('menubutton', 'toggle', button, undefined, builder);
			});

			if (data.popup) {
				var popupJSON = data.popup;
				popupJSON.id = data.popup.id;
				popupJSON.jsontype = 'dialog';
				popupJSON.type = 'modalpopup';
				popupJSON.popupParent = data.id;
				popupJSON.cancellable = true;

				app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(popupJSON)});
			}
		} else {
			console.warn('Not found menu "' + menuId + '"');
		}

		return false;
	},

	_spinnerControl: function(parentContainer, data, builder) {
		var spinner = L.DomUtil.create('div', builder.options.cssClass + ' spinner', parentContainer);
		spinner.id = data.id;

		return false;
	},

	_spinnerImgControl: function(parentContainer, data, builder) {
		var svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svgElement.setAttribute('width', '298');
		svgElement.setAttribute('height', '192');
		// todo: change svg paths color depending on document type
		svgElement.innerHTML = '<defs> <linearGradient id="spinner-shadow-bottom-linearGradient" x1="131.73" x2="184.28" y1="124.94" y2="177.49" gradientUnits="userSpaceOnUse"> <stop stop-color="#e6e6e6" offset="0"/> <stop stop-color="#ccc" stop-opacity="0" offset="1"/> </linearGradient> <linearGradient id="spinner-shadow-top-linearGradient" x1="130.72" x2="203.26" y1="151.3" y2="118.61" gradientUnits="userSpaceOnUse"> <stop stop-color="#e6e6e6" offset="0"/> <stop stop-color="#b3b3b3" stop-opacity="0" offset="1"/> </linearGradient> <linearGradient id="spinner-paper-linearGradient" x1="166.04" x2="106.19" y1="71.233" y2="36.679" gradientUnits="userSpaceOnUse"> <stop stop-color="#b3d3e5" offset="0"/> <stop stop-color="#d9e9f2" offset="1"/> </linearGradient> <linearGradient id="spinner-paper-fold-linearGradient" x1="167.16" x2="175.12" y1="46.783" y2="51.379" gradientUnits="userSpaceOnUse"> <stop stop-color="#68a7ca" offset="0"/> <stop stop-color="#4290bd" offset="1"/> </linearGradient> <linearGradient id="spinner-inner-left-linearGradient" x1="114.56" x2="142.35" y1="103.94" y2="103.94" gradientUnits="userSpaceOnUse"> <stop stop-color="#4290bd" offset="0"/> <stop stop-color="#4290bd" stop-opacity="0" offset="1"/> </linearGradient> </defs> <g id="spinner-box-g" transform="translate(9.8904)"> <g id="spinner-shadow-g"> <path id="spinner-shadow-top" d="m196.39 151.18 16.366-9.4488-81.829-47.244-16.366 9.4488z" fill="url(#spinner-shadow-top-linearGradient)"/> <path id="spinner-shadow-bottom" d="m130.93 188.98 65.463-37.795 16.366 9.4488-65.463 37.795z" fill="url(#spinner-shadow-bottom-linearGradient)"/> </g> <path id="spinner-box-back" d="m130.93 56.693-65.463 37.795 65.463 37.795 65.463-37.795z" fill="#b4d3e4" fill-opacity=".97667"/> <g> <path id="spinner-box-f-right-bg" d="m130.93 132.28v56.693l65.463-37.795v-56.693z" fill="white"/> <path id="spinner-box-f-right" d="m130.93 132.28v56.693l65.463-37.795v-56.693z" fill="#8ebdd7"/> <path id="spinner-box-f-left" d="m130.93 132.28v56.693l-65.463-37.795v-56.693z" fill="#d9e9f2"/> <path id="spinner-inner-right-bg" d="m81.829 103.94 49.098-28.346 49.098 28.346-49.098 28.346z" fill="white"/> <path id="spinner-inner-right" d="m81.829 103.94 49.098-28.346 49.098 28.346-49.098 28.346z" fill="#68a7ca"/> <path id="spinner-inner-left-bg" d="m130.93 75.591v56.693l-49.098-28.346z" fill="white"/> <path id="spinner-inner-left" d="m130.93 75.591v56.693l-49.098-28.346z" fill="url(#spinner-inner-left-linearGradient)"/> </g> <path id="spinner-handle" d="m114.56 153.07-6.5463 3.7795-32.732-18.898 6.5463-3.7795" fill="none" stroke="#4290bd" stroke-linecap="round" stroke-width="3"/> </g> <g id="spinner-paper-g" transform="translate(9.8904)"> <path id="spinner-paper-bg" d="m130.93 18.898s-14.524 12.927-49.098 28.346l49.098 28.346c16.428-6.7073 29.159-14.202 37.537-19.8 7.5473-5.0432 6.4305-9.2141 6.4305-9.2141-0.42453-2.5692-4.7288-5.0245-4.7288-5.0245z" fill="white"/> <path id="spinner-paper" d="m130.93 18.898s-14.524 12.927-49.098 28.346l49.098 28.346c16.428-6.7073 29.159-14.202 37.537-19.8 7.5473-5.0432 6.4305-9.2141 6.4305-9.2141-0.42453-2.5692-4.7288-5.0245-4.7288-5.0245z" fill="url(#spinner-paper-linearGradient)"/> <path id="spinner-paper-fold-bg" d="m168.46 55.791c7.5473-5.0432-1.2989-9.0071-1.2989-9.0071-0.42453-2.5692 3.0006-5.2315 3.0006-5.2315 4.4877 2.646 4.7288 5.0245 4.7288 5.0245 1.0076 4.4201-6.4305 9.2141-6.4305 9.2141z" fill="white"/> <path id="spinner-paper-fold" d="m168.46 55.791c7.5473-5.0432-1.2989-9.0071-1.2989-9.0071-0.42453-2.5692 3.0006-5.2315 3.0006-5.2315 4.4877 2.646 4.7288 5.0245 4.7288 5.0245 1.0076 4.4201-6.4305 9.2141-6.4305 9.2141z" fill="url(#spinner-paper-fold-linearGradient)"/> </g>';
		var spinner = L.DomUtil.create('div', builder.options.cssClass + ' spinner-img ' + builder.map.getDocType() + '-doctype', parentContainer);
		spinner.appendChild(svgElement);
		spinner.id = data.id;

		return false;
	},

	_htmlControl: function(parentContainer, data, builder) {
		var container = L.DomUtil.create('div', builder.options.cssClass, parentContainer);
		container.appendChild(data.content);
		container.id = data.id;
		if (data.style && data.style.length) {
			L.DomUtil.addClass(container, data.style);
		}

		if (data.hidden)
			$(container).hide();

		return false;
	},

	_createComment: function(container, data, isRoot) {
		// This function changes the container of the comment div for mobile wizard view.
		// First, remove comment from its container.
		if (data.annotation.sectionProperties.wrapper) {
			if (data.annotation.sectionProperties.wrapper.parentElement) {
				data.annotation.sectionProperties.wrapper.parentElement.removeChild(data.annotation.sectionProperties.wrapper);
			}
		}

		data.annotation.sectionProperties.menu.isRoot = isRoot;
		// Now, add it into the container.
		container.appendChild(data.annotation.sectionProperties.wrapper);

		$(container).find('.loleaflet-annotation-menubar')[0].style.display = 'block';

		var replyCountNode = document.getElementById('reply-count-node-' + data.id);
		if (replyCountNode)
			replyCountNode.style.display = 'none';

		var arrowSpan = document.getElementById('arrow span ' + data.id);
		if (arrowSpan)
			arrowSpan.style.display = 'none';
	},

	_rootCommentControl: function(parentContainer, data, builder) {

		if (data.type === 'emptyCommentWizard') {
			builder._emptyCommentWizard(parentContainer, data, builder);
			return;
		}

		var mainContainer = document.getElementById('explorable-entry level-' + builder._currentDepth + ' ' + data.id);
		if (!mainContainer)
			mainContainer = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);

		mainContainer.id = 'explorable-entry level-' + builder._currentDepth + ' ' + data.id;

		var container = document.getElementById(data.id);
		if (!container)
			container = L.DomUtil.create('div',  'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);

		container.annotation = data.annotation;
		container.id = data.id;
		builder._createComment(container, data, true);
		if (data.children.length > 1 && mainContainer.id !== 'comment-thread' + data.id)
		{
			var numberOfReplies = data.children.length - 1;
			if (numberOfReplies > 0)
			{
				var replyCountNode = document.getElementById('reply-count-node-' + data.id);

				if (!replyCountNode)
					replyCountNode = L.DomUtil.create('div','loleaflet-annotation-reply-count loleaflet-annotation-content', $(container).find('.loleaflet-annotation-content-wrapper')[0]);

				replyCountNode.id = 'reply-count-node-' + data.id;
				replyCountNode.style.display = 'block';

				var replyCountText;
				if (numberOfReplies === 1) {
					replyCountText = numberOfReplies + ' ' + _('reply');
				}
				else {
					replyCountText = numberOfReplies + ' ' + _('replies');
				}
				$(replyCountNode).text(replyCountText);
			}

			var childContainer = document.getElementById('comment-thread' + data.id);

			if (!childContainer)
				childContainer = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, mainContainer);

			childContainer.id = 'comment-thread' + data.id;
			childContainer.title = _('Comment');

			$(childContainer).hide();

			if (builder.wizard) {
				$(container).find('.loleaflet-annotation-menubar')[0].style.display = 'none';

				var arrowSpan = document.getElementById('arrow span ' + data.id);

				if (!arrowSpan)
					arrowSpan = L.DomUtil.create('span','sub-menu-arrow',$(container).find('.loleaflet-annotation-content-wrapper')[0]);

				arrowSpan.style.display = 'block';
				arrowSpan.innerHTML = '>';
				arrowSpan.style.padding = '0px';
				arrowSpan.id = 'arrow span ' + data.id;

				container.onclick = function() {
					builder.wizard.goLevelDown(mainContainer);
					childContainer.style.display = 'block';
					builder.build(childContainer, data.children);
				};

				var backButton = document.getElementById('mobile-wizard-back');

				backButton.onclick = function () {
					if (backButton.className !== 'close-button') {
						builder.build(mainContainer, data);
						if (data.type === 'rootcomment') {
							var temp = document.getElementById('comment-thread' + data.id);
							if (temp)
								temp.style.display = 'block';
						}
					}
				};
			}
		}

		container.addEventListener('click', function() {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).hightlightComment(data.annotation);
		});
		return false;
	},

	_commentControl: function(parentContainer, data, builder) {
		builder._createComment(parentContainer, data, false);
		return false;
	},

	_emptyCommentWizard: function(parentContainer, data, builder) {
		var emptyCommentWizard = L.DomUtil.create('figure', 'empty-comment-wizard-container', parentContainer);
		var imgNode = L.DomUtil.create('img', 'empty-comment-wizard-img', emptyCommentWizard);
		imgNode.src = 'images/lc_showannotations.svg';
		imgNode.alt = data.text;
		var textNode = L.DomUtil.create('figcaption', 'empty-comment-wizard', emptyCommentWizard);
		textNode.innerText = data.text;
		L.DomUtil.create('br', 'empty-comment-wizard', textNode);
		if (this.map.isPermissionEditForComments()) {
			var linkNode = L.DomUtil.create('div', 'empty-comment-wizard-link', textNode);
			linkNode.innerText = _('Insert Comment');
			linkNode.onclick = builder.map.insertComment.bind(builder.map);
		}
	},

	_createIconURL: function(name) {
		if (!name)
			return '';

		var cleanName = name;
		var prefixLength = '.uno:'.length;
		if (name.substr(0, prefixLength) == '.uno:')
			cleanName = name.substr(prefixLength);
		cleanName = encodeURIComponent(cleanName).replace(/\%/g, '');
		return L.LOUtil.getImageURL('lc_' + cleanName.toLowerCase() + '.svg');
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

	_unoToolButton: function(parentContainer, data, builder, options) {
		var button = null;

		var controls = {};

		var div;
		if (data.command === '.uno:Paste' || data.command === '.uno:Cut' || data.command === '.uno:Copy') {
			var hyperlink = L.DomUtil.create('a', '', parentContainer);
			div = this._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', hyperlink, data);
		} else {
			div = this._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', parentContainer, data);
		}

		controls['container'] = div;

		if (data.command || data.postmessage === true) {
			var id = data.command ? encodeURIComponent(data.command.substr('.uno:'.length)).replace(/\%/g, '') : data.id;
			id = id.replace(/\./g, '-');
			div.id = id;

			var icon = data.icon ? data.icon : builder._createIconURL(data.command);
			var buttonId = id + 'img';

			button = L.DomUtil.create('img', 'ui-content unobutton', div);
			button.src = icon;
			button.id = buttonId;
			button.setAttribute('alt', id);

			controls['button'] = button;

			if (builder.options.noLabelsForUnoButtons !== true) {
				var label = L.DomUtil.create('span', 'ui-content unolabel', div);
				label.for = buttonId;
				label.innerHTML = builder._cleanText(data.text);

				controls['label'] = label;
				$(div).addClass('has-label');
			} else if (builder.options.useInLineLabelsForUnoButtons === true) {
				$(div).addClass('no-label');
			} else {
				div.title = data.text;
				builder.map.uiManager.enableTooltip(div);
				$(div).addClass('no-label');
			}

			if (builder.options.useInLineLabelsForUnoButtons === true) {
				$(div).addClass('inline');
				label = L.DomUtil.create('span', 'ui-content unolabel', div);
				label.for = buttonId;
				label.innerHTML = data.text;

				controls['label'] = label;
			}

			if (data.command) {
				var updateFunction = function() {
					var items = builder.map['stateChangeHandler'];
					var state = items.getItemValue(data.command);

					if (state && state === 'true') {
						$(button).addClass('selected');
						$(div).addClass('selected');
					}
					else {
						$(button).removeClass('selected');
						$(div).removeClass('selected');
					}

					if (state && state === 'disabled')
						$(div).addClass('disabled');
					else
						$(div).removeClass('disabled');
				};

				updateFunction();

				builder.map.on('commandstatechanged', function(e) {
					if (e.commandName === data.command)
						updateFunction();
				}, this);
			}
		} else {
			button = L.DomUtil.create('label', 'ui-content unolabel', div);
			button.innerHTML = builder._cleanText(data.text);
			controls['label'] = button;
		}

		if (options && options.hasDropdownArrow) {
			$(div).addClass('has-dropdown');
			var arrow = L.DomUtil.create('i', 'unoarrow', div);
			controls['arrow'] = arrow;
		}

		$(div).on('click.toolbutton',function (e) {
			if (!$(div).hasClass('disabled')) {
				builder.refreshSidebar = true;
				if (data.postmessage)
					builder.map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: data.id} });
				else
					builder.callback('toolbutton', 'click', button, data.command, builder);
			}
			e.preventDefault();
			e.stopPropagation();
		});

		builder._preventDocumentLosingFocusOnClick(div);

		if (data.enabled === 'false' || data.enabled === false)
			$(button).prop('disabled', true);
		if (window.mode.isMobile())
			builder.map.disableFreemiumItem(data, controls['container'], controls['container']);
		else
			builder.map.disableFreemiumItem(data, parentContainer, controls['container']);
		return controls;
	},

	_divContainerHandler: function (parentContainer, data, builder) {
		if (!(data.children && data.children.length))
			return false;

		var divElem = L.DomUtil.create('div', builder.options.cssClass, parentContainer);
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
		var colorSample = L.DomUtil.create('div', builder.options.cssClass + ' ' + sampleSizeClass, parentContainer);
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

	parseHexColor: function(color) {
		if (color === 'transparent')
			return -1;
		else
			return parseInt('0x' + color);
	},

	_sendColorCommand: function(builder, data, color) {
		var gradientItem;

		if (data.id === 'fillgrad1') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillGradient');
			gradientItem.startcolor = color;
			builder.map.sendUnoCommand('.uno:FillGradient?FillGradientJSON:string=' + JSON.stringify(gradientItem));
			return;
		} else if (data.id === 'fillgrad2') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillGradient');
			gradientItem.endcolor = color;
			builder.map.sendUnoCommand('.uno:FillGradient?FillGradientJSON:string=' + JSON.stringify(gradientItem));
			return;
		} else if (data.id === 'fillattr') {
			builder.map.sendUnoCommand('.uno:FillPageColor?Color:string=' + color);
			return;
		} else if (data.id === 'fillattr2') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillPageGradient');
			gradientItem.startcolor = color;
			builder.map.sendUnoCommand('.uno:FillPageGradient?FillPageGradientJSON:string=' + JSON.stringify(gradientItem));
			return;
		} else if (data.id === 'fillattr3') {
			gradientItem = builder.map['stateChangeHandler'].getItemValue('.uno:FillPageGradient');
			gradientItem.endcolor = color;
			builder.map.sendUnoCommand('.uno:FillPageGradient?FillPageGradientJSON:string=' + JSON.stringify(gradientItem));
			return;
		} else if (data.id === 'Color' || data.id === 'CharBackColor' || data.id === 'FillColor'
			|| data.id === 'XLineColor') {
			var params = {};
			params[data.id] = {
				type : 'long',
				value : builder.parseHexColor(color)
			};

			builder.map['stateChangeHandler'].setItemValue(data.command, params[data.id].value);
			builder.map.sendUnoCommand(data.command, params);
			return;
		} else if (data.id === 'LB_SHADOW_COLOR') {
			data.command = '.uno:FillShadowColor';
		}

		var command = data.command + '?Color:string=' + color;

		// update the item state as we send
		var items = builder.map['stateChangeHandler'];
		items.setItemValue(data.command, builder.parseHexColor(color));

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

	_formattingControl: function(parentContainer, data, builder) {
		var iconPath = builder._createIconURL(data.command);
		var sectionTitle = L.DomUtil.create('div', 'ui-header ' + builder.options.cssClass + ' level-' + builder._currentDepth + ' mobile-wizard-widebutton ui-widget', parentContainer);
		if (data.command === '.uno:FormatPaintbrush')
			sectionTitle.id = 'FormatPaintbrush';
		else
			sectionTitle.id = 'clearFormatting';
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

		sectionTitle.title = data.text;
		builder.map.uiManager.enableTooltip(sectionTitle);

		var updateFunction = function() {
			var items = builder.map['stateChangeHandler'];
			var state = items.getItemValue(data.command);

			if (state && state === 'disabled')
				$(sectionTitle).addClass('disabled');
			else
				$(sectionTitle).removeClass('disabled');
		};

		updateFunction();

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === data.command)
				updateFunction();
		}, this);

		if (builder.options.noLabelsForUnoButtons !== true) {
			var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);
			titleSpan.innerHTML =  builder._cleanText(_UNO(data.command));
		}

		$(sectionTitle).click(function () {
			builder.callback('toolbutton', 'click', sectionTitle, data.command, builder);
		});
		builder._preventDocumentLosingFocusOnClick(sectionTitle);
		return false;
	},

	_getCurrentBorderNumber: function(builder) {
		var outer = builder.map['stateChangeHandler'].getItemValue('.uno:BorderOuter');
		var inner = builder.map['stateChangeHandler'].getItemValue('.uno:BorderInner');

		if (!outer || !inner)
			return 0;

		var left = outer.left === 'true';
		var right = outer.right === 'true';
		var bottom = outer.bottom === 'true';
		var top = outer.top === 'true';
		var horiz = inner.horizontal === 'true';
		var vert = inner.vertical === 'true';

		if (left && !right && !bottom && !top && !horiz && !vert) {
			return 2;
		} else if (!left && right && !bottom && !top && !horiz && !vert) {
			return 3;
		} else if (left && right && !bottom && !top && !horiz && !vert) {
			return 4;
		} else if (!left && !right && !bottom && top && !horiz && !vert) {
			return 5;
		} else if (!left && !right && bottom && !top && !horiz && !vert) {
			return 6;
		} else if (!left && !right && bottom && top && !horiz && !vert) {
			return 7;
		} else if (left && right && bottom && top && !horiz && !vert) {
			return 8;
		} else if (!left && !right && bottom && top && horiz && !vert) {
			return 9;
		} else if (left && right && bottom && top && horiz && !vert) {
			return 10;
		} else if (left && right && bottom && top && !horiz && vert) {
			return 11;
		} else if (left && right && bottom && top && horiz && vert) {
			return 12;
		}

		return 1;
	},

	_borderControlItem: function(parentContainer, data, builder, i, selected) {
		var button = null;

		var div = this._createIdentifiable('div', 'ui-content unospan', parentContainer, data);

		var buttonId = 'border-' + i;
		button = L.DomUtil.create('img', 'ui-content borderbutton', div);
		button.src = L.LOUtil.getImageURL('fr0' + i + '.svg');
		button.id = buttonId;

		if (selected)
			$(button).addClass('selected');

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
		var bordercontrollabel = L.DomUtil.create('p', builder.options.cssClass + ' ui-text', parentContainer);
		bordercontrollabel.innerHTML = _('Cell borders');
		bordercontrollabel.id = data.id + 'label';
		var current = builder._getCurrentBorderNumber(builder);
		for (var i = 1; i < 13; ++i)
			builder._borderControlItem(parentContainer, data, builder, i, i === current);

		var updateFunction = function() {
			var current = builder._getCurrentBorderNumber(builder);
			for (var i = 1; i < 13; ++i) {
				if (i !== current)
					$('#border-' + i).removeClass('selected');
				else
					$('#border-' + i).addClass('selected');
			}

			if (builder.wizard && builder.wizard._refreshSidebar) {
				builder.wizard._refreshSidebar(0);
				builder.refreshSidebar = false;
			}
		};

		builder.map.on('commandstatechanged', function(e) {
			if (e.commandName === '.uno:BorderOuter' || e.commandName === '.uno:BorderInner')
				updateFunction();
		}, this);
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
			if (titleSpan) {
				if (data.id === 'fillattr')
					data.text = _('Background Color');
				else if (data.id === 'fillattr2')
					data.text = _('Gradient Start');
				else if (data.id === 'fillattr3')
					data.text = _('Gradient End');
				titleSpan.innerHTML = data.text;
			}
		}.bind(this);

		updateFunction(null);

		var iconPath = builder._createIconURL(data.command);
		var noColorControl = (data.command !== '.uno:FontColor' && data.command !== '.uno:Color');
		var autoColorControl = (data.command === '.uno:FontColor' || data.command === '.uno:Color');

		var callback = function(color) {
			builder._sendColorCommand(builder, data, color);
		};

		var colorPickerControl = new L.ColorPicker(
			valueNode,
			{
				selectedColor: selectedColor,
				noColorControl: noColorControl,
				autoColorControl: autoColorControl,
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

		var lineData = { min: 0.5, max: 5, id: 'linewidth', text: currentWidthText, enabled: data.enabled, readOnly: true };

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

			var command = '.uno:LineWidth';
			var params = {
				LineWidth: {
					type : 'long',
					value : (newValue * 100).toFixed(0)
				}
			};
			builder.map.sendUnoCommand(command, params);
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

		var menuEntry = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);

		if (data.hyperlink) {
			menuEntry = L.DomUtil.create('a', 'context-menu-link', menuEntry);
			menuEntry.href = '#';
		}

		var icon = null;
		var commandName = data.command && data.command.startsWith('.uno:') ? data.command.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, menuEntry);
			var iconURL = L.LOUtil.getImageURL('lc_' + iconName + '.svg');
			icon = L.DomUtil.create('img', '', iconSpan);
			icon.src = iconURL;
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
		var paddingClass = icon ? 'menu-entry-with-icon flex-fullwidth' : 'menu-entry-no-icon';
		L.DomUtil.addClass(titleSpan, paddingClass);

		if (builder.wizard) {
			$(menuEntry).click(function() {
				if (window.insertionMobileWizard)
					w2ui['actionbar'].click('insertion_mobile_wizard');
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

		builder.map.disableFreemiumItem(data, menuEntry, menuEntry);

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

		var buttonData = { text: _('Insert Table') };
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

	// executes actions like changing the selection without rebuilding the widget
	executeAction: function(container, data) {
		var control = container.querySelector('#' + data.control_id);
		if (!control) {
			console.warn('executeAction: not found control with id: "' + data.control_id + '"');
			return;
		}

		switch (data.action_type) {
		case 'select':
			$(control).children('.selected').removeClass('selected');

			var pos = parseInt(data.position);
			var entry = $(control).children().eq(pos);

			entry.addClass('selected');
			var blockOption = this._scrollIntoViewBlockOption('nearest');
			$(entry).get(0).scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});

			break;
		}
	},

	setupStandardButtonHandler: function(button, response, builder) {
		$(button).unbind('click');
		$(button).click(function () {
			builder.callback('responsebutton', 'click', {id: button.id }, response, builder);
		});
	},

	_amendJSDialogData: function(data) {
		// Called from build() which is already recursive,
		// so no need to recurse here over 'data'.
		this._addMissingLabels(data);
	},

	build: function(parent, data, hasVerticalParent, parentHasManyChildren) {
		this._amendJSDialogData(data);

		if (hasVerticalParent === undefined) {
			parent = L.DomUtil.create('div', 'root-container ' + this.options.cssClass, parent);
			parent = L.DomUtil.create('div', 'vertical ' + this.options.cssClass, parent);
		}

		var containerToInsert = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			var childType = childData.type;
			if (childType === 'toolbox' && !childData.id)
				continue;

			if (parentHasManyChildren) {
				if (!hasVerticalParent)
					var td = L.DomUtil.create('div', 'cell ' + this.options.cssClass, containerToInsert);
				else {
					containerToInsert = L.DomUtil.create('div', 'row ' + this.options.cssClass, parent);
					td = L.DomUtil.create('div', 'cell ' + this.options.cssClass, containerToInsert);
				}
			} else {
				td = containerToInsert;
			}

			if (childData.dialogid)
				td.id = childData.dialogid;

			var isVertical = childData.vertical === 'true' || childData.vertical === true ? true : false;

			this._parentize(childData);
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var hasManyChildren = childData.children && childData.children.length > 1;
			if (hasManyChildren && childData.type !== 'buttonbox') {
				var tableId = childData.id ? 'table-' + childData.id.replace(' ', '') : '';
				var table = L.DomUtil.createWithId('div', tableId, td);
				$(table).addClass(this.options.cssClass);
				$(table).addClass('vertical');
				var childObject = L.DomUtil.create('div', 'row ' + this.options.cssClass, table);
			} else {
				childObject = td;
			}

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
					console.warn('JSDialogBuilder: Unsupported control type: "' + childType + '"');

				if (childType === 'toolbox' && hasVerticalParent === true && childData.children.length === 1)
					this.options.useInLineLabelsForUnoButtons = true;

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children, isVertical, hasManyChildren);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
				}

				if ((childType === 'dialog' || childType === 'messagebox' || childType === 'modelessdialog')
					&& childData.responses) {
					for (var i in childData.responses) {
						var buttonId = childData.responses[i].id;
						var response = childData.responses[i].response;
						var button = parent.querySelector('[id=\'' + buttonId + '\']');
						if (button)
							this.setupStandardButtonHandler(button, response, this);
					}
				}

				this.options.useInLineLabelsForUnoButtons = false;
			}
		}
	}
});

L.Control.JSDialogBuilder.getMenuStructureForMobileWizard = function(menu, mainMenu, itemCommand) {
	if (itemCommand.indexOf('sep') >= 0)
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
