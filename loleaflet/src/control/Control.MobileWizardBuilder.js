/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizardBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ _UNO _ */

L.Control.MobileWizardBuilder = L.Control.JSDialogBuilder.extend({
	_customizeOptions: function() {
		this.options.noLabelsForUnoButtons = false;
		this.options.useInLineLabelsForUnoButtons = false;
		this.options.cssClass = 'mobile-wizard';
	},

	_overrideHandlers: function() {
		this._controlHandlers['grid'] = this._gridHandler;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['listbox'] = this._listboxControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['basespinfield'] = this.baseSpinField;
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['toolbox'] = this._toolboxHandler;
		this._controlHandlers['mobile-popup-container'] = this._mobilePopupContainer;

		this._toolitemHandlers['.uno:FontworkAlignmentFloater'] = function () { return false; };
		this._toolitemHandlers['.uno:FontworkCharacterSpacingFloater'] = function () { return false; };
		this._toolitemHandlers['.uno:ExtrusionToggle'] = function () { return false; };
		this._toolitemHandlers['.uno:Grow'] = function () { return false; };
		this._toolitemHandlers['.uno:Shrink'] = function () { return false; };
		this._toolitemHandlers['.uno:StyleUpdateByExampleimg'] = function () { return false; };
		this._toolitemHandlers['.uno:StyleNewByExampleimg'] = function () { return false; };
		this._toolitemHandlers['.uno:LineEndStyle'] = function () { return false; };

		this._toolitemHandlers['.uno:FontworkShapeType'] = this._fontworkShapeControl;
		this._toolitemHandlers['SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:XLineStyle'] = this._explorableToolItemHandler;
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

		var commandName = data.id ? data.id.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName, builder.map.getDocType())) {
			var image = L.DomUtil.create('img', 'spinfieldimage', div);
			var icon = (data.id === 'Transparency') ? builder._createIconURL('settransparency') : builder._createIconURL(data.id);
			image.src = icon;
			icon.alt = '';
		}

		var spinfield = L.DomUtil.create('input', 'spinfield', div);
		spinfield.type = 'number';
		spinfield.onkeypress = builder._preventNonNumericalInput;
		controls['spinfield'] = spinfield;

		if (data.unit) {
			var unit = L.DomUtil.create('span', 'spinfieldunit', div);
			unit.innerHTML = builder._unitToVisibleString(data.unit);
		}

		var controlsContainer = L.DomUtil.create('div', 'spinfieldcontrols', div);
		var minus = L.DomUtil.create('div', 'minus', controlsContainer);
		minus.innerHTML = '-';

		var plus = L.DomUtil.create('div', 'plus', controlsContainer);
		plus.innerHTML = '+';

		if (data.min != undefined)
			$(spinfield).attr('min', data.min);

		if (data.max != undefined)
			$(spinfield).attr('max', data.max);

		if (data.step != undefined)
			$(spinfield).attr('step', data.step);

		if (data.enabled === 'false' || data.enabled === false) {
			$(spinfield).attr('disabled', 'disabled');
			$(image).addClass('disabled');
		}

		if (data.readOnly === true)
			$(spinfield).attr('readOnly', 'true');

		if (data.hidden)
			$(spinfield).hide();

		plus.addEventListener('click', function() {
			var attrdisabled = $(spinfield).attr('disabled');
			if (attrdisabled !== 'disabled') {
				if (customCallback)
					customCallback('spinfield', 'plus', div, this.value, builder);
				else
					builder.callback('spinfield', 'plus', div, this.value, builder);
			}
		});

		minus.addEventListener('click', function() {
			var attrdisabled = $(spinfield).attr('disabled');
			if (attrdisabled !== 'disabled') {
				if (customCallback)
					customCallback('spinfield', 'minus', div, this.value, builder);
				else
					builder.callback('spinfield', 'minus', div, this.value, builder);
			}
		});

		return controls;
	},

	_preventNonNumericalInput: function(e) {
		e = e || window.event;
		var charCode = (typeof e.which === undefined) ? e.keyCode : e.which;
		var charStr = String.fromCharCode(charCode);

		if (!charStr.match(/^[0-9.,]+$/) && charCode !== 13)
			e.preventDefault();
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

	_frameHandler: function(parentContainer, data, builder) {
		// display explorable entry only if more than one widget inside
		if (data.children.length > 2) {
			data.text = builder._cleanText(data.children[0].text);
			var contentNode = data.children[1];
			builder._explorableEntry(parentContainer, data, contentNode, builder);
		} else {
			return true;
		}

		return false;
	},

	_listboxControl: function(parentContainer, data, builder) {
		// TODO: event listener in the next level...

		if (!data.entries || data.entries.length === 0)
			return false;

		builder._setIconAndNameForCombobox(data);

		if (data.id === 'FontBox')
			data.text = '';

		var title = data.text;
		var valueNode = null;
		var selectedEntryIsString = false;
		if (data.selectedEntries) {
			selectedEntryIsString = isNaN(parseInt(data.selectedEntries[0]));
			if (title && title.length) {
				var value = data.entries[data.selectedEntries[0]];
				valueNode = L.DomUtil.create('div', '', null);
				valueNode.innerHTML = value;
			} else if (selectedEntryIsString)
				title = builder._cleanText(data.selectedEntries[0]);
			else
				title = data.entries[data.selectedEntries[0]];
		}
		title = builder._cleanText(title);
		data.text = title;

		var entries = [];
		for (var index in data.entries) {
			var style = 'ui-combobox-text';
			if ((data.selectedEntries && index == data.selectedEntries[0])
				|| (data.selectedEntries && selectedEntryIsString && data.entries[index] === data.selectedEntries[0])
				|| data.entries[index] == title) {
				style += ' selected';
			}

			var entry = { type: 'comboboxentry', text: data.entries[index], pos: index, parent: data, style: style };
			entries.push(entry);
		}

		var contentNode = {type: 'container', children: entries};

		var iconPath = null;
		if (data.command)
			iconPath = builder._createIconURL(data.command);

		builder._explorableEntry(parentContainer, data, contentNode, builder, valueNode, iconPath);

		return false;
	},

	_checkboxControl: function(parentContainer, data, builder) {
		var div = L.DomUtil.createWithId('div', data.id, parentContainer);
		L.DomUtil.addClass(div, 'checkbutton');

		var checkboxLabel = L.DomUtil.create('label', '', div);
		checkboxLabel.innerHTML = builder._cleanText(data.text);
		checkboxLabel.for = data.id;
		var checkbox = L.DomUtil.createWithId('input', data.id, div);
		checkbox.type = 'checkbox';

		if (data.enabled === 'false' || data.enabled === false) {
			$(checkboxLabel).addClass('disabled');
			$(checkbox).attr('disabled', 'disabled');
		}

		checkbox.addEventListener('change', function() {
			builder.callback('checkbox', 'change', div, this.checked, builder);
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

	// TODO: use the same handler as desktop one
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

		if (data.enabled === 'false' || data.enabled === false)
			$(radiobutton).attr('disabled', 'disabled');

		if (data.checked === 'true' || data.checked === true)
			$(radiobutton).prop('checked', true);

		radiobutton.addEventListener('change', function() {
			builder.callback('radiobutton', 'change', container, this.checked, builder);
		});

		if (data.hidden)
			$(radiobutton).hide();

		return false;
	},

	_editControl: function(parentContainer, data, builder, callback) {
		var edit = L.DomUtil.create('input', 'ui-edit ' + builder.options.cssClass, parentContainer);
		edit.value = builder._cleanText(data.text);
		edit.id = data.id;

		if (data.enabled === 'false' || data.enabled === false)
			$(edit).prop('disabled', true);

		// we still use non welded sidebar where don't have partial updates
		// kayup can be used only in welded dialogs
		edit.addEventListener('change', function() {
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

	_fontworkShapeControl: function(parentContainer, data, builder) {
		var json = [
			{
				id: 'fontworkproperties',
				type: 'frame',
				children: [
					{
						text: _UNO('.uno:FontworkShapeType')
					},
					{
						id: 'fontworkshape',
						type: 'toolbox',
						children: [
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-plain-text'),
								command: '.uno:FontworkShapeType.fontwork-plain-text'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-wave'),
								command: '.uno:FontworkShapeType.fontwork-wave'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-inflate'),
								command: '.uno:FontworkShapeType.fontwork-inflate'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-stop'),
								command: '.uno:FontworkShapeType.fontwork-stop'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-curve-up'),
								command: '.uno:FontworkShapeType.fontwork-curve-up'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-curve-down'),
								command: '.uno:FontworkShapeType.fontwork-curve-down'
							},

							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-triangle-up'),
								command: '.uno:FontworkShapeType.fontwork-triangle-up'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-triangle-down'),
								command: '.uno:FontworkShapeType.fontwork-triangle-down'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-right'),
								command: '.uno:FontworkShapeType.fontwork-fade-right'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-left'),
								command: '.uno:FontworkShapeType.fontwork-fade-left'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-up'),
								command: '.uno:FontworkShapeType.fontwork-fade-up'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-down'),
								command: '.uno:FontworkShapeType.fontwork-fade-down'
							},

							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-slant-up'),
								command: '.uno:FontworkShapeType.fontwork-slant-up'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-slant-down'),
								command: '.uno:FontworkShapeType.fontwork-slant-down'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-up-and-right'),
								command: '.uno:FontworkShapeType.fontwork-fade-up-and-right'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-fade-up-and-left'),
								command: '.uno:FontworkShapeType.fontwork-fade-up-and-left'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-chevron-up'),
								command: '.uno:FontworkShapeType.fontwork-chevron-up'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-chevron-down'),
								command: '.uno:FontworkShapeType.fontwork-chevron-down'
							},

							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-up-curve'),
								command: '.uno:FontworkShapeType.fontwork-arch-up-curve'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-down-curve'),
								command: '.uno:FontworkShapeType.fontwork-arch-down-curve'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-left-curve'),
								command: '.uno:FontworkShapeType.fontwork-arch-left-curve'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-right-curve'),
								command: '.uno:FontworkShapeType.fontwork-arch-right-curve'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-circle-curve'),
								command: '.uno:FontworkShapeType.fontwork-circle-curve'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-open-circle-curve'),
								command: '.uno:FontworkShapeType.fontwork-open-circle-curve'
							},

							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-up-pour'),
								command: '.uno:FontworkShapeType.fontwork-arch-up-pour'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-down-pour'),
								command: '.uno:FontworkShapeType.fontwork-arch-down-pour'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-down-pour'),
								command: '.uno:FontworkShapeType.fontwork-arch-down-pour'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-arch-right-pour'),
								command: '.uno:FontworkShapeType.fontwork-arch-right-pour'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-circle-pour'),
								command: '.uno:FontworkShapeType.fontwork-circle-pour'
							},
							{
								type: 'toolitem',
								text: _UNO('.uno:FontworkShapeType.fontwork-open-circle-pour'),
								command: '.uno:FontworkShapeType.fontwork-open-circle-pour'
							},
						]
					}
				]
			}
		];

		builder.build(parentContainer, json);
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

	_panelHandler: function(parentContainer, data, builder) {
		var content = data.children;

		var iconPath = null;
		var entryId = data.id;
		if (entryId && entryId.length) {
			iconPath = builder._createIconURL(entryId);
		}

		builder._explorableEntry(parentContainer, data, content, builder, null, iconPath);

		if (data.hidden === true) {
			var control = parentContainer.querySelector('[id=\'' + data.id + '\']');
			if (control)
				L.DomUtil.addClass(control, 'hidden');
		}

		return false;
	},

	_toolboxHandler: function(parentContainer, data, builder) {
		var toolbox = L.DomUtil.create('div', builder.options.cssClass + ' toolbox', parentContainer);
		toolbox.id = data.id;

		if (data.enabled === false || data.enabled === 'false') {
			for (var index in data.children) {
				data.children[index].enabled = false;
			}
		}

		builder.build(toolbox, data.children, false, false);

		return false;
	},

	_mobilePopupContainer: function(parentContainer, data) {
		var container = L.DomUtil.create('div', 'mobile-popup-container', parentContainer);
		container.id = 'popup-' + data.id;
		return false;
	},

	_explorableToolItemHandler: function(parentContainer, data, builder) {
		data.text = builder._cleanText(data.text);

		var onShow = function() {
			builder.callback('toolbox', 'togglemenu', {id: data.parent.id}, data.command, builder);
		};

		var nodeId = data.command.indexOf('.uno:') === 0 ? data.command.substr('.uno:'.length) : data.command;
		var contentNode = {id: nodeId, type: 'mobile-popup-container', children: [], onshow: onShow};
		var iconPath = builder._createIconURL(data.command);

		builder._explorableEntry(parentContainer, data, contentNode, builder, null, iconPath);

		return false;
	},

	// apply needed modifications for mobile
	_modifySidebarNodes: function(data) {
		for (var i = data.length - 1; i >= 0; i--) {
			if (data[i].type === 'menubutton' &&
				(data[i].id === 'fillgrad1'
				|| data[i].id === 'fillgrad2'
				|| data[i].id === 'LB_GLOW_COLOR')) {

				if (data[i].id === 'LB_GLOW_COLOR')
					data[i].command = '.uno:GlowColor';

				data[i].type = 'colorlistbox';
			} else if ((data[i].command === 'sidebargradient' && data[i].type === 'toolitem')
				|| (data[i].id === 'radiusglow' && data[i].type === 'fixedtext')
				|| (data[i].id === 'radiussoftedge' && data[i].type === 'fixedtext')) {
				data.splice(i, 1);
			}
		}
	},

	build: function(parent, data) {
		this._modifySidebarNodes(data);

		for (var childIndex in data) {
			if (!data[childIndex])
				continue;

			var childData = data[childIndex];
			if (!childData)
				continue;
			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var childObject = parent;
			if (childData.dialogid) {
				var dialog = L.DomUtil.createWithId('div', childData.dialogid, childObject);
				childObject = dialog;
			}

			var handler = this._controlHandlers[childType];
			var twoPanelsAsChildren =
					childData.children && childData.children.length == 2
					&& childData.children[0] && childData.children[0].type == 'panel'
					&& childData.children[1] && childData.children[1].type == 'panel';

			if (childData.children && childData.children.length == 1
				&& childData.children[0] && childData.children[0].type == 'panel') {
				handler = this._controlHandlers['singlepanel'];
				processChildren = handler(childObject, childData.children, this);
			} else if (twoPanelsAsChildren) {
				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, childData.children, this);
			} else {
				if (handler) {
					processChildren = handler(childObject, childData, this);
					this.postProcess(childObject, childData);
				} else
					console.warn('JSDialogBuilder: Unsupported control type: "' + childType + '"');

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
				}
			}

			if ((childType === 'mobilewizard' || childType === 'dialog' || childType === 'messagebox' || childType === 'modelessdialog')
				&& childData.responses) {
				for (var i in childData.responses) {
					var buttonId = childData.responses[i].id;
					var response = childData.responses[i].response;
					var button = $('#' + buttonId);
					var isHelp = response === '-11' || response === -11 || buttonId === 'help';
					if (button && isHelp)
						button.hide();
				}
			}
		}
	}
});

L.control.mobileWizardBuilder = function (options) {
	var builder = new L.Control.MobileWizardBuilder(options);
	builder._setup(options);
	builder._overrideHandlers();
	builder._customizeOptions();
	return builder;
};
