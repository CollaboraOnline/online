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
