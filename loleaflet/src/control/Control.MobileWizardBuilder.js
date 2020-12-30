/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizardBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ */

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
	},

	baseSpinField: function(parentContainer, data, builder, customCallback) {
		var controls = {};
		if (data.label) {
			var fixedTextData = { text: data.label };
			builder._fixedtextControl(parentContainer, fixedTextData, builder);
		}

		console.debug('baseSpinField: ' + data.id);

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

		if (data.enabled == 'false') {
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
		if (data.children.length > 1) {
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

		if (data.enabled == 'false') {
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

			if (state && state === 'true' || state === 1 || state === '1')
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
		var container = L.DomUtil.createWithId('div', data.id + '-container', parentContainer);
		L.DomUtil.addClass(container, 'radiobutton');
		L.DomUtil.addClass(container, builder.options.cssClass);

		var radiobutton = L.DomUtil.createWithId('input', data.id, container);
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
			builder.callback('radiobutton', 'change', radiobutton, this.checked, builder);
		});

		if (data.hidden)
			$(radiobutton).hide();

		return false;
	},

	build: function(parent, data) {
		this._amendJSDialogData(data);
		for (var childIndex in data) {
			if (!data[childIndex])
				continue;

			var childData = data[childIndex];
			if (!childData)
				continue;
			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;
			var needsToCreateContainer =
				childType == 'panel';

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

			if (childData.children && childData.children.length == 1
				&& childData.children[0] && childData.children[0].type == 'panel') {
				handler = this._controlHandlers['singlepanel'];
				processChildren = handler(childObject, childData.children, this);
			} else if (twoPanelsAsChildren) {
				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, childData.children, this);
			} else {
				if (handler)
					processChildren = handler(childObject, childData, this);
				else
					console.warn('JSDialogBuilder: Unsupported control type: "' + childType + '"');

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
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
