/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global $ */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	onAdd: function (map) {
		this.map = map;
	},

	_overrideHandlers: function() {
		this._controlHandlers['combobox'] = function() {return false;};
		this._controlHandlers['listbox'] = function() {return false;};

		this._toolitemHandlers['.uno:XLineColor'] = function() {};
		this._toolitemHandlers['.uno:SelectWidth'] = function() {};
		this._toolitemHandlers['.uno:FontColor'] = function() {};
		this._toolitemHandlers['.uno:BackColor'] = function() {};
		this._toolitemHandlers['.uno:CharBackColor'] = function() {};
		this._toolitemHandlers['.uno:BackgroundColor'] = function() {};
		this._toolitemHandlers['.uno:FrameLineColor'] = function() {};
		this._toolitemHandlers['.uno:Color'] = function() {};
		this._toolitemHandlers['.uno:FillColor'] = function() {};
		this._toolitemHandlers['.uno:ResetAttributes'] = function() {};
	},

	_unoToolButton: function(parentContainer, data, builder) {
		var button = null;

		var div = this._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', parentContainer, data);

		if (data.command) {
			var id = data.command.substr('.uno:'.length);
			div.id = id;

			var icon = builder._createIconPath(data.command);
			var buttonId = id + 'img';

			button = L.DomUtil.create('img', 'ui-content unobutton', div);
			button.src = icon;
			button.id = buttonId;

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
	return builder;
};
