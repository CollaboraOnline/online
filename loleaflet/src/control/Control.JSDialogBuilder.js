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
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['fixedtext'] = this._fixedtextControl;
		this._controlHandlers['grid'] = this._containerHandler;
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

		this._controlHandlers['mainmenu'] = this._containerHandler;
		this._controlHandlers['submenu'] = this._subMenuHandler;
		this._controlHandlers['menuitem'] = this._menuItemHandler;

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = this._lineWidthControl;
		this._toolitemHandlers['.uno:CharFontName'] = this._fontNameControl;
		this._toolitemHandlers['.uno:FontHeight'] = this._fontHeightControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;

		this._currentDepth = 0;
	},

	_clearColorPickers: function() {
		while (this._colorPickers.length) {
			var id = this._colorPickers.pop();
			w2ui[id].remove();
			delete w2ui[id];
		}
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

	_explorableMenu: function(parentContainer, title, children, builder) {
		var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);
		if (builder._currentDepth === 0) {
			$(sectionTitle).css('justify-content', 'space-between');

			var titleSpan = L.DomUtil.create('span', 'sub-menu-title', sectionTitle);
			titleSpan.innerHTML = title;
			var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', sectionTitle);
			arrowSpan.innerHTML = '>';
		} else {
			sectionTitle.innerHTML = title;
		}

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', parentContainer);
		contentDiv.title = title;

		builder._currentDepth++;
		for (var i = 0; i < children.length; i++) {
			builder.build(contentDiv, [children[i]]);
		}
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
		var title = data.text;
		var contentNode = data.children[0];

		builder._explorableEntry(parentContainer, title, contentNode, builder);

		return false;
	},

	_panelTabsHandler: function(parentContainer, data, builder) {
		var tabsContainer = L.DomUtil.create('div', 'ui-tabs mobile-wizard ui-widget');
		var contentsContainer = L.DomUtil.create('div', 'ui-tabs-content mobile-wizard ui-widget', parentContainer);

		var title1 = builder._cleanText(data.children[1].text);
		var icon1 = builder._createIconPath(title1);

		var tab1 = L.DomUtil.create('div', 'ui-tab mobile-wizard', tabsContainer);

		var button = L.DomUtil.create('img', 'ui-tab-content mobile-wizard unobutton', tab1);
		button.src = icon1;

		var label = L.DomUtil.create('span', 'ui-tab-content mobile-wizard unolabel', tab1);
		label.innerHTML = title1;

		var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', contentsContainer);
		contentDiv.title = title1;

		builder._currentDepth++;
		for (var i = 0; i < data.children[1].children[0].children.length; i++) {
			builder.build(contentDiv, [data.children[1].children[0].children[i]]);
		}
		builder._currentDepth--;

		$(contentDiv).hide();


		var tab2 = L.DomUtil.create('div', 'ui-tab mobile-wizard', tabsContainer);

		var title2 = builder._cleanText(data.children[3].text);
		var icon2 = builder._createIconPath(title2);

		var button2 = L.DomUtil.create('img', 'ui-tab-content mobile-wizard unobutton', tab2);
		button2.src = icon2;

		var label2 = L.DomUtil.create('span', 'ui-tab-content mobile-wizard unolabel', tab2);
		label2.innerHTML = title2;

		var contentDiv2 = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' mobile-wizard', contentsContainer);
		contentDiv2.title = title2;

		builder._currentDepth++;
		for (i = 0; i < data.children[3].children[0].children.length; i++) {
			builder.build(contentDiv2, [data.children[3].children[0].children[i]]);
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

	_spinfieldControl: function(parentContainer, data, builder) {
		var spinfield = L.DomUtil.create('input', '', parentContainer);
		spinfield.type = 'number';
		spinfield.id = data.id;

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

	_pushbuttonControl: function(parentContainer, data, builder) {
		var pushbutton = L.DomUtil.create('button', '', parentContainer);
		pushbutton.innerHTML = builder._cleanText(data.text);
		pushbutton.id = data.id;

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
		// TODO: event listener in the next level...

		if (!data.entries || data.entries.length == 0)
			return false;

		var title = data.text;
		if (data.selectedEntries)
			title = data.entries[data.selectedEntries[0]];
		title = builder._cleanText(title);

		var entries = [];
		for (var index in data.entries) {
			var entry = { type: 'fixedtext', text: data.entries[index] };
			entries.push(entry);
		}

		var contentNode = {type: 'container', children: entries};

		builder._explorableEntry(parentContainer, title, contentNode, builder);

		return false;
	},

	_fixedtextControl: function(parentContainer, data, builder) {
		var fixedtext = L.DomUtil.create('p', '', parentContainer);
		fixedtext.innerHTML = builder._cleanText(data.text);
		fixedtext.id = data.id;

		if (data.hidden)
			$(fixedtext).hide();

		return false;
	},

	_createIconPath: function(name) {
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

	_colorControl: function(parentContainer, data, builder) {
		var colorContainer = L.DomUtil.create('div', 'colorcontainer', parentContainer);
		colorContainer.id = data.command.substr('.uno:'.length);

		if (data.enabled == 'false')
			$(colorContainer).attr('disabled', 'disabled');

		var imageContainer = L.DomUtil.create('div', 'colorimagecontainer', colorContainer);
		var image = L.DomUtil.create('img', 'colorimage', imageContainer);
		var icon = builder._createIconPath(data.command);
		image.src = icon;

		var toolbarContainer = L.DomUtil.create('div', 'colorspan', colorContainer);
		var toolbar = $(toolbarContainer);
		var id = 'colorselector-' + builder._colorPickers.length;
		var items = [{type: 'color',  id: 'color'}];
		toolbar.w2toolbar({
			name: id,
			tooltip: 'bottom',
			items: items
		});
		w2ui[id].set('color', {color: '#ff0033'});
		builder._colorPickers.push(id);

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

		var menuEntry = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' mobile-wizard ui-widget', parentContainer);

		var icon = null;
		var commandName = data.command ? data.command.substring('.uno:'.length) : data.id;
		if (commandName && commandName.length && L.LOUtil.existsIconForCommand(commandName)) {
			var iconSpan = L.DomUtil.create('span', 'menu-entry-icon', menuEntry);
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
				window.onClick(null, 'insertion_mobile_wizard');
			});
		} else {
			console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}

		return false;
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
		for (var childIndex in data) {
			var childData = data[childIndex];
			var childType = childData.type;
			var processChildren = true;
			var isPanelOrFrame = childType == 'panel' || childType == 'frame';

			var childObject = isPanelOrFrame ? L.DomUtil.create('div', '', parent) : parent;

			var handler = this._controlHandlers[childType];

			var twoPanelsAsChildren = childData.children && childData.children.length == 5
				&& childData.children[1] && childData.children[1].type == 'panel'
				&& childData.children[3] && childData.children[3].type == 'panel';

			if (twoPanelsAsChildren) {
				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, childData, this);
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
