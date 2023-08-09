/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global app $ w2ui _ _UNO L JSDialog */

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
		// custom tabs placement handled by the parent container
		useSetTabs: false,

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
	_colorLastSelection: {},
	_decimal: '.',
	_minusSign: '-',

	// Responses are included in a parent container. While buttons are created, responses need to be checked.
	// So we save the button ids and responses to check them later.
	_responses: {}, // Button id = response

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

		// list of types which can have multiple children but are not considered as containers
		this._nonContainerType = ['buttonbox', 'treelistbox', 'iconview', 'combobox', 'listbox',
			'scrollwindow', 'grid', 'tabcontrol', 'multilineedit', 'formulabaredit', 'frame'];

		this._controlHandlers = {};
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['basespinfield'] = this.baseSpinField;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['metricfield'] = this._metricfieldControl;
		this._controlHandlers['formattedfield'] = this._formattedfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['formulabaredit'] = JSDialog.formulabarEdit;
		this._controlHandlers['multilineedit'] = JSDialog.multilineEdit;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['okbutton'] = this._pushbuttonControl;
		this._controlHandlers['helpbutton'] = this._pushbuttonControl;
		this._controlHandlers['cancelbutton'] = this._pushbuttonControl;
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
		this._controlHandlers['deck'] = this._deckHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['calcfuncpanel'] = this._calcFuncListPanelHandler;
		this._controlHandlers['tabcontrol'] = this._tabsControlHandler;
		this._controlHandlers['tabpage'] = this._tabPageHandler;
		this._controlHandlers['singlepanel'] = this._singlePanelHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['dialog'] = this._containerHandler;
		this._controlHandlers['messagebox'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._borderwindowHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._toolboxHandler;
		this._controlHandlers['toolitem'] = this._toolitemHandler;
		this._controlHandlers['colorsample'] = this._colorSampleControl;
		this._controlHandlers['divcontainer'] = this._divContainerHandler;
		this._controlHandlers['colorlistbox'] = this._colorControl;
		this._controlHandlers['borderstyle'] = this._borderControl;
		this._controlHandlers['treelistbox'] = JSDialog.treeView;
		this._controlHandlers['iconview'] = this._iconViewControl;
		this._controlHandlers['drawingarea'] = JSDialog.drawingArea;
		this._controlHandlers['rootcomment'] = this._rootCommentControl;
		this._controlHandlers['comment'] = this._commentControl;
		this._controlHandlers['emptyCommentWizard'] = this._rootCommentControl;
		this._controlHandlers['separator'] = this._separatorControl;
		this._controlHandlers['menubutton'] = JSDialog.menubuttonControl;
		this._controlHandlers['spinner'] = this._spinnerControl;
		this._controlHandlers['spinnerimg'] = this._spinnerImgControl;
		this._controlHandlers['image'] = this._imageHandler;
		this._controlHandlers['scrollwindow'] = JSDialog.scrolledWindow;
		this._controlHandlers['customtoolitem'] = this._mapDispatchToolItem;
		this._controlHandlers['bigcustomtoolitem'] = this._mapBigDispatchToolItem;
		this._controlHandlers['calendar'] = JSDialog.calendar;

		this._controlHandlers['mainmenu'] = this._containerHandler;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._menuItemHandlers = {};
		this._menuItemHandlers['inserttable'] = this._insertTableMenuItem;

		this._toolitemHandlers = {};
		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:CharBackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;

		this._toolitemHandlers['.uno:InsertFormula'] = function () {};
		this._toolitemHandlers['.uno:SetBorderStyle'] = function () {};

		this._menus = {};
		this._menus['AutoSumMenu'] = [
			{text: _('Sum'), uno: '.uno:AutoSum'},
			{text: _('Average'), uno: '.uno:AutoSum?Function:string=average'},
			{text: _('Min'), uno: '.uno:AutoSum?Function:string=min'},
			{text: _('Max'), uno: '.uno:AutoSum?Function:string=max'},
			{text: _('Count'), uno: '.uno:AutoSum?Function:string=count'}
		];
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
		this._menus['FormatSparklineMenu'] = [
			{text: _UNO('.uno:InsertSparkline', 'spreadsheet'), uno: '.uno:InsertSparkline'},
			{text: _UNO('.uno:DeleteSparkline', 'spreadsheet'), uno: '.uno:DeleteSparkline'},
			{text: _UNO('.uno:DeleteSparklineGroup', 'spreadsheet'), uno: '.uno:DeleteSparklineGroup'},
			{text: _UNO('.uno:EditSparklineGroup', 'spreadsheet'), uno: '.uno:EditSparklineGroup'},
			{text: _UNO('.uno:EditSparkline', 'spreadsheet'), uno: '.uno:EditSparkline'},
			{text: _UNO('.uno:GroupSparklines', 'spreadsheet'), uno: '.uno:GroupSparklines'},
			{text: _UNO('.uno:UngroupSparklines', 'spreadsheet'), uno: '.uno:UngroupSparklines'}
		];
		this._menus['MenuPrintRanges'] = [
			{text: _UNO('.uno:DefinePrintArea', 'spreadsheet'), uno: '.uno:DefinePrintArea'},
			{text: _UNO('.uno:AddPrintArea', 'spreadsheet'), uno: '.uno:AddPrintArea'},
			{text: _UNO('.uno:EditPrintArea', 'spreadsheet'), uno: '.uno:EditPrintArea'},
			{text: _UNO('.uno:DeletePrintArea', 'spreadsheet'), uno: '.uno:DeletePrintArea'}
		];
		this._menus['MenuRowHeight'] = [
			{text: _UNO('.uno:RowHeight', 'spreadsheet'), uno: '.uno:RowHeight'},
			{text: _UNO('.uno:SetOptimalRowHeight', 'spreadsheet'), uno: '.uno:SetOptimalRowHeight'},
		];
		this._menus['MenuColumnWidth'] = [
			{text: _UNO('.uno:ColumnWidth', 'spreadsheet'), uno: '.uno:ColumnWidth'},
			{text: _UNO('.uno:SetOptimalColumnWidth', 'spreadsheet'), uno: '.uno:SetOptimalColumnWidth'},
		];
		this._menus['FormattingMarkMenu'] = [
			{text: _UNO('.uno:InsertNonBreakingSpace', 'text'), uno: 'InsertNonBreakingSpace'},
			{text: _UNO('.uno:InsertHardHyphen', 'text'), uno: 'InsertHardHyphen'},
			{text: _UNO('.uno:InsertSoftHyphen', 'text'), uno: 'InsertSoftHyphen'},
			{text: _UNO('.uno:InsertZWSP', 'text'), uno: 'InsertZWSP'},
			{text: _UNO('.uno:InsertWJ', 'text'), uno: 'InsertWJ'},
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

		this._currentDepth = 0;

		if (typeof Intl !== 'undefined') {
			var formatter = new Intl.NumberFormat(L.Browser.lang);
			var that = this;
			formatter.formatToParts(-11.1).map(function(item) {
				switch (item.type) {
				case 'decimal':
					that._decimal = item.value;
					break;
				case 'minusSign':
					that._minusSign = item.value;
					break;
				}
			});
		}
	},

	reportValidity: function() {
		var isValid = true;
		if (!this._container)
			return isValid;

		var inputs = this._container.querySelectorAll('input[type="number"]');
		for (var item = 0; item < inputs.length; item++) {
			isValid = inputs[item].reportValidity();
			if (!isValid)
				break;
		}

		return isValid;
	},

	isContainerType: function(type) {
		return this._nonContainerType.indexOf(type) < 0;
	},

	setContainer: function(container) {
		this._container = container;
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
			else if (data.text || data.command) {
				builder._unoToolButton(parentContainer, data, builder);
			} else
				window.app.console.warn('Unsupported toolitem type: "' + data.command + '"');
		}

		builder.postProcess(parentContainer, data);

		return false;
	},

	_preventNonNumericalInput: function(e) {
		e = e || window.event;
		var charCode = (typeof e.which == 'undefined') ? e.keyCode : e.which;
		var charStr = String.fromCharCode(charCode);
		var regex = new RegExp('^[0-9\\' + this._decimal + '\\' + this._minusSign + ']+$');
		if (!charStr.match(regex))
			return e.preventDefault();

		var value = e.target.value;
		if (!value)
			return e.preventDefault();

		// no dup
		if (this._decimal === charStr || this._minusSign === charStr) {
			if (value.indexOf(charStr) > -1)
				return e.preventDefault();
		}
	},

	// by default send new state to the core
	_defaultCallbackHandler: function(objectType, eventType, object, data, builder) {
		if (builder.map.uiManager.isUIBlocked())
			return;

		if (objectType === 'responsebutton' && data === 1 && !builder.reportValidity())
			return;

		window.app.console.debug('control: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

		if (builder.wizard.setCurrentScrollPosition)
			builder.wizard.setCurrentScrollPosition();

		if (objectType == 'toolbutton' && eventType == 'click' && data.indexOf('.uno:') >= 0) {
			// encode spaces
			var encodedCommand = data.replace(' ', '%20');
			builder.map.sendUnoCommand(encodedCommand);
		} else if (object) {
			// CSV and Macro Security Warning Dialogs are shown before the document load
			// In that state the document is not really loaded and closing or cancelling it
			// returns docnotloaded error. Instead of this we can return to the integration
			if (!builder.map._docLoaded &&
				 !window._firstDialogHandled &&
				 ((object.id === 'cancel' || eventType === 'close') ||
				 (objectType === 'responsebutton' && (data == 0 || data == 7)))) {
				window.onClose();
			}
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
			window._firstDialogHandled = true;
		}
	},

	baseSpinField: function(parentContainer, data, builder, customCallback) {
		var controls = {};
		if (data.label) {
			var fixedTextData = { text: data.label };
			builder._fixedtextControl(parentContainer, fixedTextData, builder);
		}

		var div = L.DomUtil.create('div', builder.options.cssClass + ' spinfieldcontainer', parentContainer);
		div.id = data.id;
		controls['container'] = div;

		var spinfield = L.DomUtil.create('input', builder.options.cssClass + ' spinfield', div);
		spinfield.id = data.id + '-input';
		spinfield.type = 'number';
		spinfield.dir = document.documentElement.dir;
		spinfield.tabIndex = '0';
		controls['spinfield'] = spinfield;

		if (data.labelledBy)
			spinfield.setAttribute('aria-labelledby', data.labelledBy);

		if (data.unit && data.unit !== ':') {
			var unit = L.DomUtil.create('span', builder.options.cssClass + ' spinfieldunit', div);
			unit.textContent = builder._unitToVisibleString(data.unit);
		}

		var getPrecision = function (data) {
			data = Math.abs(data);
			var counter = 1;

			while (Math.floor(data * counter) < (data * counter))
				counter *= 10;

			return 1/counter;
		};

		if (data.min != undefined)
			$(spinfield).attr('min', data.min);

		if (data.max != undefined)
			$(spinfield).attr('max', data.max);

		if (data.step != undefined) {
			// we don't want to show error popups due to browser step validation
			// so be sure all the values will be acceptted, check only precision
			var step = getPrecision(data.step);
			var value = data.value ? getPrecision(data.value) : 1;
			var minStep = getPrecision(data.min);
			var maxStep = getPrecision(data.max);

			step = Math.min(step, value, minStep, maxStep);

			$(spinfield).attr('step', step);
		}

		if (data.enabled === 'false' || data.enabled === false) {
			$(spinfield).attr('disabled', 'disabled');
		}

		if (data.readOnly === true)
			$(spinfield).attr('readOnly', 'true');

		if (data.hidden)
			$(spinfield).hide();

		spinfield.addEventListener('change', function() {
			var attrdisabled = $(spinfield).attr('disabled');
			var isValid = this.checkValidity();
			if (attrdisabled !== 'disabled' && isValid) {
				if (customCallback)
					customCallback('spinfield', 'change', div, this.value, builder);
				else
					builder.callback('spinfield', 'change', div, this.value, builder);
			}
		});

		return controls;
	},

	listenNumericChanges: function (data, builder, controls, customCallback) {
		controls.spinfield.addEventListener('change', function() {
			if (!this.checkValidity())
				return;

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

	_stressAccessKey: function(element, accessKey) {
		if (!accessKey)
			return;

		var text = element.textContent;
		var index = text.indexOf(accessKey);
			if (index >= 0) {
					var title = text.replace(accessKey, '<u class="access-key">' + accessKey.replace('~', '') + '</u>');
					element.innerHTML = title;
		}
	},

	_setAccessKey: function(element, key) {
		if (key)
				element.accessKey = key;
	},

	_getAccessKeyFromText: function(text) {
		var nextChar = null;
		if (text && text.includes('~')) {
			var index = text.indexOf('~');
			if (index < text.length - 1) {
				nextChar = text.charAt(index + 1);
			}
		}
		return nextChar;
	},

	_cleanText: function(text) {
		if (!text)
			return '';
		if (text.endsWith('...'))
			text = text.slice(0, -3);
		return text.replace('~', '');
	},

	_extractUnits: function(text) {
		if (!text)
			return '';

		return text.replace(/[\d.-]/g, '').trim();
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

	_toolboxHandler: function(parentContainer, data, builder) {
		var toolbox = L.DomUtil.create('div', builder.options.cssClass + ' toolbox', parentContainer);
		toolbox.id = data.id;

		if (data.enabled === false || data.enabled === 'false') {
			for (var index in data.children) {
				data.children[index].enabled = false;
			}
		}

		var noLabels = builder.options.noLabelsForUnoButtons;
		builder.options.noLabelsForUnoButtons = true;

		builder.build(toolbox, data.children, false, false);

		builder.options.noLabelsForUnoButtons = noLabels;

		return false;
	},

	_borderwindowHandler: function(parentContainer, data, builder) {
		if (data.visible === false) {
			for (var i in data.children)
				data.children[i].visible = false;
		}

		return builder._containerHandler(parentContainer, data, builder);
	},

	_handleResponses: function(data, builder) {
		// Dialogue is a parent container of a buttonbox, so we will save the responses first, then we will check them while creating the buttons.
		if (data.responses) {
			for (var i in data.responses) {
				// Button id = response
				builder._responses[data.responses[i].id] = data.responses[i].response;
			}
		}
	},

	_containerHandler: function(parentContainer, data, builder) {
		if (data.cols && data.rows) {
			return builder._gridHandler(parentContainer, data, builder);
		}

		if (parentContainer && !parentContainer.id)
			parentContainer.id = data.id;

		return true;
	},

	// used inside tab control and assistant (chart wizard, where it should create own container)
	_tabPageHandler: function(parentContainer, data, builder) {
		var page = L.DomUtil.create('div', builder.options.cssClass + ' ui-tabpage', parentContainer);
		page.id = data.id;

		builder.build(page, data.children, false);

		return false;
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

		var processedChildren = [];

		var table = L.DomUtil.create('div', builder.options.cssClass + ' ui-grid', parentContainer);
		table.id = data.id;

		var gridRowColStyle = 'grid-template-rows: repeat(' + rows  + ', auto); \
			grid-template-columns: repeat(' + cols  + ', auto);';

		table.style = gridRowColStyle;

		for (var row = 0; row < rows; row++) {
			var prevChild = null;

			for (var col = 0; col < cols; col++) {
				var child = builder._getGridChild(data.children, row, col);
				var isMergedCell = prevChild && prevChild.width
					&& parseInt(prevChild.left) + parseInt(prevChild.width) > col;

				if (child) {
					if (!child.id || child.id === '') // required for postprocess...
						child.id = table.id + '-cell-' + row + '-' + col;

					var sandbox = L.DomUtil.create('div');
					builder.build(sandbox, [child], false);

					var control = sandbox.firstChild;
					if (control) {
						L.DomUtil.addClass(control, 'ui-grid-cell');
						table.appendChild(control);
					}

					processedChildren.push(child);
					prevChild = child;
				} else if (!isMergedCell) {
					// empty placeholder to keep correct order
					L.DomUtil.create('div', 'ui-grid-cell', table);
				}

			}
		}

		for (var i = 0; i < (data.children || []).length; i++) {
			child = data.children[i];
			if (processedChildren.indexOf(child) === -1) {
				sandbox = L.DomUtil.create('div');
				builder.build(sandbox, [child], false);
				control = sandbox.firstChild;
				if (control) {
					L.DomUtil.addClass(control, 'ui-grid-cell');
					table.appendChild(control);
				}
				processedChildren.push(child);
			}
		}

		return false;
	},

	_buttonBox: function(parentContainer, data, builder) {
		var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box '
												+ (data.layoutstyle ? data.layoutstyle : ''), parentContainer);
		container.id = data.id;

		var isButtonBoxLeft = data.leftaligned === 'true';
		var leftAlignButtons = [];
		var rightAlignButton = [];

		for (var i in data.children) {
			var child = data.children[i];
			if (child.id === 'help' || isButtonBoxLeft === true)
				leftAlignButtons.push(child);
			else
				rightAlignButton.push(child);
		}

		var left = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box-left', container);

		for (i in leftAlignButtons) {
			child = leftAlignButtons[i];
			if (builder._controlHandlers[child.type]) {
				builder._controlHandlers[child.type](left, child, builder);
				builder.postProcess(left, child);
			}
		}

		var right = L.DomUtil.create('div', builder.options.cssClass + ' ui-button-box-right', container);
		if (data.layoutstyle && data.layoutstyle === 'end')
			L.DomUtil.addClass(container, 'end');

		for (i in rightAlignButton) {
			child = rightAlignButton[i];
			if (builder._controlHandlers[child.type]) {
				builder._controlHandlers[child.type](right, child, builder);
				builder.postProcess(right, child);
			}
		}

		if (data.vertical === 'true' || data.vertical === true) {
			left.style.display = 'grid';
			left.style.margin = 'auto';
			right.style.display = 'grid';
			right.style.margin = 'auto';
		}

		return false;
	},

	_explorableEntry: function(parentContainer, data, content, builder, valueNode, iconURL, updateCallback) {
		var mainContainer = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		if (data && data.id)
			mainContainer.id = data.id;

		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);
		$(sectionTitle).css('justify-content', 'space-between');

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
			iconURL = L.LOUtil.getImageURL('lc_'+ sectionTitle.id.toLowerCase() +'.svg', builder.map.getDocType());
			break;
		}
		if (iconURL) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			L.LOUtil.setImage(icon, iconURL.split('/').pop(), builder.map.getDocType());
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
		arrowSpan.textContent = '>';

		var updateFunction = function(titleSpan) {
			titleSpan.innerHTML = data.text;
		};

		updateCallback ? updateCallback(titleSpan) : updateFunction(titleSpan);

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, mainContainer);
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
						builder.wizard.goLevelDown(mainContainer, data);
						if (contentNode && contentNode.onshow && !builder.wizard._inBuilding)
							contentNode.onshow();
					});
				} else {
					$(arrowSpan).hide();
				}
			} else {
				window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}
		else
			$(sectionTitle).hide();
	},

	_calcFunctionEntry: function(parentContainer, data, contentNode, builder) {
		var mainContainer = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		var sectionTitle = L.DomUtil.create('div', 'func-entry ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);
		$(sectionTitle).css('justify-content', 'space-between');
		if (data && data.id)
			sectionTitle.id = data.id;

		var leftDiv = L.DomUtil.create('div', 'ui-header-left', sectionTitle);
		var titleClass = 'func-name';
		var titleSpan = L.DomUtil.create('span', titleClass, leftDiv);
		titleSpan.textContent = data.text;

		var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);
		var arrowSpan = L.DomUtil.create('div', 'func-info-icon', rightDiv);
		arrowSpan.textContent = '';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, mainContainer);
		contentDiv.title = data.text;

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		if (builder.wizard) {
			var that = this;
			var functionName = data.functionName;
			$(rightDiv).click(function() {
				builder.wizard.goLevelDown(mainContainer);
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
			window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_expanderHandler: function(parentContainer, data, builder, customCallback) {
		if (data.children.length > 0) {
			var container = L.DomUtil.create('div', 'ui-expander-container ' + builder.options.cssClass, parentContainer);
			container.id = data.id;

			var expanded = data.expanded === true || (data.children[0] && data.children[0].checked === true);
			if (data.children[0].text && data.children[0].text !== '') {
				var expander = L.DomUtil.create('div', 'ui-expander ' + builder.options.cssClass, container);
				expander.tabIndex = '0';
				var label = L.DomUtil.create('span', 'ui-expander-label ' + builder.options.cssClass, expander);
				label.innerText = builder._cleanText(data.children[0].text);
				label.id = data.children[0].id ? data.children[0].id : data.id + '-label';
				if (data.children[0].visible === false)
					L.DomUtil.addClass(label, 'hidden');
				builder.postProcess(expander, data.children[0]);

				if (data.children.length > 1 && expanded)
					$(label).addClass('expanded');

				var toggleFunction = function () {
					if (customCallback)
						customCallback();
					else
						builder.callback('expander', 'toggle', data, null, builder);
					$(label).toggleClass('expanded');
					$(expander).siblings().toggleClass('expanded');
				};

				$(expander).click(toggleFunction);
				$(expander).keypress(function (event) {
					if (event.which === 13) {
						toggleFunction();
						event.preventDefault();
					}
				});
			}

			var expanderChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, container);

			if (expanded)
				$(expanderChildren).addClass('expanded');

			var children = [];
			var startPos = 1;

			if (data.children[0].type === 'grid' ||
				data.children[0].type === 'container') {
				startPos = 0;
			}

			for (var i = startPos; i < data.children.length; i++) {
				if (data.children[i].visible === false)
					data.children[i].visible = true;
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
		if (commandName.indexOf('?') === -1) {
			if (commandName.indexOf('InsertDateContentControl') !== -1)
				return 'insertdatefield';
			return commandName.toLowerCase();
		}

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
		var mainContainer = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		var commandName = dataid;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, sectionTitle);
			var iconURL = builder._createIconURL(iconName, true);
			icon = L.DomUtil.create('img', '', iconSpan);
			L.LOUtil.setImage(icon, iconURL.split('/').pop(), builder.map.getDocType());
			icon.alt = '';
			var titleSpan2 = L.DomUtil.create('span', 'menu-entry-with-icon flex-fullwidth', sectionTitle);
			titleSpan2.innerHTML = title;
		}
		else {
			var titleSpan = L.DomUtil.create('span', 'sub-menu-title', sectionTitle);
			titleSpan.innerHTML = title;
		}
		var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', sectionTitle);
		arrowSpan.textContent = '>';

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, mainContainer);
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
			$(sectionTitle).click(function() { builder.wizard.goLevelDown(mainContainer); });
		} else {
			window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	},

	_frameHandler: function(parentContainer, data, builder) {
		if (data.children.length > 1) {
			var container = L.DomUtil.create('div', 'ui-frame-container ' + builder.options.cssClass, parentContainer);
			container.id = data.id;

			var frame = L.DomUtil.create('div', 'ui-frame ' + builder.options.cssClass, container);
			frame.id = data.id + '-frame';
			var label = L.DomUtil.create('label', 'ui-frame-label ' + builder.options.cssClass, frame);
			label.innerText = builder._cleanText(data.children[0].text);
			label.id = data.children[0].id;
			if (data.children[0].visible === false)
				L.DomUtil.addClass(label, 'hidden');
			builder.postProcess(frame, data.children[0]);

			var frameChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, container);
			frameChildren.id = data.id + '-content';
			label.htmlFor = frameChildren.id;
			$(frameChildren).addClass('expanded');

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

	_deckHandler: function(parentContainer, data, builder) {
		var deck = L.DomUtil.create('div', 'deck ' + builder.options.cssClass, parentContainer);
		deck.id = data.id;

		for (var i = 0; i < data.children.length; i++) {
			builder.build(deck, [data.children[i]]);
		}

		return false;
	},

	_panelHandler: function(parentContainer, data, builder) {
		// we want to show the contents always, hidden property decides if we collapse the panel
		if (data.children && data.children.length)
			data.children[0].visible = true;

		data.type = 'expander';
		data.children = [{text: data.text}].concat(data.children);
		data.id = data.id + 'PanelExpander';
		builder._expanderHandler(parentContainer, data, builder, function() {});

		var expander = $(parentContainer).children('#' + data.id);
		if (data.hidden === 'true' || data.hidden === true)
			expander.hide();

		if (data.command) {
			var iconParent = expander.children('.ui-expander').get(0);
			var icon = L.DomUtil.create('div', 'ui-expander-icon-right ' + builder.options.cssClass, iconParent);
			builder._controlHandlers['toolitem'](icon, {type: 'toolitem', command: data.command, icon: builder._createIconURL('morebutton')}, builder);
		}

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
			tabs[t].tabIndex = '0';
			tabs[t].setAttribute('aria-selected', 'true');

			for (var i = 0; i < tabs.length; i++) {
				if (i !== t)
				{
					$(tabs[i]).removeClass('selected');
					$(contentDivs[i]).addClass('hidden');
					tabs[i].setAttribute('aria-selected', 'false');
					tabs[i].tabIndex = -1;
				}
			}
			$(contentDivs[t]).removeClass('hidden');
			builder.wizard.selectedTab(tabIds[t]);
		};
	},

	_tabsControlHandler: function(parentContainer, data, builder, tabTooltip) {
		if (tabTooltip === undefined) {
			tabTooltip = '';
		}
		if (data.tabs) {
			var tabs = 0;
			for (var tabIdx = 0; data.children && tabIdx < data.children.length; tabIdx++) {
				if (data.children[tabIdx].type === 'tabpage')
					tabs++;
			}
			var isMultiTabJSON = tabs > 1;

			var tabWidgetRootContainer = L.DomUtil.create('div', 'ui-tabs-root ' + builder.options.cssClass + ' ui-widget', parentContainer);
			tabWidgetRootContainer.id = data.id;

			var tabsContainer = L.DomUtil.create('div', 'ui-tabs ' + builder.options.cssClass + ' ui-widget', builder.options.useSetTabs ? undefined : tabWidgetRootContainer);
			tabsContainer.setAttribute('role', 'tablist');

			var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content ' + builder.options.cssClass + ' ui-widget', tabWidgetRootContainer);

			var tabs = [];
			var contentDivs = [];
			var tabIds = [];
			var singleTabId = null;
			for (var tabIdx = 0; tabIdx < data.tabs.length; tabIdx++) {
				var item = data.tabs[tabIdx];

				var title = builder._cleanText(item.text);

				var tab = L.DomUtil.create('button', 'ui-tab ' + builder.options.cssClass, tabsContainer);
				tab.id = item.name + '-tab-label';
				tab.number = item.id - 1;
				tab.textContent = title;
				tab.setAttribute('role', 'tab');
				tab.setAttribute('aria-label', title);
				builder._setAccessKey(tab, builder._getAccessKeyFromText(item.text));
				builder._stressAccessKey(tab, tab.accessKey);

				var isSelectedTab = data.selected == item.id;
				if (isSelectedTab) {
					$(tab).addClass('selected');
					tab.setAttribute('aria-selected', 'true');
					tab.tabIndex = '0';
					tab.title = tabTooltip;
					singleTabId = tabIdx;
				} else {
					tab.setAttribute('aria-selected', 'false');
					tab.tabIndex = -1;
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

				var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, contentsContainer);
				contentDiv.id = item.name;
				contentDiv.setAttribute('role', 'tabpanel');

				if (!isSelectedTab)
					$(contentDiv).addClass('hidden');
				contentDivs[tabIdx] = contentDiv;
			}

			if (builder.wizard) {
				if (builder.options.useSetTabs)
					builder.wizard.setTabs(tabsContainer, builder);

				tabs.forEach(function (tab, index) {
					tab.addEventListener('click', function(event) {
						builder._createTabClick(builder, index, tabs, contentDivs, tabIds)(event);
						if (data.tabs[index].id - 1 >= 0)
							builder.callback('tabcontrol', 'selecttab', tabWidgetRootContainer, index, builder);
					});
				});

				var isTabVisible = function (tab) {
					return !$(tab).hasClass('hidden');
				};

				var findNextVisibleTab = function (tab, backwards) {
					var diff = (backwards ? -1 : 1);
					var nextTab = tabs[tabs.indexOf(tab) + diff];

					while (!isTabVisible(nextTab) && nextTab != tab) {
						if (backwards && tabs.indexOf(nextTab) == 0)
							nextTab = tabs[tabs.length - 1];
						else if (!backwards && tabs.indexOf(nextTab) == tabs.length - 1)
							nextTab = tabs[0];
						else
							nextTab = tabs[tabs.indexOf(nextTab) + diff];
					}

					return nextTab;
				};

				var moveFocusToPreviousTab = function(tab) {
					if (tab === tabs[0]) {
						tabs[tabs.length - 1].click();
						tabs[tabs.length - 1].focus();
					}
					else {
						var nextTab = findNextVisibleTab(tab, true);
						nextTab.click();
						nextTab.focus(); // We add this or document gets the focus.
					}
				};

				var moveFocusToNextTab = function(tab) {
					if (tab === tabs[tabs.length - 1]) {
						tabs[0].click();
						tabs[0].focus();
					}
					else {
						var nextTab = findNextVisibleTab(tab, false);
						nextTab.click();
						nextTab.focus(); // We add this or document gets the focus.
					}
				};

				// We are adding this to distinguish "enter" key from real click events.
				tabs.forEach(function (tab)
					{
						tab.addEventListener('keydown', function(e) {
							var currentTab = e.currentTarget;

							switch (e.key) {
							case 'ArrowLeft':
								moveFocusToPreviousTab(currentTab);
								break;

							case 'ArrowRight':
								moveFocusToNextTab(currentTab);
								break;

							case 'Home':
							{
								var firstTab = tabs[0];
								if (!isTabVisible(firstTab))
									firstTab = findNextVisibleTab(firstTab, false);
								firstTab.focus();
								break;
							}

							case 'End':
							{
								var lastTab = tabs[tabs.length - 1];
								if (!isTabVisible(lastTab))
									lastTab = findNextVisibleTab(lastTab, true);
								lastTab.focus();
								break;
							}

							case 'Enter':
							case ' ':
								tab.enterPressed = true;
								break;

							case 'Escape':
								builder.map.focus();
								break;
							}
						});
					}
				);
			} else {
				window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}

		if (isMultiTabJSON) {
			var tabId = 0;
			for (var tabIdx = 0; tabIdx < data.children.length; tabIdx++) {
				var tab = data.children[tabIdx];

				if (tab.type !== 'tabpage')
					continue;

				builder.build(contentDivs[tabId], [tab], false, false);
				tabId++;
			}

			return false;
		} else {
			for (var tabIdx = 0; tabIdx < data.children.length; tabIdx++) {
				var tab = data.children[tabIdx];

				if (tab.type !== 'tabpage')
					continue;

				builder.build(contentDivs[singleTabId], [tab], false, false);
				break;
			}

			return false;
		}
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
		radiobutton.id = data.id + '-input';
		radiobutton.tabIndex = '0';

		if (data.image) {
			var image = L.DomUtil.create('img', '', radiobutton);
			image.src = data.image;
			L.DomUtil.addClass(container, 'has-image');
		}

		if (data.group)
			radiobutton.name = data.group;

		var radiobuttonLabel = L.DomUtil.createWithId('label', data.id + '-label', container);
		radiobuttonLabel.textContent = builder._cleanText(data.text);
		radiobuttonLabel.htmlFor = data.id;

		radiobutton.setAttribute('aria-labelledby', radiobuttonLabel.id);

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
		checkbox.id = data.id + '-input';
		checkbox.tabIndex = '0';

		var checkboxLabel = L.DomUtil.create('label', builder.options.cssClass, div);
		checkboxLabel.id = data.id + '-label';
		checkboxLabel.textContent = builder._cleanText(data.text);
		checkboxLabel.htmlFor = data.id;

		checkbox.setAttribute('aria-labelledby', checkboxLabel.id);

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

		var updateFunction = function() {
			var state = data.checked;

			if (state && state === 'true' || state === true || state === 1 || state === '1')
				$(checkbox).prop('checked', true);
			else if (state)
				$(checkbox).prop('checked', false);
		};

		updateFunction();

		if (data.hidden)
			$(checkbox).hide();

		return false;
	},

	_unitToVisibleString: function(unit) {
		if (unit == 'inch') {
			return '"';
		} else if (unit == 'percent') {
			return '%';
		} else if (unit == 'degree') {
			return '°';
		}
		return unit;
	},

	_getUnoStateForItemId: function(id, builder) {
		var items = builder.map['stateChangeHandler'];
		var state = null;

		switch (id) {
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

		case 'LB_SHADOW_COLOR':
			state = items.getItemValue('.uno:FillShadowColor');
			if (state) {
				return state;
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

		case 'LB_SHADOW_COLOR':
			return _('Color');
		}

		return null;
	},

	_spinfieldControl: function(parentContainer, data, builder, customCallback) {
		var controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);

		var updateFunction = function() {
			if (data.text != undefined)
				var value = data.text;
			else if (data.children && data.children.length)
				value = data.children[0].text;

			$(controls.spinfield).val(builder._cleanValueFromUnits(value));
		};

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

		if (!data.unit && data.text) {
			var units = data.text.split(' ');
			if (units.length == 2) {
				data.unit = units[1];
			}
		}

		if (!data.unit && data.text) {
			data.unit = builder._extractUnits(data.text.toString());
		}

		controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);
		if (!L.Browser.cypressTest && !L.Browser.chrome) {
			controls.spinfield.onkeypress = L.bind(builder._preventNonNumericalInput, builder);
		}

		builder.listenNumericChanges(data, builder, controls, customCallback);

		value = parseFloat(data.value);

		// time formatter or empty field
		if (data.unit === ':' || (!data.unit && !data.text)) {
			controls.spinfield.type = undefined;
			value = data.text;
		}

		$(controls.spinfield).val(value);

		return false;
	},


	_metricfieldControl: function(parentContainer, data, builder, customCallback) {
		var value;
		var controls = builder._controlHandlers['basespinfield'](parentContainer, data, builder, customCallback);
		if (!L.Browser.cypressTest && !L.Browser.chrome) {
			controls.spinfield.onkeypress = L.bind(builder._preventNonNumericalInput, builder);
		}

		builder.listenNumericChanges(data, builder, controls, customCallback);

		value = parseFloat(data.value);
		$(controls.spinfield).val(value);

		return false;
	},

	_editControl: function(parentContainer, data, builder, callback) {
		var edit = L.DomUtil.create('input', 'ui-edit ' + builder.options.cssClass, parentContainer);
		edit.value = data.text;
		edit.id = data.id;
		edit.dir = 'auto';

		if (data.password === true)
			edit.type = 'password';

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

	_customPushButtonTextForId: function(buttonId) {
		if (buttonId == 'validref')
			return _('Select range');

		return '';
	},

	_pushbuttonControl: function(parentContainer, data, builder, customCallback) {
		if (data.id && data.id === 'changepass' && builder.map['wopi'].IsOwner === false) {
			data.enabled = false;
		}
		var wrapper = L.DomUtil.create('div', '', parentContainer); // need for locking overlay
		var pushbutton = L.DomUtil.create('button', 'ui-pushbutton ' + builder.options.cssClass, wrapper);
		pushbutton.id = data.id;
		builder._setAccessKey(pushbutton, builder._getAccessKeyFromText(data.text));
		var pushbuttonText = builder._customPushButtonTextForId(data.id) !== '' ? builder._customPushButtonTextForId(data.id) : builder._cleanText(data.text);
		var image;
		if (data.image && pushbuttonText !== '') {
			L.DomUtil.addClass(pushbutton, 'has-img d-flex align-content-center justify-content-center align-items-center');
			image = L.DomUtil.create('img', '', pushbutton);
			image.src = data.image;
			var text = L.DomUtil.create('span', '', pushbutton);
			text.innerText = pushbuttonText;
			builder._stressAccessKey(text, pushbutton.accessKey);
		} else if (data.image) {
			L.DomUtil.addClass(pushbutton, 'has-img d-flex align-content-center justify-content-center align-items-center');
			image = L.DomUtil.create('img', '', pushbutton);
			image.src = data.image;
		} else if (data.symbol) {
			L.DomUtil.addClass(pushbutton, 'has-img d-flex align-content-center justify-content-center align-items-center');
			image = L.DomUtil.create('img', '', pushbutton);
			L.LOUtil.setImage(image, 'symbol_' + data.symbol + '.svg', builder.map.getDocType());
		} else {
			pushbutton.innerText = pushbuttonText;
			builder._stressAccessKey(pushbutton, pushbutton.accessKey);
		}
		if (data.enabled === 'false' || data.enabled === false)
			$(pushbutton).prop('disabled', true);

		if (customCallback)
			pushbutton.onclick = customCallback;
		else if (builder._responses[pushbutton.id] !== undefined)
			pushbutton.onclick = builder.callback.bind(builder, 'responsebutton', 'click', { id: pushbutton.id }, builder._responses[pushbutton.id], builder);
		else
			pushbutton.onclick = builder.callback.bind(builder, 'pushbutton', data.isToggle ? 'toggle' : 'click', pushbutton, data.command, builder);

		builder.map.hideRestrictedItems(data, wrapper, pushbutton);
		builder.map.disableLockedItem(data, wrapper, pushbutton);
		if (data.hidden)
			$(wrapper).hide(); // Both pushbutton and its wrapper needs to be hidden.

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
		arrowSpan.textContent = '>';

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
				window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
			}
		}
		else
			$(sectionTitle).hide();
	},

	// todo: implement real combobox with entry field and listbox at the same time
	_comboboxControl: function(parentContainer, data, builder) {
		if (data.id === 'searchterm' ||
			data.id === 'replaceterm') {
			// Replace combobox with edit in mobile find & replace dialog
			var callback = function(value) {
				builder.callback('combobox', 'change', data, value, builder);
			};

			builder._controlHandlers['edit'](parentContainer, data, builder, callback);
		} else if (data.id === 'applystyle' ||
			data.id === 'fontnamecombobox' ||
			data.id === 'fontsizecombobox' ||
			data.id === 'fontsize' ||
			data.id === 'FontBox' ||
			data.id === 'rotation' ||
			data.id === 'LB_ANGLE' ||
			data.id === 'LB_DISTANCE' ||
			!window.mode.isMobile()) {
			builder._listboxControl(parentContainer, data, builder);
		} else if (window.mode.isMobile())
			builder._explorableEditControl(parentContainer, data, builder);
		else
			window.app.console.warn('Unsupported combobox control!');
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
		listbox.id = data.id + '-input';
		var listboxArrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', container);
		listboxArrow.id = 'listbox-arrow-' + data.id;

		if (data.labelledBy)
			listbox.setAttribute('aria-labelledby', data.labelledBy);

		if (data.enabled === false || data.enabled === 'false')
			$(listbox).attr('disabled', 'disabled');

		$(listbox).change(function() {
			if ($(this).val())
				builder.callback('combobox', 'selected', data, $(this).val()+ ';' + $(this).children('option:selected').text(), builder);
		});
		var hasSelectedEntry = false;
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
				if (isSelected) {
					option.selected = true;
					hasSelectedEntry = true;
				}
			}
		}
		// no selected entry; set the visible value to empty string unless the font is not included in the entries
		if (!hasSelectedEntry) {
			if (title) {
				var newOption = L.DomUtil.create('option', '', listbox);
				newOption.value = ++index;
				newOption.innerText = title;
				newOption.selected = true;
			} else
				$(listbox).val('');
		}

		return false;
	},

	_iconViewEntry: function (parentContainer, parentData, entry, builder) {
		var disabled = parentData.enabled === 'false' || parentData.enabled === false;

		if (entry.separator && (entry.separator === 'true' || entry.separator === true)) {
			L.DomUtil.create('hr', builder.options.cssClass + ' ui-iconview-separator', parentContainer);
			return;
		}

		var entryContainer = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-entry', parentContainer);
		if (entry.selected && (entry.selected === 'true' || entry.selected === true))
			$(entryContainer).addClass('selected');

		var icon = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-icon', entryContainer);
		var img = L.DomUtil.create('img', builder.options.cssClass, icon);
		if (entry.image)
			img.src = entry.image;
		img.alt = entry.text;
		if (entry.tooltip)
			img.title = entry.tooltip;
		else
			img.title = entry.text;

		if (!disabled) {
			var singleClick = parentData.singleclickactivate === 'true' || parentData.singleclickactivate === true;
			$(entryContainer).click(function() {
				$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
				builder.callback('iconview', 'select', parentData, entry.row, builder);
				if (singleClick) {
					builder.callback('iconview', 'activate', parentData, entry.row, builder);
				}
			});
			if (!singleClick) {
				$(entryContainer).dblclick(function() {
					$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
					builder.callback('iconview', 'activate', parentData, entry.row, builder);
				});
			}
			builder._preventDocumentLosingFocusOnClick(entryContainer);
		}
	},

	_iconViewControl: function (parentContainer, data, builder) {
		var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview', parentContainer);
		container.id = data.id;

		var disabled = data.enabled === 'false' || data.enabled === false;
		if (disabled)
			L.DomUtil.addClass(container, 'disabled');

		for (var i in data.entries) {
			builder._iconViewEntry(container, data, data.entries[i], builder);
		}

		var firstSelected = $(container).children('.selected').get(0);
		var blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
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
				image = 'url("' + L.LOUtil.getImageURL(image + '.svg', builder.map.getDocType()) + '")';
			}

			if (image64) {
				image = 'url("' + image64 + '")';
			}
			L.LOUtil.checkIfImageExists(image);
			elem = L.DomUtil.create('div', 'layout ' +
				(data.entries[index].selected ? ' cool-context-down' : ''), parentContainer);
			$(elem).data('id', data.entries[index].id);
			$(elem).click(function () {
				builder.callback('valueset', 'selected', { id: data.id }, $(this).data('id'), builder);
			});

			elem.style.setProperty('background', image + ' no-repeat center', 'important');
		}

		return false;
	},

	_comboboxEntry: function(parentContainer, data, builder) {
		var comboboxEntry = L.DomUtil.create('p', builder.options.cssClass, parentContainer);
		comboboxEntry.textContent = builder._cleanText(data.text);

		comboboxEntry.parent = data.parent;

		if (data.style && data.style.length)
			L.DomUtil.addClass(comboboxEntry, data.style);

		$(comboboxEntry).click(function () {
			builder.refreshSidebar = true;
			if (builder.wizard)
				builder.wizard.goLevelUp();
			builder.callback('combobox', 'selected', comboboxEntry.parent, data.pos + ';' + comboboxEntry.textContent, builder);
		});
	},

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('label', builder.options.cssClass, parentContainer);

		if (data.labelFor)
			fixedtext.htmlFor = data.labelFor;

		if (data.text)
			fixedtext.textContent = builder._cleanText(data.text);
		else if (data.html)
			fixedtext.innerHTML = data.html;

		var accKey = builder._getAccessKeyFromText(data.text);
		builder._stressAccessKey(fixedtext, accKey);

		setTimeout(function () {
			var labelledControl = document.getElementById(data.labelFor);
			if (labelledControl) {
				var target = labelledControl;
				var input = labelledControl.querySelector('input');
				if (input)
					target = input;
				var select = labelledControl.querySelector('select');
				if (select)
					target = select;

				builder._setAccessKey(target, accKey);
			}
		}, 0);

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

		var target = parentContainer.lastChild;
		if (!target)
			target = parentContainer;

		L.DomUtil.addClass(target, 'ui-separator');
		if (data.orientation && data.orientation === 'vertical') {
			L.DomUtil.addClass(target, 'vertical');
		} else {
			L.DomUtil.addClass(target, 'horizontal');
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

	_imageHandler: function(parentContainer, data, builder) {
		if (!data.id)
			return false;

		var image = L.DomUtil.create('img', builder.options.cssClass + ' ui-image', parentContainer);
		image.id = data.id;
		image.src = data.image ? data.image.replace(/\\/g, '') : '';
		image.alt = data.text;

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
		// Create annotation copy and add it into the container.

		var annotation = new app.definitions.Comment(data.data, data.id === 'new' ? {noMenu: true} : {}, this);
		annotation.context = data.annotation.containerObject.context;
		annotation.documentTopLeft = data.annotation.containerObject.documentTopLeft;
		annotation.containerObject = data.annotation.containerObject;
		annotation.sectionProperties.section = annotation;
		annotation.sectionProperties.commentListSection = data.annotation.sectionProperties.commentListSection;
		annotation.onInitialize();

		if (this.map.isPermissionEditForComments() || this.map.isEditMode())
			annotation.sectionProperties.menu.isRoot = isRoot;

		container.appendChild(annotation.sectionProperties.container);

		annotation.show();
		annotation.update();
		annotation.setExpanded();
		annotation.hideMarker();
		annotation.sectionProperties.annotationMarker = null;
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
			container = L.DomUtil.create('div',  'ui-header cool-annotation-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);

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
					replyCountNode = L.DomUtil.create('div','cool-annotation-reply-count cool-annotation-content', $(container).find('.cool-annotation-content-wrapper')[0]);

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
				if ($(container).find('.cool-annotation-menubar').length > 0)
					$(container).find('.cool-annotation-menubar')[0].style.display = 'none';

				var arrowSpan = container.querySelector('[id=\'arrow span ' + data.id + '\']');

				if (!arrowSpan)
					arrowSpan = L.DomUtil.create('span','sub-menu-arrow', $(container).find('.cool-annotation-content-wrapper')[0]);

				arrowSpan.style.display = 'block';
				arrowSpan.textContent = '>';
				arrowSpan.style.padding = '0px';
				arrowSpan.id = 'arrow span ' + data.id;

				$(container).find('.cool-annotation')[0].onclick = function() {
					builder.wizard.goLevelDown(mainContainer);
					childContainer.style.display = 'block';
					if (!childContainer.childNodes.length)
						builder.build(childContainer, data.children);
				};

				var backButton = document.getElementById('mobile-wizard-back');

				backButton.onclick = function () {
					if (backButton.className !== 'close-button') {
						if (!mainContainer.childNodes.length)
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

		$(container).find('.cool-annotation')[0].addEventListener('click', function() {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).hightlightComment(data.annotation);
		});
		return false;
	},

	_commentControl: function(parentContainer, data, builder) {
		builder._createComment(parentContainer, data, false);
		return false;
	},

	_emptyCommentWizard: function(parentContainer, data, builder) {
		L.DomUtil.addClass(parentContainer, 'content-has-no-comments');
		var emptyCommentWizard = L.DomUtil.create('figure', 'empty-comment-wizard-container', parentContainer);
		var imgNode = L.DomUtil.create('img', 'empty-comment-wizard-img', emptyCommentWizard);
		L.LOUtil.setImage(imgNode, 'lc_showannotations.svg', builder.map.getDocType());
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

	_createIconURL: function(name, noCommad) {
		if (!name)
			return '';


		var alreadyClean = noCommad;
		var cleanName = name;


		if (!alreadyClean || alreadyClean !== true) {
			var prefixLength = '.uno:'.length;
			if (name.substr(0, prefixLength) == '.uno:')
				cleanName = name.substr(prefixLength);
			cleanName = encodeURIComponent(cleanName).replace(/\%/g, '');
			cleanName = cleanName.toLowerCase();
		}

		var iconURLAliases = {
			'addmb-menu': 'ok',
			'closetablet': 'view',
			'defineprintarea': 'menuprintranges',
			'deleteprintarea': 'delete',
			'sheetrighttoleft' : 'pararighttoleft',
			'alignleft': 'leftpara',
			'alignright': 'rightpara',
			'alignhorizontalcenter': 'centerpara',
			'alignblock': 'justifypara',
			'formatsparklinemenu': 'insertsparkline',
			'insertdatecontentcontrol': 'datefield',
			'editheaderandfooter': 'headerandfooter',
			'exportas': 'saveas',
			'insertheaderfooter': 'headerandfooter',
			'previoustrackedchange': 'prevrecord',
			'fieldtransparency': 'linetransparency',
			'lb_glow_transparency': 'linetransparency',
			'settransparency': 'linetransparency',
			'selectionlanugagedefault': 'updateall',
			'connectortoolbox': 'connectorlines',
			'conditionalformatdialog': 'conditionalformatmenu',
			'groupoutlinemenu': 'group',
			'paperwidth': 'pagewidth',
			'charspacing': 'spacing',
			'fontworkcharacterspacingfloater': 'spacing',
			'tablesort': 'datasort',
			'spellcheckignoreall': 'spelling',
			'deleterowbreak': 'delbreakmenu',
			'alignmentpropertypanel': 'alignvcenter',
			'cellvertcenter': 'alignvcenter',
			'charbackcolor': 'backcolor',
			'charmapcontrol': 'insertsymbol',
			'insertrowsafter': 'insertrowsmenu',
			'insertobjectchart': 'drawchart',
			'textpropertypanel': 'sidebartextpanel',
			'spacepara15': 'linespacing',
			'orientationdegrees': 'rotation',
			'clearoutline': 'delete',
			'docsign': 'editdoc',
			'editmenu': 'editdoc',
			'drawtext': 'text',
			'inserttextbox': 'text',
			'accepttrackedchanges': 'acceptchanges',
			'accepttrackedchange': 'acceptchanges',
			'chartlinepanel': 'linestyle',
			'linepropertypanel': 'linestyle',
			'xlinestyle': 'linestyle',
			'listspropertypanel': 'outlinebullet',
			'shadowpropertypanel': 'shadowed',
			'incrementlevel': 'outlineleft',
			'menurowheight': 'rowheight',
			'setoptimalrowheight': 'rowheight',
			'cellverttop': 'aligntop',
			'scalignmentpropertypanel': 'aligntop',
			'hyperlinkdialog': 'inserthyperlink',
			'remotelink': 'inserthyperlink',
			'openhyperlinkoncursor': 'inserthyperlink',
			'pageformatdialog': 'pagedialog',
			'backgroundcolor': 'fillcolor',
			'cellappearancepropertypanel': 'fillcolor',
			'formatarea': 'fillcolor',
			'glowcolor': 'fillcolor',
			'sccellappearancepropertypanel': 'fillcolor',
			'insertcolumnsafter': 'insertcolumnsmenu',
			'insertnonbreakingspace': 'formattingmark',
			'insertcurrentdate': 'datefield',
			'insertdatefieldfix': 'datefield',
			'insertdatefield': 'datefield',
			'insertdatefieldvar': 'datefield',
			'setparagraphlanguagemenu': 'spelldialog',
			'spellingandgrammardialog': 'spelldialog',
			'spellonline': 'spelldialog',
			'styleapply3fstyle3astring3ddefault26familyname3astring3dcellstyles': 'fontcolor',
			'fontworkgalleryfloater': 'fontworkpropertypanel',
			'insertfieldctrl': 'insertfield',
			'pagenumberwizard': 'insertpagenumberfield',
			'entirerow': 'fromrow',
			'insertcheckboxcontentcontrol': 'checkbox',
			'cellvertbottom': 'alignbottom',
			'insertcurrenttime': 'inserttimefield',
			'inserttimefieldfix': 'inserttimefield',
			'inserttimefieldvar': 'inserttimefield',
			'cancelformula': 'cancel',
			'resetattributes': 'setdefault',
			'tabledialog': 'tablemenu',
			'insertindexesentry': 'insertmultiindex',
			'paperheight': 'pageheight',
			'masterslidespanel': 'masterslide',
			'slidemasterpage': 'masterslide',
			'tabledeletemenu': 'deletetable',
			'tracechangemode': 'trackchanges',
			'deleteallannotation': 'deleteallnotes',
			'sdtabledesignpanel': 'tabledesign',
			'tableeditpanel': 'tabledesign',
			'tableautofitmenu': 'columnwidth',
			'menucolumnwidth': 'columnwidth',
			'hyphenation': 'hyphenate',
			'objectbackone': 'behindobject',
			'deleteannotation': 'deletenote',
			'areapropertypanel': 'chartareapanel',
			'downloadas-png': 'insertgraphic',
			'decrementlevel': 'outlineright',
			'acceptformula': 'ok',
			'insertannotation': 'shownote',
			'incrementindent': 'leftindent',
			'outlineup': 'moveup',
			'charttypepanel': 'diagramtype',
			'arrangeframemenu': 'arrangemenu',
			'bringtofront': 'arrangemenu',
			'scnumberformatpropertypanel': 'numberformatincdecimals',
			'graphicpropertypanel': 'graphicdialog',
			'rotateflipmenu': 'rotateleft',
			'outlinedown': 'movedown',
			'nexttrackedchange': 'nextrecord',
			'toggleorientation': 'orientation',
			'configuredialog': 'sidebar',
			'modifypage': 'sidebar',
			'parapropertypanel': 'paragraphdialog',
			'tablecellbackgroundcolor': 'fillcolor',
			'zoteroArtwork':  'zoteroThesis',
			'zoteroAudioRecording':  'zoteroThesis',
			'zoteroBill':  'zoteroThesis',
			'zoteroBlogPost':  'zoteroThesis',
			'zoteroBookSection':  'zoteroBook',
			'zoteroCase':  'zoteroThesis',
			'zoteroConferencePaper':  'zoteroThesis',
			'zoteroDictionaryEntry':  'zoteroThesis',
			'zoteroDocument':  'zoteroThesis',
			'zoteroEmail':  'zoteroThesis',
			'zoteroEncyclopediaArticle':  'zoteroThesis',
			'zoteroFilm':  'zoteroThesis',
			'zoteroForumPost':  'zoteroThesis',
			'zoteroHearing':  'zoteroThesis',
			'zoteroInstantMessage':  'zoteroThesis',
			'zoteroInterview':  'zoteroThesis',
			'zoteroLetter':  'zoteroThesis',
			'zoteroMagazineArticle':  'zoteroThesis',
			'zoteroManuscript':  'zoteroThesis',
			'zoteroMap':  'zoteroThesis',
			'zoteroNewspaperArticle':  'zoteroThesis',
			'zoteroNote':  'zoteroThesis',
			'zoteroPatent':  'zoteroThesis',
			'zoteroPodcast':  'zoteroThesis',
			'zoteroPreprint':  'zoteroThesis',
			'zoteroPresentation':  'zoteroThesis',
			'zoteroRadioBroadcast':  'zoteroThesis',
			'zoteroReport':  'zoteroThesis',
			'zoteroComputerProgram':  'zoteroThesis',
			'zoteroStatute':  'zoteroThesis',
			'zoteroTvBroadcast':  'zoteroThesis',
			'zoteroVideoRecording':  'zoteroThesis',
			'zoteroWebpage':  'zoteroThesis',
			'zoteroaddeditcitation': 'insertauthoritiesentry',
			'zoteroaddnote': 'addcitationnote',
			'zoterorefresh': 'updateall',
			'zoterounlink': 'unlinkcitation',
			'zoteroaddeditbibliography': 'addeditbibliography',
			'zoterosetdocprefs': 'formproperties',
			'sidebardeck.propertydeck' : 'sidebar',
			// Fix issue #6145 by adding aliases for the PDF and EPUB icons
			// The fix for issues #6103 and #6104 changes the name of these
			// icons so map the new names to the old names.
			'downloadas-pdf': 'exportpdf',
			'downloadas-direct-pdf': 'exportdirectpdf',
			'downloadas-epub': 'exportepub',
		};
		if (iconURLAliases[cleanName]) {
			cleanName = iconURLAliases[cleanName];
		}

		return L.LOUtil.getImageURL('lc_' + cleanName + '.svg', this.map.getDocType());
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

	_makeIdUnique: function(id) {
		var counter = 0;
		var found = document.querySelector('[id="' + id + '"]');

		while (found) {
			counter++;
			found = document.querySelector('[id="' + id + counter + '"]');
		}

		if (counter)
			id = id + counter;

		return id;
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
		div.tabIndex = -1;

		var isRealUnoCommand = true;
		var hasPopUp = false;

		if (data.text && data.text.endsWith('...')) {
			data.text = data.text.replace('...', '');
			hasPopUp = true;
		}

		if (data.command || data.postmessage === true) {
			var id = data.id ? data.id : (data.command && data.command !== '') ? data.command : data.text;
			var isUnoCommand = data.command && data.command.indexOf('.uno:') >= 0;
			if (isUnoCommand)
				id = encodeURIComponent(data.command.substr('.uno:'.length));
			else
				isRealUnoCommand = false;

			if (id)
				id.replace(/\%/g, '').replace(/\./g, '-').replace(' ', '');
			else
				console.warn('_unoToolButton: no id provided');

			L.DomUtil.addClass(div, 'uno' + id);

			if (isRealUnoCommand)
				id = builder._makeIdUnique(id);

			div.id = id;
			data.id = id; // change in input data for postprocess

			var icon = data.icon ? data.icon : builder._createIconURL(data.command);
			var buttonId = id + 'img';

			button = L.DomUtil.create('button', 'ui-content unobutton', div);
			button.id = buttonId;
			if (!data.accessKey)
				builder._setAccessKey(button, builder._getAccessKeyFromText(data.text));
			else
				button.accessKey = data.accessKey;

			if (hasPopUp)
				button.setAttribute('aria-haspopup', true);


			var imagePath = (data.image && !isUnoCommand) ? data.image : icon;
			var buttonImage = L.DomUtil.create('img', '', button);
			buttonImage.src = imagePath;

			controls['button'] = button;
			if (builder.options.noLabelsForUnoButtons !== true) {
				var label = L.DomUtil.create('label', 'ui-content unolabel', button);
				label.htmlFor = buttonId;
				label.textContent = builder._cleanText(data.text);
				button.setAttribute('alt', label.textContent);
				buttonImage.alt = label.textContent;
				builder._stressAccessKey(label, button.accessKey);
				controls['label'] = label;
				$(div).addClass('has-label');
			} else if (builder.options.useInLineLabelsForUnoButtons === true) {
				$(div).addClass('no-label');
			} else {
				div.title = data.text;
				button.setAttribute('alt', data.text);
				buttonImage.alt = data.text;
				builder.map.uiManager.enableTooltip(div);
				$(div).addClass('no-label');
			}

			if (builder.options.useInLineLabelsForUnoButtons === true) {
				$(div).addClass('inline');
				label = L.DomUtil.create('span', 'ui-content unolabel', div);
				label.htmlFor = buttonId;
				label.textContent = builder._cleanText(data.text);

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

					if (state && state === 'disabled') {
						if (data.command === '.uno:Paste') {
							// Fix GitHub issue #5839 and never disable Paste toolbar button
							// Behave the same as Contol.Menubar and never
							// disable Paste toolbar button. Native clients
							// that run LibreOffice locally may send a
							// "statechanged: .uno:Paste=disabled" message when
							// opening a document if the system clipboard is
							// empty, So, we ignore such messages or else the
							// current document's Paste toolbar button will
							// never be enabled.
							$(div).removeClass('disabled');
							window.app.console.log('do not disable paste based on server side data');
						} else {
							$(div).addClass('disabled');
						}
					}
					else {
						$(div).removeClass('disabled');
					}
				};

				updateFunction();

				builder.map.on('commandstatechanged', function(e) {
					if (e.commandName === data.command)
						updateFunction();
				}, this);
			}

			if (data.enabled === 'false' || data.enabled === false)
				L.DomUtil.addClass(div, 'disabled');

			if (data.selected === true) {
				$(button).addClass('selected');
				$(div).addClass('selected');
			}
			L.LOUtil.checkIfImageExists(buttonImage);

		} else {
			button = L.DomUtil.create('label', 'ui-content unolabel', div);
			button.textContent = builder._cleanText(data.text);
			controls['label'] = button;
		}

		if (options && options.hasDropdownArrow) {
			$(div).addClass('has-dropdown');
			var arrow = L.DomUtil.create('i', 'unoarrow', div);
			controls['arrow'] = arrow;
		} else if (data.dropdown === true) {
			$(div).addClass('has-dropdown');
			var arrowbackground = L.DomUtil.create('div', 'arrowbackground', div);
			var arrow = L.DomUtil.create('i', 'unoarrow', arrowbackground);
			controls['arrow'] = arrow;
			var menuIsOpened = false;
			$(arrowbackground).click(function (event) {
				if (!$(div).hasClass('disabled')) {
					if (menuIsOpened) {
						builder.callback('toolbox', 'closemenu', parentContainer, data.command, builder);
						menuIsOpened = false;
						$(div).removeClass('menu-opened');
					} else {
						menuIsOpened = true;
						builder.callback('toolbox', 'openmenu', parentContainer, data.command, builder);
						$(div).addClass('menu-opened');
					}

					event.stopPropagation();
				}
			});
		}

		$(div).on('click.toolbutton',function (e) {
			if (!$(div).hasClass('disabled')) {
				builder.refreshSidebar = true;
				if (data.postmessage)
					builder.map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: data.id} });
				else if (isRealUnoCommand && data.dropdown !== true)
					builder.callback('toolbutton', 'click', button, data.command, builder);
				else
					builder.callback('toolbox', 'click', parentContainer, data.command, builder);
			}
			e.preventDefault();
			e.stopPropagation();
		});

		div.addEventListener('keydown', function(e) {
			switch (e.key) {
			case 'Escape':
				builder.map.focus();
				break;
			}
		});

		builder._preventDocumentLosingFocusOnClick(div);

		if (data.enabled === 'false' || data.enabled === false)
			$(button).prop('disabled', true);

		builder.map.hideRestrictedItems(data, controls['container'], controls['container']);
		builder.map.disableLockedItem(data, controls['container'], controls['container']);

		return controls;
	},

	_mapDispatchToolItem: function (parentContainer, data, builder) {
		if (!data.command)
			data.command = data.id;

		if (data.id && data.id !== 'exportas' && data.id.startsWith('export')) {
			var format = data.id.substring('export'.length);
			builder.map._docLayer.registerExportFormat(data.text, format);

			if (builder.map['wopi'].HideExportOption)
				return false;
		}

		if (data.inlineLabel !== undefined) {
			var backupInlineText = builder.options.useInLineLabelsForUnoButtons;
			builder.options.useInLineLabelsForUnoButtons = data.inlineLabel;
		}

		var control = builder._unoToolButton(parentContainer, data, builder);

		if (data.inlineLabel !== undefined)
			builder.options.useInLineLabelsForUnoButtons = backupInlineText;

		$(control.container).unbind('click.toolbutton');
		if (!builder.map.isLockedItem(data)) {
			$(control.container).click(function () {
				builder.map.dispatch(data.command);
			});
		}

		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_mapBigDispatchToolItem: function (parentContainer, data, builder) {
		if (!data.command)
			data.command = data.id;

		var noLabels = builder.options.noLabelsForUnoButtons;
		builder.options.noLabelsForUnoButtons = false;

		var control = builder._unoToolButton(parentContainer, data, builder);

		builder.options.noLabelsForUnoButtons = noLabels;

		$(control.container).unbind('click.toolbutton');
		if (!builder.map.isLockedItem(data)) {
			$(control.container).click(function () {
				builder.map.dispatch(data.command);
			});
		}

		builder._preventDocumentLosingFocusOnClick(control.container);
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

	setPickerOutline: function(bgColor) {
		// Make sure the border around the color indicator is not too bright
		// when the color is black so to avoid weird contast artifacts
		if (bgColor) {
			if (bgColor.style.backgroundColor == '#000000' || bgColor.style.backgroundColor == 'rgb(0, 0, 0)') {
				bgColor.style.borderColor = '#6a6a6a';
			} else {
				bgColor.style.borderColor = 'var(--color-border)';
			}
		}
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

	_sendColorCommand: function(builder, data, color, themeData) {
		var gradientItem;

		// complex color properties

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
		}

		// simple numeric color values

		if (data.id === 'fillattr') {
			data.command = '.uno:FillPageColor';
		} else if (data.id === 'LB_GLOW_COLOR') {
			data.id = 'GlowColor';
		} else if (data.id === 'LB_SHADOW_COLOR') {
			data.command = '.uno:FillShadowColor';
		}

		var params = {};
		var colorParameterID = data.id + '.Color';
		var themeParameterID = data.id + '.ComplexColorJSON';

		params[colorParameterID] = {
			type : 'long',
			value : builder.parseHexColor(color)
		};

		if (themeData != null)
		{
			params[themeParameterID] = {
				type : 'string',
				value : themeData
			};
		}

		builder.map['stateChangeHandler'].setItemValue(data.command, params[colorParameterID].value);
		builder.map.sendUnoCommand(data.command, params);
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
		L.LOUtil.setImage(button, 'fr0' + i + '.svg', builder.map.getDocType());
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
		var bordercontrollabel = L.DomUtil.create('label', builder.options.cssClass + ' ui-text', parentContainer);
		bordercontrollabel.textContent = _('Cell borders');
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
		var commandOverride = data.command === '.uno:Color' && builder.map.getDocType() === 'text';
		if (commandOverride)
			data.command = '.uno:FontColor';

		var titleOverride = builder._getTitleForControlWithId(data.id);
		if (titleOverride)
			data.text = titleOverride;

		data.id = data.id ? data.id : (data.command ? data.command.replace('.uno:', '') : undefined);

		data.text = builder._cleanText(data.text);

		if (data.command) {
			var div = builder._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', parentContainer, data);

			var id = data.command.substr('.uno:'.length);
			div.id = id;
			div.tabIndex = -1;

			div.title = data.text;
			builder.map.uiManager.enableTooltip(div);

			var icon = builder._createIconURL(data.command);
			var buttonId = id + 'img';
			var button = L.DomUtil.create('button', 'ui-content unobutton', div);
			button.style.background = 'url(' + L.LOUtil.getImageURL(icon.split('/').pop(), builder.map.getDocType()) + ')';
			button.id = buttonId;
			button.setAttribute('alt', id);

			var arrowbackground = L.DomUtil.create('div', 'arrowbackground', div);
			L.DomUtil.create('i', 'unoarrow', arrowbackground);
			$(div).addClass('has-dropdown--color');

			var valueNode =  L.DomUtil.create('div', 'selected-color', div);

			var selectedColor;

			var updateFunction = function (color) {
				if (builder._colorLastSelection[data.command] !== undefined)
					selectedColor = builder._colorLastSelection[data.command];
				else
					selectedColor = builder._getCurrentColor(data, builder);

				valueNode.style.backgroundColor = color ? color : selectedColor;
				builder._colorLastSelection[data.command] = color ? color : selectedColor;
				builder.setPickerOutline(valueNode);
			};

			updateFunction();

			builder.map.on('commandstatechanged', function(e) {
				if (e.commandName === data.command)
					updateFunction();
			}, this);

			var noColorControl = (data.command !== '.uno:FontColor' && data.command !== '.uno:Color');

			var applyFunction = function() {
				var colorToApply = builder._colorLastSelection[data.command];
				if (!colorToApply || colorToApply === '#')
					return;

				var color = -1;
				if (colorToApply !== -1)
					color = colorToApply.indexOf('#') === 0 ? colorToApply.substr(1) : colorToApply;

				builder._sendColorCommand(builder, data, color);
			};

			button.addEventListener('click', applyFunction);
			valueNode.addEventListener('click', applyFunction);

			arrowbackground.tabIndex = 0;

			var arrowEventHandler = function() {
				if (!$(div).hasClass('disabled')) {
					$(div).w2color({ color: builder._colorLastSelection[data.command], transparent: noColorControl }, function (color, themeData) {
						if (color != null) {
							if (color) {
								updateFunction('#' + color);
								builder._sendColorCommand(builder, data, color, themeData);
							} else {
								updateFunction('#FFFFFF');
								builder._sendColorCommand(builder, data, 'transparent');
							}
						}
					});

					if (data.command === '.uno:FontColor' || data.command === '.uno:Color') {
						var autoColorButton = document.createElement('button');
						autoColorButton.textContent = _('Automatic');
						autoColorButton.classList.add('auto-color-button');

						autoColorButton.onclick = function() {
							updateFunction(-1);
							builder.map['stateChangeHandler'].setItemValue(data.command, -1);

							var parameters;
							if (data.command === '.uno:FontColor')
								parameters = { FontColor: { type: 'long', value: -1 } };
							else
								parameters = { Color: { type: 'long', value: -1 } };
							builder.map.sendUnoCommand(data.command, parameters);
							document.getElementById('document-container').click();
						}.bind(this);

						var colorDiv = document.getElementById('w2ui-overlay');
						colorDiv.insertBefore(autoColorButton, colorDiv.firstChild);
					}
				}
			};

			arrowbackground.addEventListener('keydown', function(event) {
				if (event.code === 'Enter' || event.ccode === 'Space') {
					arrowEventHandler();
					var w2uiElement = document.getElementById('w2ui-overlay');
					w2uiElement.querySelector('.color-palette-selector').focus();
					var tabCatcher = document.createElement('div');
					tabCatcher.tabIndex = 0;
					tabCatcher.onfocus = function() {
						w2uiElement.querySelector('.color-palette-selector').focus();
					};
					w2uiElement.insertBefore(tabCatcher, w2uiElement.children[0]);

					tabCatcher = document.createElement('div');
					tabCatcher.tabIndex = 0;
					tabCatcher.onfocus = function() {
						w2uiElement.querySelector('.color-palette-selector').focus();
					};
					w2uiElement.appendChild(tabCatcher);
				}
			});
			arrowbackground.addEventListener('click', arrowEventHandler);
			builder._preventDocumentLosingFocusOnClick(div);
		}

		return false;
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
			var iconURL = builder._createIconURL(iconName, true);
			icon = L.DomUtil.create('img', '', iconSpan);
			L.LOUtil.setImage(icon, iconURL.split('/').pop(), builder.map.getDocType());
			icon.alt = '';
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
			window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}

		builder.map.hideRestrictedItems(data, menuEntry, menuEntry);
		builder.map.disableLockedItem(data, menuEntry, menuEntry);

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

	// executes actions like changing the selection without rebuilding the widget
	executeAction: function(container, data) {
		var control = container.querySelector('[id=\'' + data.control_id + '\']');
		if (!control && data.control)
			control = container.querySelector('[id=\'' + data.control.id + '\']');
		if (!control) {
			window.app.console.warn('executeAction: not found control with id: "' + data.control_id + '"');
			return;
		}

		switch (data.action_type) {
		case 'grab_focus':
			control.focus();
			break;
		case 'select':
			$(control).children('.selected').removeClass('selected');

			var pos = parseInt(data.position);
			var entry = control.children.length > pos ? control.children[pos] : null;

			if (entry) {
				L.DomUtil.addClass(entry, 'selected');
				var blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
				entry.scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});
			} else if (pos != -1)
				console.warn('not found entry: "' + pos + '" in: "' + data.control_id + '"');

			break;

		case 'show':
			$(control).removeClass('hidden');
			$(control).show();
			break;

		case 'hide':
			$(control).addClass('hidden');
			break;

		case 'setText':
			// eg. in mobile wizard input is inside spin button div
			var innerInput = control.querySelector('input');
			if (innerInput)
				control = innerInput;

			var currentText = this._cleanText(data.text);
			control.value = currentText;
			if (data.selection) {
				var selection = data.selection.split(';');
				if (selection.length === 2) {
					var start = parseInt(selection[0]);
					var end = parseInt(selection[1]);

					if (start > end) {
						var tmp = start;
						start = end;
						end = tmp;
					}

					if (document.activeElement === control) // Safari/Gnome Web compatibility
						control.setSelectionRange(start, end);
				} else if (selection.length === 4) {
					var startPos = parseInt(selection[0]);
					var endPos = parseInt(selection[1]);
					var startPara = parseInt(selection[2]);
					var endPara = parseInt(selection[3]);
					var start = 0;
					var end = 0;

					var row = 0;
					for (;row < startPara; row++) {
						var found = currentText.indexOf('\n', start);
						if (found === -1)
							break;
						start = found + 1;
					}

					start += startPos;

					row = 0;
					for (;row < endPara; row++) {
						found = currentText.indexOf('\n', end);
						if (found === -1)
							break;
						end = found + 1;
					}

					end += endPos;

					if (start > end) {
						var tmp = start;
						start = end;
						end = tmp;
					}

					if (document.activeElement === control) // Safari/Gnome Web compatibility
						control.setSelectionRange(start, end);
				}
			}
			break;

		default:
			console.error('unknown action: "' + data.action_type + '"');
			break;
		}
	},

	_updateWidgetImpl: function (container, data, buildFunc) {
		var control = container.querySelector('[id=\'' + data.id + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + data.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		var scrollTop = control.scrollTop;
		var focusedElement = document.activeElement;
		var focusedElementInDialog = focusedElement ? container.querySelector('[id=\'' + focusedElement.id + '\']') : null;
		var focusedId = focusedElementInDialog ? focusedElementInDialog.id : null;

		control.style.visibility = 'hidden';

		var temporaryParent = L.DomUtil.create('div');
		buildFunc.bind(this)(temporaryParent, [data], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		var backupGridSpan = control.style.gridColumn;
		L.DomUtil.remove(control);

		var newControl = container.querySelector('[id=\'' + data.id + '\']');
		if (newControl) {
			newControl.scrollTop = scrollTop;
			newControl.style.gridColumn = backupGridSpan;

			// todo: is that needed? should be in widget impl?
			if (data.has_default === true && (data.type === 'pushbutton' || data.type === 'okbutton'))
				L.DomUtil.addClass(newControl, 'button-primary');
		}

		if (focusedId) {
			var found = container.querySelector('[id=\'' + focusedId + '\']');
			if (found)
				found.focus();
		}
	},

	// replaces widget in-place with new instance with updated data
	updateWidget: function (container, data) {
		this._updateWidgetImpl(container, data, this.build);
	},

	postProcess: function(parent, data) {
		if (!parent || !data || !data.id || data.id === '')
			return;

		var control = parent.querySelector('[id=\'' + data.id + '\']');
		if (data.visible === 'false' || data.visible === false) {
			if (control)
				L.DomUtil.addClass(control, 'hidden');
			else if (parent.id === data.id)
				L.DomUtil.addClass(parent, 'hidden');
		}

		if (control && data.width) {
			control.style.gridColumn = 'span ' + parseInt(data.width);
		}

		if (control && data.labelledBy)
			control.setAttribute('aria-labelledby', data.labelledBy);

		// natural tab-order when using keyboard navigation
		if (control && !control.hasAttribute('tabIndex')
			&& data.type !== 'container'
			&& data.type !== 'tabpage'
			&& data.type !== 'tabcontrol'
			&& data.type !== 'drawingarea'
			&& data.type !== 'grid'
			&& data.type !== 'image'
			&& data.type !== 'toolbox'
			&& data.type !== 'listbox'
			&& data.type !== 'combobox'
			&& data.type !== 'radiobutton'
			&& data.type !== 'checkbox'
			&& data.type !== 'spinfield'
			&& data.type !== 'metricfield'
			&& data.type !== 'formattedfield'
			&& data.type !== 'fixedtext'
			&& data.type !== 'frame'
			&& data.type !== 'expander'
			&& data.type !== 'panel'
			&& data.type !== 'buttonbox'
			&& data.type !== 'treelistbox')
			control.setAttribute('tabIndex', '0');
	},

	build: function(parent, data, hasVerticalParent) {

		// TODO: check and probably remove additional containers
		if (hasVerticalParent === undefined) {
			parent = L.DomUtil.create('div', 'root-container ' + this.options.cssClass, parent);
			parent = L.DomUtil.create('div', 'vertical ' + this.options.cssClass, parent);
		}

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			var childType = childData.type;

			this._handleResponses(childData, this);

			var containerToInsert = parent;

			if (childData.dialogid)
				containerToInsert.id = childData.dialogid;

			var isVertical = childData.vertical === 'true' || childData.vertical === true ? true : false;

			this._parentize(childData);
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var hasManyChildren = childData.children && childData.children.length > 1;
			var isContainer = this.isContainerType(childData.type);
			if (hasManyChildren && isContainer) {
				var table = L.DomUtil.createWithId('div', childData.id, containerToInsert);
				$(table).addClass(this.options.cssClass);

				if (!isVertical) {
					var rows = this._getGridRows(childData.children);
					var cols = this._getGridColumns(childData.children);

					if (rows > 1 && cols > 1) {
						var gridRowColStyle = 'grid-template-rows: repeat(' + rows  + '); \
							grid-template-columns: repeat(' + cols  + ');';

						table.style = gridRowColStyle;
					} else {
						$(table).css('grid-auto-flow', 'column');
					}

					$(table).css('display', 'grid');
				}

				$(table).addClass('ui-grid-cell');

				// if 'table' has no id - postprocess won't work...
				if (childData.width) {
					table.style.gridColumn = 'span ' + parseInt(childData.width);
				}

				var childObject = table;

				this.postProcess(containerToInsert, childData);
			} else {
				childObject = containerToInsert;
			}

			var handler = this._controlHandlers[childType];

			if (handler) {
				processChildren = handler(childObject, childData, this);
				this.postProcess(childObject, childData);
			} else
				window.app.console.warn('JSDialogBuilder: Unsupported control type: "' + childType + '"');

			if (processChildren && childData.children != undefined)
				this.build(childObject, childData.children, isVertical);
			else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
				$('#' + childData.id).addClass('hidden-from-event');
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

JSDialog._scrollIntoViewBlockOption = function(option) {
	if (option === 'nearest' || option === 'center') {
		// compatibility with older firefox
		var match = window.navigator.userAgent.match(/Firefox\/([0-9]+)\./);
		var firefoxVer = match ? parseInt(match[1]) : 58;
		var blockOption = firefoxVer >= 58 ? option : 'start';
		return blockOption;
	}

	return option;
};

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup(options);
	return builder;
};
