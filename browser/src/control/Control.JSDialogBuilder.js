/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global app $ _ L JSDialog */

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
	_decimal: '.',
	_minusSign: '-',

	// Responses are included in a parent container. While buttons are created, responses need to be checked.
	// So we save the button ids and responses to check them later.
	_responses: {}, // Button id = response

	_currentDepth: 0,

	rendersCache: {
		fontnamecombobox: { persistent: true, images: [] },
		layoutpanel_icons: { persistent: true, images: [] },
		transitions_icons: { persistent: true, images: [] },
		iconview_theme_colors: { persistent: true, images: [] },
		ctlFavoriteswin: { persistent: true, images: [] },
	}, // eg. custom renders for combobox entries

	setWindowId: function (id) {
		this.windowId = id;
	},

	_setup: function(options) {
		this._clearColorPickers();
		this.wizard = options.mobileWizard;
		this.map = options.map;
		this.windowId = options.windowId;
		this.dialogId = null;
		this.callback = options.callback ? options.callback : this._defaultCallbackHandler;

		this._colorPickers = [];

		// list of types which can have multiple children but are not considered as containers
		this._nonContainerType = ['buttonbox', 'treelistbox', 'iconview', 'combobox', 'listbox',
			'scrollwindow', 'grid', 'tabcontrol', 'multilineedit', 'formulabaredit', 'frame'];

		this._controlHandlers = {};
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['progressbar'] = JSDialog.progressbar;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['basespinfield'] = this.baseSpinField;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['metricfield'] = this._metricfieldControl;
		this._controlHandlers['time'] = JSDialog.timeField;
		this._controlHandlers['formattedfield'] = this._formattedfieldControl;
		this._controlHandlers['edit'] = JSDialog.edit;
		this._controlHandlers['searchedit'] = JSDialog.searchEdit;
		this._controlHandlers['formulabaredit'] = JSDialog.formulabarEdit;
		this._controlHandlers['multilineedit'] = JSDialog.multilineEdit;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['okbutton'] = this._pushbuttonControl;
		this._controlHandlers['helpbutton'] = this._pushbuttonControl;
		this._controlHandlers['cancelbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = JSDialog.combobox;
		this._controlHandlers['comboboxentry'] = JSDialog.comboboxEntry;
		this._controlHandlers['listbox'] = this._listboxControl;
		this._controlHandlers['valueset'] = this._valuesetControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['linkbutton'] = this._linkButtonControl;
		this._controlHandlers['htmlcontrol'] = this._htmlControl;
		this._controlHandlers['expander'] = this._expanderHandler;
		this._controlHandlers['grid'] = JSDialog.grid;
		this._controlHandlers['alignment'] = this._alignmentHandler;
		this._controlHandlers['buttonbox'] = JSDialog.buttonBox;
		this._controlHandlers['frame'] = JSDialog.frame;
		this._controlHandlers['deck'] = JSDialog.deck;
		this._controlHandlers['panel'] = JSDialog.panel;
		this._controlHandlers['calcfuncpanel'] = this._calcFuncListPanelHandler;
		this._controlHandlers['tabcontrol'] = this._tabsControlHandler;
		this._controlHandlers['tabpage'] = this._tabPageHandler;
		this._controlHandlers['singlepanel'] = this._singlePanelHandler;
		this._controlHandlers['container'] = JSDialog.container;
		this._controlHandlers['dialog'] = JSDialog.container;
		this._controlHandlers['messagebox'] = JSDialog.container;
		this._controlHandlers['window'] = JSDialog.container;
		this._controlHandlers['borderwindow'] = this._borderwindowHandler;
		this._controlHandlers['control'] = JSDialog.container;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = JSDialog.toolbox;
		this._controlHandlers['spacer'] = JSDialog.spacer;
		this._controlHandlers['toolitem'] = this._toolitemHandler;
		this._controlHandlers['colorsample'] = this._colorSampleControl;
		this._controlHandlers['divcontainer'] = this._divContainerHandler;
		this._controlHandlers['colorlistbox'] = JSDialog.colorPickerButton;
		this._controlHandlers['treelistbox'] = JSDialog.treeView;
		this._controlHandlers['iconview'] = JSDialog.iconView;
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
		this._controlHandlers['htmlcontent'] = JSDialog.htmlContent;
		this._controlHandlers['colorpicker'] = JSDialog.colorPicker;
		this._controlHandlers['dropdown'] = JSDialog.Dropdown;
		this._controlHandlers['menu'] = JSDialog.treeView;

		this._controlHandlers['mainmenu'] = JSDialog.container;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._menuItemHandlers = {};
		this._menuItemHandlers['inserttable'] = this._insertTableMenuItem;

		this._toolitemHandlers = {};
		this._toolitemHandlers['.uno:XLineColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:FontColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:CharBackColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:BackgroundColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:TableCellBackgroundColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:FrameLineColor'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:Color'] = JSDialog.colorPickerButton;
		this._toolitemHandlers['.uno:FillColor'] = JSDialog.colorPickerButton;

		this._toolitemHandlers['.uno:InsertFormula'] = function () {};

		this._menus = JSDialog.MenuDefinitions;

		this._currentDepth = 0;

		app.localeService.initializeNumberFormatting();
		this._decimal = app.localeService.getDecimalSeparator();
		this._minusSign = app.localeService.getMinusSign();
	},

	reportValidity: function() {
		var isValid = true;
		if (!this._container)
			return isValid;

		var inputs = this._container.querySelectorAll('input[type="number"]');
		for (var item = 0; item < inputs.length; item++) {
			if (!inputs[item].checkVisibility())
				continue;

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
			else if (data.text || data.command || data.postmessage) {
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

		// if user does action - enter following own cursor mode
		var viewId = builder.map && builder.map._docLayer ? builder.map._docLayer._getViewId() : -1;
		if (viewId >= 0)
			app.setFollowingUser(viewId);

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
				 (eventType === 'close' ||
				 (objectType === 'responsebutton' && data == 7))) {
				let dispatcher = app.dispatcher;
				if (!dispatcher)
					dispatcher = new app.definitions['dispatcher']('global');

				dispatcher.dispatch('closeapp');
			}
			switch (typeof data) {
			case 'string':
				// escape backspaces, quotes, newlines, and so on; remove added quotes
				data = JSON.stringify(data).slice(1, -1);
				break;
			case 'object':
				data = encodeURIComponent(JSON.stringify(data));
				break;
			}
			var windowId = builder.windowId !== null && builder.windowId !== undefined ? builder.windowId :
				(window.mobileDialogId !== undefined ? window.mobileDialogId :
					(window.sidebarId !== undefined ? window.sidebarId : -1));
			var message = 'dialogevent ' + windowId
					+ ' {\"id\":\"' + object.id
				+ '\", \"cmd\": \"' + eventType
				+ '\", \"data\": \"' + data
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
		spinfield.setAttribute('autocomplete', 'off');
		builder._addAriaLabel(spinfield, data, builder);

		controls['spinfield'] = spinfield;


		if (data.unit && data.unit !== ':') {
			var unit = L.DomUtil.create('span', builder.options.cssClass + ' spinfieldunit', div);
			unit.textContent = builder._unitToVisibleString(data.unit);
		}

		var getPrecision = function (data) {
			data = Math.abs(data);
			var str = '' + data;
			var dot = str.indexOf('.');
			return dot > 0 ? 1 / Math.pow(10, str.length - dot - 1) : 1;
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

		const isDisabled = data.enabled === false;

		if (isDisabled) {
			div.disabled = true;
			spinfield.setAttribute('disabled', 'true');
		}

		spinfield.setAttribute('aria-disabled', isDisabled);

		JSDialog.SynchronizeDisabledState(div, [spinfield]);

		if (data.readOnly === true)
			$(spinfield).attr('readOnly', 'true');

		if (data.hidden)
			$(spinfield).hide();

		spinfield.addEventListener('change', function() {
			const isCurrentlyDisabled = div.hasAttribute('disabled');
			var isValid = this.checkValidity();
			if (!isCurrentlyDisabled && isValid) {
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
				if (!app.util.isEmpty(event) && handler) {
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
		if (!accessKey || window.mode.isMobile() || window.getAccessibilityState())
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
		if (text.endsWith('…'))
			text = text.slice(0, -1);
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

	_borderwindowHandler: function(parentContainer, data, builder) {
		if (data.visible === false) {
			for (var i in data.children)
				data.children[i].visible = false;
		}

		return JSDialog.container(parentContainer, data, builder);
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

	// used inside tab control and assistant (chart wizard, where it should create own container)
	_tabPageHandler: function(parentContainer, data, builder) {
		var page = L.DomUtil.create('div', builder.options.cssClass + ' ui-tabpage', parentContainer);
		page.id = data.id;

		builder.build(page, data.children, false);

		return false;
	},

	_alignmentHandler: function(parentContainer, data, builder) {
		L.DomUtil.addClass(parentContainer, 'ui-alignment');
		return JSDialog.container(parentContainer, data, builder);
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

	_explorableEntry: function(parentContainer, data, content, builder, valueNode, iconURL, updateCallback) {
		var mainContainer = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass, parentContainer);
		if (data && data.id)
			mainContainer.id = data.id;

		if (data && data.name)
			mainContainer.id = data.name; // use legacy panel id FIXME: convert all CSS and cypress to vcl id

		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', mainContainer);
		$(sectionTitle).css('justify-content', 'space-between');

		if (data.enabled === 'false' || data.enabled === false) {
			mainContainer.disabled = true;
			$(mainContainer).addClass('disabled');
		}

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
			iconURL = 'lc_'+ sectionTitle.id.toLowerCase() +'.svg';
			break;
		}
		if (iconURL) {
			var icon = L.DomUtil.create('img', 'menu-entry-icon', leftDiv);
			app.LOUtil.setImage(icon, iconURL, builder.map);
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
				$(sectionTitle).click(function(event, data) {
					if (!mainContainer.hasAttribute('disabled')) {
						builder.wizard.goLevelDown(mainContainer, data);
						if (contentNode && contentNode.onshow && !builder.wizard._inBuilding)
							contentNode.onshow();
					}
				});

				if (mainContainer.hasAttribute('disabled')) {
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
			$(rightDiv).click(() => {
				builder.wizard.goLevelDown(mainContainer);
				if (contentNode.onshow)
					contentNode.onshow();
			});
			$(leftDiv).click(() => {
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
				var prefix = data.children[0].id ? data.children[0].id : data.id;
				var expander = L.DomUtil.create('button', 'ui-expander ' + builder.options.cssClass, container);
				expander.tabIndex = '0';
				expander.setAttribute('aria-controls', prefix + '-children');
				var label = L.DomUtil.create('span', 'ui-expander-label ' + builder.options.cssClass, expander);
				label.innerText = builder._cleanText(data.children[0].text);
				label.id = prefix + '-label';
				if (data.children[0].visible === false)
					L.DomUtil.addClass(label, 'hidden');
				builder.postProcess(expander, data.children[0]);

				var state = data.children.length > 1 && expanded;
				if (state) {
					L.DomUtil.addClass(label, 'expanded');
				}
				expander.setAttribute('aria-expanded', state);

				var toggleFunction = function () {
					if (customCallback)
						customCallback();
					else
						builder.callback('expander', 'toggle', data, null, builder);

					var state = expander.getAttribute('aria-expanded') === 'true';
					expander.setAttribute('aria-expanded', !state);
					$(label).toggleClass('expanded');
					$(expander).siblings().toggleClass('expanded');

					// Toggle aria-expanded attribute
					const currentState = expander.getAttribute('aria-expanded') === 'true';
					expander.setAttribute('aria-expanded', (!currentState).toString());
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
			expanderChildren.id = prefix + '-children';

			if (expanded) {
				if (data.children.length > 1) {
					label.classList.add('expanded');
					expander.setAttribute('aria-expanded', 'true');
				}
				expanderChildren.classList.add('expanded');
			}
			else {
				expander.setAttribute('aria-expanded', 'false');
			}

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
		if (commandName && commandName.length && app.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, sectionTitle);
			iconName = app.LOUtil.getIconNameOfCommand(iconName, true);
			icon = L.DomUtil.create('img', '', iconSpan);
			app.LOUtil.setImage(icon, iconName, builder.map);
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
			$(sectionTitle).click(() => { builder.wizard.goLevelDown(mainContainer); });
		} else {
			window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
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

	_rayCastingSensitivity: 10, // Pixels

	_findFocusableParent: function(container, currentElement, element, arrowUp) {
		if (!element)
			return null;
		else if (element.tagName === 'NAV' && arrowUp) {
			return element;
		}
		else if (element.tabIndex === -1 || element.tagName == 'A') {
			return this._findFocusableParent(container, currentElement, element.parentNode, arrowUp);
		}
		else if (container.contains(element) && currentElement !== element && !currentElement.contains(element) && !element.disabled) {
			return element;
		}
		else
			return null;
	},

	_rayCastToNextElement: function(container, currentElement, boundingRectangle, startX, startY, diffX, diffY, arrowUp) {
		let count = 0;
		let foundElement;
		while (count <= 60) {
			count++;
			startX += diffX;
			startY += diffY;

			foundElement = document.elementFromPoint(startX, startY);
			foundElement = this._findFocusableParent(container, currentElement, foundElement, arrowUp);
			if (foundElement) break;

			// If we are here, we'll try secondary and tertiary rays.
			if (diffX === 0) {
				foundElement = document.elementFromPoint(boundingRectangle.left, startY);
				foundElement = this._findFocusableParent(container, currentElement, foundElement, arrowUp);
				if (foundElement) break;

				foundElement = document.elementFromPoint(boundingRectangle.right, startY);
				foundElement = this._findFocusableParent(container, currentElement, foundElement, arrowUp);
				if (foundElement) break;
			}
			else if (diffY === 0) {
				foundElement = document.elementFromPoint(startX, boundingRectangle.top);
				foundElement = this._findFocusableParent(container, currentElement, foundElement, arrowUp);
				if (foundElement) break;

				foundElement = document.elementFromPoint(startX, boundingRectangle.bottom);
				foundElement = this._findFocusableParent(container, currentElement, foundElement, arrowUp);
				if (foundElement) break;
			}
		}

		if (count === 60)
			return null;
		else
			return foundElement;
	},

	_findNextElementInContainer: function(container, currentElement, direction) {
		let boundingRectangle = currentElement.getBoundingClientRect();
		let startX = boundingRectangle.left + (boundingRectangle.right - boundingRectangle.left) / 2;
		let startY = boundingRectangle.top + (boundingRectangle.bottom - boundingRectangle.top) / 2;

		let diffX = 0;
		let diffY = 0;

		if (direction === 'ArrowLeft' || direction === 'ArrowRight')
			diffX = direction === 'ArrowRight' ? (this._rayCastingSensitivity) : (this._rayCastingSensitivity * -1);

		if (direction === 'ArrowUp' || direction === 'ArrowDown')
			diffY = direction === 'ArrowDown' ? (this._rayCastingSensitivity) : (this._rayCastingSensitivity * -1);

		return this._rayCastToNextElement(container, currentElement, boundingRectangle, startX, startY, diffX, diffY, direction === 'ArrowUp');
	},

	_tabsControlHandler: function(parentContainer, data, builder, tabTooltip) {
		if (tabTooltip === undefined) {
			tabTooltip = '';
		}
		if (data.tabs) {
			var tabs = 0;
			for (var tabIdx = 0; data.children && tabIdx < data.children.length; tabIdx++) {
				if (data.children[tabIdx].type === 'tabpage' || data.vertical)
					tabs++;
			}
			var isMultiTabJSON = tabs > 1;

			var tabWidgetRootContainer = L.DomUtil.create('div', 'ui-tabs-root ' + builder.options.cssClass, parentContainer);
			tabWidgetRootContainer.id = data.id;

			var tabsContainer = L.DomUtil.create('div', 'ui-tabs ' + builder.options.cssClass + ' ui-widget', builder.options.useSetTabs ? undefined : tabWidgetRootContainer);
			tabsContainer.setAttribute('role', 'tablist');

			var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content ' + builder.options.cssClass, tabWidgetRootContainer);

			var tabs = [];
			var contentDivs = [];
			var tabIds = [];
			var singleTabId = null;
			for (var tabIdx = 0; tabIdx < data.tabs.length; tabIdx++) {
				var item = data.tabs[tabIdx];

				var title = builder._cleanText(item.text);

				var tab = L.DomUtil.create('button', 'ui-tab ' + builder.options.cssClass, tabsContainer);
				// avoid duplicated ids: we receive plain number from core, append prefix
				tab.id = Number.isInteger(parseInt(item.id)) ? data.id + '-' + item.id : item.id;
				tab.textContent = title;
				tab.setAttribute('role', 'tab');
				builder._addAriaLabel(tab, item, builder);
				builder._setAccessKey(tab, builder._getAccessKeyFromText(item.text));
				builder._stressAccessKey(tab, tab.accessKey);

				var isSelectedTab = data.selected == item.id;
				if (isSelectedTab) {
					$(tab).addClass('selected');
					tab.setAttribute('aria-selected', 'true');
					tab.tabIndex = '0';
					tab.setAttribute('data-cooltip', tabTooltip);
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
					var eventHandler = builder._createTabClick(builder, index, tabs, contentDivs, tabIds);
					tab.addEventListener('click', function(event) {
						eventHandler(event);
						if (!data.noCoreEvents) {
							builder.callback('tabcontrol', 'selecttab', tabWidgetRootContainer, index, builder);
						}
					});
				});

				var isTabVisible = function (tab) {
					return !$(tab).hasClass('hidden');
				};

				var findNextVisibleTab = function(tab, backwards) {
					const currentIndex = tabs.indexOf(tab);
					const diff = backwards ? -1 : 1;
					const total = tabs.length;

					for (let i = 1; i <= total; i++) {
						const nextIndex = (currentIndex + diff * i + total) % total;
						const nextTab = tabs[nextIndex];
						if (isTabVisible(nextTab)) {
							return nextTab;
						}
					}

					// Fallback to current tab if no visible one is found (shouldn't happen)
					return tab;
				};

				var moveFocusToPreviousTab = function(tab) {
					const nextTab = findNextVisibleTab(tab, true);
					nextTab.click();
					nextTab.focus(); // Prevent document from taking focus
				};

				var moveFocusToNextTab = function(tab) {
					const nextTab = findNextVisibleTab(tab, false);
					nextTab.click();
					nextTab.focus(); // Prevent document from taking focus
				};

				var moveFocusIntoTabPage = function(tab) {
					var tabIdx = tabs.indexOf(tab);
					var currentElement = contentDivs[tabIdx];

					function findFirstFocusableElement(currentNode)
					{
						var currentChildNodes = currentNode.childNodes;

						if (currentChildNodes.length <= 0) {
							return null;
						}

						for (var childIndex = 0; childIndex < currentChildNodes.length; childIndex++) {
							var currentChildNode = currentChildNodes[childIndex];

							if (currentChildNode.tabIndex === undefined) {
								return null;
							}
							if (currentChildNode.tabIndex === -1) {
								var firstFocusableElement = findFirstFocusableElement(currentChildNode);

								if (firstFocusableElement !== null) {
									return firstFocusableElement;
								}
							}
							else
							{
								var classListContainsInvalidClass = false;
								if (currentChildNode.classList !== undefined) {
									classListContainsInvalidClass = currentChildNode.classList.contains('hidden') ||
																	currentChildNode.classList.contains('jsdialog-begin-marker') ||
																	currentChildNode.classList.contains('jsdialog-end-marker');
								}

								if (!currentChildNode.disabled && !currentChildNode.hidden && !classListContainsInvalidClass) {
									var firstFocusableChild = findFirstFocusableElement(currentChildNode);
									if (firstFocusableChild === null) {
										return currentChildNode;
									}
									else {
										return firstFocusableChild;
									}
								}
							}
						}

						return null;
					}

					var firstFocusableElement = findFirstFocusableElement(currentElement);

					firstFocusableElement.focus();
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

							case 'ArrowDown':
								moveFocusIntoTabPage(currentTab);
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

				if (tab.type !== 'tabpage' && !data.vertical)
					continue;

				builder.build(contentDivs[tabId], [tab], false, false);
				tabId++;
			}
		} else {
			for (var tabIdx = 0; tabIdx < data.children.length; tabIdx++) {
				var tab = data.children[tabIdx];

				if (tab.type !== 'tabpage' && !data.vertical)
					continue;

				builder.build(contentDivs[singleTabId], [tab], false, false);
				break;
			}
		}

		if (data.tabs && data.parent.id === 'NotebookBar') {
			let that = this;
			contentDivs.forEach(function(tabPage)
			{
				tabPage.addEventListener('keydown', function(e) {
					// Determine key direction
					let key;
					if (e.key === 'Tab') {
						key = e.shiftKey ? 'ArrowLeft' : 'ArrowRight'; // Reverse if Shift+Tab
					} else {
						key = e.key;
					}
					if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
						var currentElement = e.srcElement;
						if (!(currentElement.tagName === 'INPUT' || currentElement.tagName === 'TEXTAREA')) {
							if (e.key === 'Tab')
								e.preventDefault();
							let container = document.getElementsByClassName('ui-tabs-content notebookbar');
							let elementToFocus = this._findNextElementInContainer(container[0], currentElement, key);
							if (elementToFocus && elementToFocus.tagName !== 'NAV')
								elementToFocus.focus();
							else if (elementToFocus)
								document.querySelector('.ui-tab.notebookbar.selected').focus();
							else {
								// Nothing found — cycle to first focusable
								let visibleContainer = Array.from(container[0].children).find(child =>
									!child.classList.contains('hidden') && child.offsetParent !== null
								);
								let focusables = visibleContainer ? Array.from(visibleContainer.querySelectorAll('[tabindex="-1"]:not([disabled])')) : [];
								if (focusables.length) {
									let first = focusables[0];
									let last = focusables[focusables.length - 1];
									if (e.shiftKey && currentElement === first)
										last.focus();
									else if (!e.shiftKey && currentElement === last)
										first.focus();
									else
										(e.shiftKey ? last : first).focus(); // fallback
								}
							}
						}
					}
				}.bind(that));
			});
		}

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
		radiobuttonLabel.htmlFor = data.id + '-input';

		var toggleFunction = function() {
			builder.callback('radiobutton', 'change', container, this.checked, builder);
		};

		$(radiobuttonLabel).click(() => {
			if (radiobutton.hasAttribute('disabled')) return;

			$(radiobutton).prop('checked', true);
			toggleFunction.bind({checked: true})();
		});

		const isDisabled = data.enabled === false;
		if (isDisabled) {
			radiobutton.setAttribute('disabled', 'disabled');
			radiobutton.setAttribute('aria-disabled', isDisabled);
		}

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
		checkboxLabel.htmlFor = data.id + '-input';

		var toggleFunction = function() {
			if (div.hasAttribute('disabled'))
				return;

			builder.callback('checkbox', 'change', div, this.checked, builder);
		};

		const isDisabled = data.enabled === false;
		if (isDisabled) {
			div.setAttribute('disabled', 'true');
			div.disabled = true;
			checkbox.setAttribute('disabled', 'true');
			checkbox.disabled = true;
			checkbox.setAttribute('aria-disabled', true);
		}

		JSDialog.SynchronizeDisabledState(div, [checkbox, checkboxLabel]);

		checkbox.addEventListener('change', toggleFunction);

		var updateFunction = function() {
			if (div.hasAttribute('disabled'))
				return;

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

	_customPushButtonTextForId: function(buttonId) {
		if (buttonId == 'validref')
			return _('Select range');

		return '';
	},

	_pushbuttonControl: function(parentContainer, data, builder, customCallback) {
		if (data.id && data.id === 'changepass' && builder.map['wopi'].IsOwner === false) {
			data.enabled = false;
		}
		var wrapperClass = window.mode.isMobile() ? '' : 'd-flex justify-content-center';
		var wrapper = L.DomUtil.create('div', wrapperClass, parentContainer); // need for locking overlay
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
			app.LOUtil.setImage(image, 'symbol_' + data.symbol + '.svg', builder.map);
		} else {
			pushbutton.innerText = pushbuttonText;
			builder._stressAccessKey(pushbutton, pushbutton.accessKey);
		}
		if (image)
			image.alt = '';

		const isDisabled = data.enabled === false;
		if (isDisabled) {
			pushbutton.setAttribute('disabled', 'disabled');
			pushbutton.setAttribute('aria-disabled', true);
		}

		if (customCallback)
			pushbutton.onclick = customCallback;
		else if (builder._responses[pushbutton.id] !== undefined)
			pushbutton.onclick = builder.callback.bind(builder, 'responsebutton', 'click', { id: pushbutton.id }, builder._responses[pushbutton.id], builder);
		else
			pushbutton.onclick = builder.callback.bind(builder, 'pushbutton', data.isToggle ? 'toggle' : 'click', pushbutton, data.command, builder);


		if (data.labelledBy) {
			pushbutton.setAttribute('aria-labelledby', data.labelledBy);
		} else {
			builder._addAriaLabel(pushbutton, data, builder);
		}

		const tooltipText = (data.aria && data.aria.label) || data.text;
		if (!pushbuttonText && tooltipText) {
			pushbutton.setAttribute('data-cooltip', builder._cleanText(tooltipText));
			L.control.attachTooltipEventListener(pushbutton, builder.map);
		}

		builder.map.hideRestrictedItems(data, wrapper, pushbutton);
		builder.map.disableLockedItem(data, wrapper, pushbutton);
		if (data.hidden)
			$(wrapper).hide(); // Both pushbutton and its wrapper needs to be hidden.

		return false;
	},

	_linkButtonControl: function(parentContainer, data, builder) {
		var textContent = L.DomUtil.create('label', builder.options.cssClass + " ui-linkbutton", parentContainer);

		if (data.labelFor)
			textContent.htmlFor = data.labelFor + '-input';

		if (data.text)
			textContent.textContent = builder._cleanText(data.text);
		else if (data.html)
			textContent.innerHTML = data.html;

		var accKey = builder._getAccessKeyFromText(data.text);
		builder._stressAccessKey(textContent, accKey);

		app.layoutingService.appendLayoutingTask(function () {
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
		});

		textContent.id = data.id;
		if (data.style && data.style.length) {
			L.DomUtil.addClass(textContent, data.style);
		} else {
			L.DomUtil.addClass(textContent, 'ui-text');
		}
		if (data.hidden)
			$(textContent).hide();

		var clickFunction = function () {
				builder.callback('linkbutton', 'click', data, null, builder);
		};
		$(textContent).click(clickFunction);
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
		if (data.labelledBy)
			listbox.setAttribute('aria-labelledby', data.labelledBy);
		var listboxArrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', container);
		listboxArrow.id = 'listbox-arrow-' + data.id;


		if (data.enabled === false) {
			container.disabled = true;
			listbox.disabled = true;
			container.setAttribute('disabled', 'true');
		}

		JSDialog.SynchronizeDisabledState(container, [listbox]);

		$(listbox).change(() => {
			if ($(listbox).val())
				builder.callback('combobox', 'selected', data, $(listbox).val()+ ';' + $(listbox).children('option:selected').text(), builder);
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
				image = 'url("' + app.LOUtil.getImageURL(image + '.svg') + '")';
			}

			if (image64) {
				image = 'url("' + image64 + '")';
			}
			app.LOUtil.checkIfImageExists(image);
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

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('label', builder.options.cssClass, parentContainer);

		if (data.labelFor)
			fixedtext.htmlFor = data.labelFor + '-input';

		if (data.text)
			fixedtext.textContent = builder._cleanText(data.text);
		else if (data.html)
			fixedtext.innerHTML = data.html;

		var accKey = builder._getAccessKeyFromText(data.text);
		builder._stressAccessKey(fixedtext, accKey);

		app.layoutingService.appendLayoutingTask(function () {
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
		});

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

	_separatorControl: function(parentContainer, data, builder) {
		if (data.orientation && data.orientation === 'vertical') {
			var separator = L.DomUtil.create('div', builder.options.cssClass + ' ui-separator vertical', parentContainer);
		} else {
			separator = L.DomUtil.create('hr', builder.options.cssClass + ' ui-separator horizontal', parentContainer);
		}
		separator.id = data.id;

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
		var spinner = L.DomUtil.create('div', builder.options.cssClass + ' spinner-img ', parentContainer);
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

	_createComment: function(container, data) {
		// Create annotation copy and add it into the container.
		container.appendChild(data.annotation.sectionProperties.container);

		data.annotation.show();
		data.annotation.update();
		data.annotation.setExpanded();
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
		builder._createComment(container, data);
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
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).highlightComment(data.annotation);
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
		app.LOUtil.setImage(imgNode, 'lc_showannotations.svg', builder.map);
		imgNode.alt = data.text;

		var textNode = L.DomUtil.create('figcaption', 'empty-comment-wizard', emptyCommentWizard);
		textNode.innerText = data.text;
		L.DomUtil.create('br', 'empty-comment-wizard', textNode);
		if (app.isCommentEditingAllowed()) {
			var linkNode = L.DomUtil.create('div', 'empty-comment-wizard-link', textNode);
			linkNode.innerText = _('Insert Comment');
			linkNode.onclick = builder.map.insertComment.bind(builder.map);
		}
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

	_addAriaLabel(element, data, builder) {
		if (data.aria)
			element.setAttribute('aria-label', data.aria.label);
		else if(data.text)
			element.setAttribute('aria-label', builder._cleanText(data.text));
	},

	// Create a DOM node with an identifiable parent class
	_createIdentifiable : function(type, classNames, parentContainer, data) {
		return L.DomUtil.create(
			type, classNames + this._getParentId(data),
			parentContainer);
	},

	_isStringCloseToURL : function(str) {
		return str.indexOf('http') !== -1;
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
		if (data.class)
			div.classList.add(data.class);

		const hasDropdownArrow = !!(options && options.hasDropdownArrow);
		const isSplitButton = !!data.applyCallback;
		const isDropdownButton = !!data.dropdown;

		/**
		 * Determines if the dropdown arrow should be interactive (focusable button) vs decorative (div).
		 * This affects ARIA attribute placement and arrowbackground element type creation.
		 */
		const isArrowInteractive = (hasDropdownArrow && isSplitButton) || isDropdownButton;
		var isRealUnoCommand = true;
		var hasPopUp = false;
		var hasImage = true;

		if (data.text && data.text.endsWith('...')) {
			data.text = data.text.replace('...', '');
			hasPopUp = true;
		}

		if (data && data.image === false) {
			hasImage = false;
		}

		if (data.command || data.postmessage === true) {
			var id = data.id ? data.id : (data.command && data.command !== '') ? data.command.replace('.uno:', '') : data.text;
			var isUnoCommand = data.command && data.command.indexOf('.uno:') >= 0;

			isRealUnoCommand = isUnoCommand;

			if (id)
				id.replace(/\%/g, '').replace(/\./g, '-').replace(' ', '');
			else
				console.warn('_unoToolButton: no id provided');

			if (data.command)
				L.DomUtil.addClass(div, data.command.replace(':', '').replace('.', ''));

			if (isRealUnoCommand)
				id = builder._makeIdUnique(id);

			div.id = id;
			data.id = id; // change in input data for postprocess

			var buttonId = id + '-button';

			button = L.DomUtil.create('button', 'ui-content unobutton', div);
			button.id = buttonId;

			JSDialog.SynchronizeDisabledState(div, [button]);

			builder._addAriaLabel(button, data, builder);

			if (!data.accessKey)
				builder._setAccessKey(button, builder._getAccessKeyFromText(data.text));
			else
				button.accessKey = data.accessKey;

			// if dropdown arrow does not exist or is not interactive then only button can have aria-haspopup
			if (hasPopUp && !isArrowInteractive)
				button.setAttribute('aria-haspopup', true);

			if (data.w2icon) {
				// FIXME: DEPRECATED, this is legacy way to setup icon based on CSS class
				var buttonImage = L.DomUtil.create('div', 'w2ui-icon ' + data.w2icon, button);
			}
			else if (hasImage !== false){
				if (data.icon) {
					buttonImage = L.DomUtil.create('img', '', button);
					this._isStringCloseToURL(data.icon) ? buttonImage.src = data.icon : app.LOUtil.setImage(buttonImage, data.icon, builder.map);
				}
				else if (data.image) {
					buttonImage = L.DomUtil.create('img', '', button);
					buttonImage.src = data.image;
				}
				else {
					buttonImage = L.DomUtil.create('img', '', button);
					app.LOUtil.setImage(buttonImage, app.LOUtil.getIconNameOfCommand(data.command), builder.map);
				}
			} else {
				buttonImage = false;
			}

			controls['button'] = button;
			var span;
			// NOTE: menubutton handles the noLabel case differently from other types
			// like toolitem, please see function `_menubuttonControl`
			if (data.noLabel && data.type != 'menubutton')
				$(div).addClass('no-label');
			else if (builder.options.noLabelsForUnoButtons !== true && data.text) {
				span = L.DomUtil.create('span', 'ui-content unolabel', button);
				span.textContent = builder._cleanText(data.text);
				builder._stressAccessKey(span, button.accessKey);
				controls['label'] = span;
				$(div).addClass('has-label');
			} else if (builder.options.useInLineLabelsForUnoButtons === true && data.text) {
				$(div).addClass('inline');
				span = L.DomUtil.create('span', 'ui-content unolabel', div);
				span.textContent = builder._cleanText(data.text);

				controls['label'] = span;
			} else {
				$(div).addClass('no-label');
			}

			// for Accessibility : graphic elements are located within buttons, the img should receive an empty alt
			if(button.getAttribute('aria-label')){ // if we already set the aria-label then do not go for image alt attr
				buttonImage.alt = '';
			}
			else if (buttonImage !== false) {
				if(data.aria) {
					buttonImage.alt = data.aria.label;
				} else {
					buttonImage.alt = builder._cleanText(data.text);
				}
			}

			let tooltip = builder._cleanText(data.tooltip) || builder._cleanText(data.text);
			if (data.command) // Add shortcut to tooltip based on command
				tooltip = JSDialog.ShortcutsUtil.getShortcut(tooltip, data.command);
			div.setAttribute('data-cooltip', tooltip);

			var isDisabled = data.enabled === false;
			if (data.command) {
				var updateFunction = function() {
					var items = builder.map['stateChangeHandler'];
					var state = items.getItemValue(data.command);

					if (state && state === 'true') {
						$(button).addClass('selected');
						$(div).addClass('selected');
						button.setAttribute('aria-pressed', true);
					}
					else {
						$(button).removeClass('selected');
						$(div).removeClass('selected');
						button.setAttribute('aria-pressed', false);
					}

					if (isDisabled) {
						div.setAttribute('disabled', 'true');
						div.setAttribute('aria-disabled', true);
					} else {
						div.removeAttribute('disabled');
						div.removeAttribute('aria-disabled');
					}
				};

				updateFunction();

				builder.map.on('commandstatechanged', function(e) {
					isDisabled = false;
					if (e.commandName === data.command)
					{
						// in some cases we will get both property like state and disabled
						// to handle it we will set disable var based on INCOMING info (ex: .uno:ParaRightToLft)
						isDisabled = e.disabled || e.state == 'disabled';
						updateFunction();
					}
				}, this);
			}

			if (isDisabled) {
				div.setAttribute('disabled', 'true');
				div.setAttribute('aria-disabled', true);
			}

			var selectFn = function() {
				L.DomUtil.addClass(button, 'selected');
				L.DomUtil.addClass(div, 'selected');
				button.setAttribute('aria-pressed', true);
			};

			var unSelectFn = function() {
				L.DomUtil.removeClass(button, 'selected');
				L.DomUtil.removeClass(div, 'selected');
				button.setAttribute('aria-pressed', false);
			};

			div.onSelect = selectFn;
			div.onUnSelect = unSelectFn;

			if (data.selected === true)
				selectFn();
		} else {
			var span = L.DomUtil.create('span', 'ui-content unolabel', div);
			span.textContent = builder._cleanText(data.text);
			controls['button'] = button;
			controls['label'] = span;
		}

		if (hasDropdownArrow || isDropdownButton) {
			$(div).addClass('has-dropdown');
			div.setAttribute('role', 'group');
			var arrowbackground;
			// isArrowInteractive is true for split buttons or dropdown buttons
			if (isArrowInteractive) {
				// Arrow should be a real button (user can interact with it)
				arrowbackground = L.DomUtil.create('button', 'arrowbackground', div);
			} else {
				// Arrow is just decoration
				arrowbackground = L.DomUtil.create('div', 'arrowbackground', div);
				arrowbackground.setAttribute('aria-hidden', 'true');
			}
			L.DomUtil.create('i', 'unoarrow', arrowbackground);
			controls['arrow'] = arrowbackground;

			if (!hasDropdownArrow && isDropdownButton) {
				// Attach both 'click' and 'keydown' event listeners for dropdown buttons only
				arrowbackground.addEventListener('click', function (event) {
					openToolBoxMenu(event);
				});
				arrowbackground.addEventListener('keydown', function (event) {
					switch (event.key) {
						case 'Enter':
							openToolBoxMenu(event);
							break;
					}
				});

				div.closeDropdown = function() {
					builder.callback('toolbox', 'closemenu', parentContainer, data.command, builder);
				};
			}
		}

		if (arrowbackground) {
			// if main button element in split button works same as arrowbackground then make sure arrowbackground not focusable due to a11y conflicts
			isSplitButton ? arrowbackground.tabIndex = '0' : arrowbackground.tabIndex = '-1';

			if (isArrowInteractive)  {
				const buttonText = data.aria && data.aria.label ? data.aria.label : builder._cleanText(data.text);
				const dropdownAriaLabelText = _('Open %NAME').replace('%NAME', buttonText);
				arrowbackground.setAttribute('aria-label', dropdownAriaLabelText);
				arrowbackground.setAttribute('aria-haspopup', true);
				arrowbackground.setAttribute('aria-expanded', false);
			} else {
				// If the dropdown arrow is not interactive then we want aria-expanded on interactive button
				button.setAttribute('aria-expanded', false);
			}
		}

		div._onDropDown = function(open) {
			// Only set aria-expanded on the button if the arrow is not interactive
			if (!isArrowInteractive)
				button.setAttribute('aria-expanded', open);
			arrowbackground.setAttribute('aria-expanded', open);
		};

		var openToolBoxMenu = function(event) {
			if (!div.hasAttribute('disabled')) {
				builder.callback('toolbox', 'openmenu', parentContainer, data.command, builder);
				event.stopPropagation();
			}
		};

		var clickFunction = function (e) {
			if (!div.hasAttribute('disabled')) {
				builder.refreshSidebar = true;
				if (data.postmessage)
					builder.map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: data.id} });
				else if (isRealUnoCommand && data.dropdown !== true)
					builder.callback('toolbutton', 'click', button, data.command, builder);
				else {
					builder.callback('toolbox', 'click', parentContainer, data.command, builder);
				}
			}
			e.preventDefault();
			e.stopPropagation();
		};

		const hasLabel = !!controls.label;
		const hasShortcut = !hasLabel || (JSDialog.ShortcutsUtil.hasShortcut(data.command));
		var mouseEnterFunction = window.touch.mouseOnly(function () {
			if (builder.map.tooltip)
				builder.map.tooltip.beginShow(div);
		});

		var mouseLeaveFunction = function () {
			if (builder.map.tooltip)
				builder.map.tooltip.beginHide(div);
		};

		$(controls.button).on('click', clickFunction);
		$(controls.label).on('click', clickFunction);
		// We need a way to also handle the custom tooltip for any tool button like save in shortcut bar
		if (data.isCustomTooltip) {
			this._handleCutomTooltip(div, builder);
		}
		else if (hasShortcut) {
			$(div).on('mouseenter', mouseEnterFunction);
			$(div).on('mouseleave', mouseLeaveFunction);
		} else {
			div.removeAttribute('data-cooltip'); // We don't need a tooltip for this button
		}

		div.addEventListener('keydown', function(e) {
			switch (e.key) {
			case 'Escape':
				builder.map.focus();
				break;
			}
		});

		builder._preventDocumentLosingFocusOnClick(div);

		if (isDisabled) {
			div.setAttribute('disabled', 'true');
			div.setAttribute('aria-disabled', true);
		}

		builder.map.hideRestrictedItems(data, controls['container'], controls['container']);
		builder.map.disableLockedItem(data, controls['container'], controls['container']);

		return controls;
	},

	_handleCutomTooltip: function(elem, builder) {
		switch (elem.id) {
			case 'save':
				$(elem).on('mouseenter', window.touch.mouseOnly(function() {
					if (builder.map.tooltip)
						builder.map.tooltip.show(elem, builder.map.getLastModDateValue()); // Show the tooltip with the correct content
				}));

				$(elem).on('mouseleave', function() {
					if (builder.map.tooltip)
						builder.map.tooltip.hide(elem);
				});
		}
	},

	_mapDispatchToolItem: function (parentContainer, data, builder) {
		if (!data.command)
			data.command = data.id;

		if (data.id && data.id !== 'exportas' && data.id.startsWith('export')) {
			var format = data.id.substring('export'.length);
			app.registerExportFormat(data.text, format);

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

		$(control.button).unbind('click');
		$(control.label).unbind('click');

		if (!builder.map.isLockedItem(data)) {
			var handlePressAndHold = function(data) {
				const scrollingInterval = setInterval(function () {
					app.dispatcher.dispatch(data.command);
				}, 100);

				$(document).one('mouseup', function () {
					clearInterval(scrollingInterval);
				});
			};

			// Handle "Press+Hold" Event
			if (data.pressAndHold) {
				$(control.container).on('mousedown', (e) => {
					if (e.button !== 0 // Only handle left mouse button
						|| control.container.getAttribute('disabled') !== null)
						return;

					const pressAndHoldTimer = setTimeout(() => {
						handlePressAndHold(data);
					}, 500);

					$(document).one('mouseup', () => {
						clearTimeout(pressAndHoldTimer);
					});
				});
			}

			$(control.container).click(function () {
				if (control.container.getAttribute('disabled') === null)
					app.dispatcher.dispatch(data.command);
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

		$(control.button).unbind('click');
		$(control.label).unbind('click');

		if (!builder.map.isLockedItem(data)) {
			$(control.container).click(function (e) {
				e.preventDefault();
				app.dispatcher.dispatch(data.command);
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

	_subMenuHandler: function(parentContainer, data, builder) {
		var title = data.text;
		builder._explorableMenu(parentContainer, title, data.children, builder, undefined, data.id);

		return false;
	},

	_menuItemHandler: function(parentContainer, data, builder) {
		var title = data.text;
		var cssClassHeader = 'ui-header';
		// separator
		if (title === '') {
			return false;
		}

		var id = data.id;
		if (id) {
			cssClassHeader += ' ui-header-' + id;
			var handler = builder._menuItemHandlers[id];
			if (handler) {
				handler(parentContainer, data, builder);
				return;
			}
		}

		var menuEntry = L.DomUtil.create('div', cssClassHeader + ' level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);

		if (data.hyperlink) {
			menuEntry = L.DomUtil.create('a', 'context-menu-link', menuEntry);
			menuEntry.href = '#';
		}

		var icon = null;
		var commandName = data.command && data.command.startsWith('.uno:') ? data.command.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && app.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var iconName = builder._generateMenuIconName(commandName);
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon ' + iconName, menuEntry);
			iconName = app.LOUtil.getIconNameOfCommand(iconName, true);
			icon = L.DomUtil.create('img', '', iconSpan);
			app.LOUtil.setImage(icon, iconName, builder.map);
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
			$(menuEntry).click(() => {
				if (window.insertionMobileWizard)
					app.dispatcher.dispatch('insertion_mobile_wizard');
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
		app.layoutingService.appendLayoutingTask(() => { this.executeActionImpl(container, data); });
	},

	executeActionImpl: function(container, data) {
		var control = container.querySelector('[id=\'' + this._removeMenuId(data.control_id) + '\']');
		if (!control && data.control)
			control = container.querySelector('[id=\'' + this._removeMenuId(data.control.id) + '\']');
		if (!control) {
			window.app.console.warn('executeAction: not found control with id: "' + data.control_id + '"');
			return;
		}

		switch (data.action_type) {
		case 'grab_focus':
			if (typeof control.onFocus === 'function')
				control.onFocus();
			else
				control.focus();
			break;
		case 'select':
			if (typeof control.onSelect === 'function')
				control.onSelect(parseInt(data.position));
			else
				window.app.console.warn('widget "' + data.control_id + '" doesn\'t support "select" action');
			break;

		case 'unselect':
			if (typeof control.onSelect === 'function')
				control.onUnSelect(parseInt(data.position));
			else
				window.app.console.warn('widget "' + data.control_id + '" doesn\'t support "unselect" action');
			break;

		case 'show':
			$(control).removeClass('hidden');
			$(control).show();
			break;

		case 'hide':
			$(control).addClass('hidden');
			break;

		case 'enable':
			control.disabled = false;
			control.removeAttribute('disabled');
			break;

		case 'disable':
			control.setAttribute('disabled', 'true');
			control.disabled = true;
			break;

		case 'setText':
			if (typeof control.onSetText === 'function') {
				control.onSetText(data.text);
				break;
			}

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

		case 'rendered_entry':
		case 'rendered_combobox_entry':
			if (!this.rendersCache[control.id])
				this.rendersCache[control.id] = { persistent: false, images: [] };

			this.rendersCache[control.id].images[data.pos] = data.image;

			if (typeof control.updateRenders == 'function')
				control.updateRenders(data.pos);

			break;

		default:
			console.error('unknown action: "' + data.action_type + '"');
			break;
		}
	},

	_removeMenuId: function (rawId) {
		var elementId = rawId;
		var separatorPos = elementId.indexOf(':'); // delete menuId
		if (separatorPos > 0)
			elementId = elementId.substr(0, separatorPos);
		return elementId;
	},

	_updateWidgetImpl: function (container, data, buildFunc) {
		var elementId = this._removeMenuId(data.id);
		var control = container.querySelector('[id=\'' + elementId + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + elementId + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		var scrollTop = control.scrollTop;
		var focusedElement = document.activeElement;
		var focusedElementInDialog = focusedElement ? container.querySelector('[id=\'' + focusedElement.id + '\']') : null;
		var focusedId = focusedElementInDialog ? focusedElementInDialog.id : null;

		var temporaryParent = new DocumentFragment();

		// Remove the id of the to-be-removed control, so _makeIdUnique() won't rename
		// data.id to something we can't find later.
		control.id = '';

		buildFunc.bind(this)(temporaryParent, [data], false);
		var backupGridSpan = control.style.gridColumn;

		control.replaceWith(temporaryParent.firstChild)
		let onclick = control.onclick;

		var newControl = container.querySelector('[id=\'' + elementId + '\']');
		if (newControl) {
			if (onclick) {
				newControl.onclick = onclick;
			}
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
		app.layoutingService.appendLayoutingTask(() => {
			this._updateWidgetImpl(container, data, this.build);
		});
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

		// natural tab-order when using keyboard navigation
		if (control && !control.hasAttribute('tabIndex')
			&& control.querySelectorAll('[tabindex]').length === 0
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
			&& data.type !== 'treelistbox'
			&& data.type !== 'time'
			&& data.type !== 'separator'
			&& data.type !== 'spacer'
			&& data.type !== 'edit'
			&& data.type !== 'deck'
			)
			control.setAttribute('tabIndex', '0');
	},

	// some widgets we want to modify / change
	isHyperlinkTarget: function (builder, data) {
		return data.type === 'combobox' && (data.id === 'target' || data.id === 'receiver');
	},

	requiresOverwriting: function(builder, data) {
		if (builder.isHyperlinkTarget(builder, data))
			return true;

		return false;
	},

	overwriteHandler: function(parentContainer, data, builder) {
		if (builder.isHyperlinkTarget(builder, data)) {
			// Replace combobox with edit
			var callback = function(value) {
				builder.callback('combobox', 'change', data, value, builder);
			};

			return builder._controlHandlers['edit'](parentContainer, data, builder, callback);
		}

		console.error('It seems widget doesn\'t require overwriting.');
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

			if (childData.dialogid) {
				containerToInsert.id = childData.dialogid;
				this.dialogId = childData.dialogid;
			}

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
				if (this.requiresOverwriting(this, childData))
					processChildren = this.overwriteHandler(childObject, childData, this);
				else
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

L.control.jsDialogBuilder = function (options) {
	var builder = new L.Control.JSDialogBuilder(options);
	builder._setup(options);
	return builder;
};
