/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global $ _ */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	_customizeOptions: function() {
		this.options.noLabelsForUnoButtons = true;
		this.options.cssClass = 'notebookbar';
	},

	_overrideHandlers: function() {
		this._controlHandlers['combobox'] = this._comboboxControl;
		this._controlHandlers['listbox'] = this._comboboxControl;
		this._controlHandlers['pushbutton'] = function() { return false; };
		this._controlHandlers['spinfield'] = function() { return false; };

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:SelectWidth'] = function() {};
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:CharBackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;
		this._toolitemHandlers['vnd.sun.star.findbar:FocusToFindbar'] = function() {};
	},

	_comboboxControl: function(parentContainer, data, builder) {
		if (!data.entries || data.entries.length === 0)
			return false;

		var select = L.DomUtil.createWithId('select', data.id, parentContainer);
		$(select).addClass(builder.options.cssClass);

		$(select).select2({
			data: data.entries.sort(function (a, b) {return a.localeCompare(b);}),
			placeholder: _(builder._cleanText(data.text))
		});

		return false;
	},

	_colorControl: function(parentContainer, data, builder) {
		var titleOverride = builder._getTitleForControlWithId(data.id);
		if (titleOverride)
			data.text = titleOverride;

		data.id = data.id ? data.id : (data.command ? data.command.replace('.uno:', '') : undefined);

		data.text = builder._cleanText(data.text);

		if (data.command) {
			var div = builder._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', parentContainer, data);

			var id = data.command.substr('.uno:'.length);
			div.id = id;

			div.title = data.text;
			$(div).tooltip();

			var icon = builder._createIconPath(data.command);
			var buttonId = id + 'img';

			var button = L.DomUtil.create('img', 'ui-content unobutton', div);
			button.src = icon;
			button.id = buttonId;

			var valueNode =  L.DomUtil.create('div', 'selected-color', div);

			var selectedColor;

			var updateFunction = function (color) {
				selectedColor = builder._getCurrentColor(data, builder);
				valueNode.style.backgroundColor = color ? color : selectedColor;
			};

			updateFunction();

			builder.map.on('commandstatechanged', function(e) {
				if (e.commandName === data.command)
					updateFunction();
			}, this);

			var noColorControl = (data.command !== '.uno:FontColor' && data.command !== '.uno:Color');

			$(div).click(function() {
				$(div).w2color({ color: selectedColor, transparent: noColorControl }, function (color) {
					if (color != null) {
						if (color) {
							updateFunction('#' + color);
							builder._sendColorCommand(builder, data, color);
						} else {
							updateFunction('#FFFFFF');
							builder._sendColorCommand(builder, data, 'transparent');
						}
					}
				});
			});
		}

		return false;
	},

	build: function(parent, data, hasVerticalParent, parentHasManyChildren) {
		this._amendJSDialogData(data);

		if (hasVerticalParent === undefined) {
			parent = L.DomUtil.create('table', 'root-container ' + this.options.cssClass, parent);
			parent = L.DomUtil.create('tr', '', parent);
		}

		var containerToInsert = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			if (parentHasManyChildren) {
				if (!hasVerticalParent)
					var td = L.DomUtil.create('td', '', containerToInsert);
				else {
					containerToInsert = L.DomUtil.create('tr', '', parent);
					td = L.DomUtil.create('td', '', containerToInsert);
				}
			} else {
				td = containerToInsert;
			}

			var isVertical = childData.vertical === 'true' ? true : false;

			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var hasManyChildren = childData.children && childData.children.length > 1;
			if (hasManyChildren) {
				var table = L.DomUtil.create('table', '', td);
				var childObject = L.DomUtil.create('tr', '', table);
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
					console.warn('Unsupported control type: \"' + childType + '\"');

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children, isVertical, hasManyChildren);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
				}
			}
		}
	}

});

L.control.notebookbarBuilder = function (options) {
	var builder = new L.Control.NotebookbarBuilder(options);
	builder._setup(options);
	builder._overrideHandlers();
	builder._customizeOptions();
	return builder;
};
