/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialogBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global $ */
L.Control.JSDialogBuilder = L.Control.extend({

	/* Handler is a function which takes two parameters:
	 * parentContainer - place where insert the content
	 * data - data of a control under process
	 * returns boolean: true if children should be processed
	 * and false otherwise
	 */
	_controlHandlers: {},

	_currentDepth: 0,

	_setup: function() {
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['checkbox'] = this._checkboxControl;
		this._controlHandlers['spinfield'] = this._spinfieldControl;
		this._controlHandlers['edit'] = this._editControl;
		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['frame'] = this._frameHandler;
		this._controlHandlers['panel'] = this._panelHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;
		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['control'] = this._containerHandler;
		this._controlHandlers['scrollbar'] = this._ignoreHandler;
		this._controlHandlers['toolbox'] = this._ignoreHandler;
		this._currentDepth = 0;
	},

	_containerHandler: function() {
		return true;
	},

	_ignoreHandler: function() {
		return false;
	},

	_explorableEntry: function(parentContainer, title, contentNode, builder) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		sectionTitle.innerHTML = title;

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);

		builder._currentDepth++;
		builder.build(contentDiv, [contentNode]);
		builder._currentDepth--;

		$(contentDiv).hide();
		$(sectionTitle).click(function() {
			var titles = '.ui-header.level-' + builder.wizard._currentDepth + '.mobile-wizard';

			$(titles).hide('slide', { direction: 'left' }, 'fast', function() {});
			$(contentDiv).show('slide', { direction: 'right' }, 'fast');

			builder.wizard._currentDepth++;
			builder.wizard._setTitle(title);
			builder.wizard._inMainMenu = false;
		});
	},

	_frameHandler: function(parentContainer, data, builder) {
		var title = data.children[0].text;
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

	_radiobuttonControl: function(parentContainer, data) {
		var radiobutton = L.DomUtil.create('input', '', parentContainer);
		radiobutton.type = 'radiobutton';
		radiobutton.value = data.text;

		if (data.enabled == 'false')
			$(radiobutton).attr('disabled', 'disabled');

		return false;
	},

	_checkboxControl: function(parentContainer, data) {
		var checkbox = L.DomUtil.createWithId('input', data.id, parentContainer);
		checkbox.type = 'checkbox';
		var checkboxLabel = L.DomUtil.create('label', '', parentContainer);
		checkboxLabel.innerHTML = data.text;
		checkboxLabel.for = data.id;

		if (data.enabled == 'false')
			$(checkbox).attr('disabled', 'disabled');

		return false;
	},

	_spinfieldControl: function(parentContainer, data) {
		var spinfield = L.DomUtil.create('input', '', parentContainer);
		spinfield.type = 'number';
		spinfield.value = data.text;

		if (data.enabled == 'false')
			$(spinfield).attr('disabled', 'disabled');

		return false;
	},

	_editControl: function(parentContainer, data) {
		var edit = L.DomUtil.create('input', '', parentContainer);
		edit.value = data.text;

		if (data.enabled == 'false')
			$(edit).attr('disabled', 'disabled');

		return false;
	},

	_pushbuttonControl: function(parentContainer, data) {
		var pushbutton = L.DomUtil.create('button', '', parentContainer);
		pushbutton.innerHTML = data.text;

		if (data.enabled == 'false')
			$(pushbutton).attr('disabled', 'disabled');

		return false;
	},

	_comboboxControl: function(parentContainer, data) {
		var listbox = L.DomUtil.create('select', '', parentContainer);
		listbox.value = data.text;

		if (data.enabled == 'false')
			$(listbox).attr('disabled', 'disabled');

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
			var processChildren = true;

			if (currentIsContainer) {
				var horizontalOverflow = (childIndex > 0 && columns && (childIndex % columns == 0));
				var newRow = currentIsVertival || horizontalOverflow;
				if (newRow) {
					currentHorizontalRow = L.DomUtil.create('tr', '', parent);
					currentInsertPlace = L.DomUtil.create('td', '', currentHorizontalRow);
				} else
					currentInsertPlace = L.DomUtil.create('td', '', currentHorizontalRow);
			}

			var childIsContainer = (childType == 'container' || childType == 'borderwindow') && childData.children.length > 1;
			var childIsVertical = childData.vertical == 'true';
			var childColumns = childData.cols;

			var childObject = null;
			if (childIsContainer && childType != 'borderwindow')
				childObject = L.DomUtil.create('table', '', currentInsertPlace);
			else
				childObject = currentInsertPlace;

			var handler = this._controlHandlers[childType];

			if (handler)
				processChildren = handler(childObject, childData, this);
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
	builder.wizard = options.mobileWizard;
	return builder;
};
