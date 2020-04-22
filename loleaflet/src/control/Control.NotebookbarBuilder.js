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
		this._controlHandlers['combobox'] = undefined;
		this._controlHandlers['listbox'] = undefined;

		this._toolitemHandlers['.uno:XLineColor'] = undefined;
		this._toolitemHandlers['.uno:SelectWidth'] = undefined;
		this._toolitemHandlers['.uno:FontColor'] = undefined;
		this._toolitemHandlers['.uno:BackColor'] = undefined;
		this._toolitemHandlers['.uno:CharBackColor'] = undefined;
		this._toolitemHandlers['.uno:BackgroundColor'] = undefined;
		this._toolitemHandlers['.uno:FrameLineColor'] = undefined;
		this._toolitemHandlers['.uno:Color'] = undefined;
		this._toolitemHandlers['.uno:FillColor'] = undefined;
		this._toolitemHandlers['.uno:ResetAttributes'] = undefined;
	},

	build: function(parent, data, hasVerticalParent) {
		this._amendJSDialogData(data);

		var containerToInsert = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			if (!hasVerticalParent)
				var td = L.DomUtil.create('td', '', containerToInsert);
			else {
				containerToInsert = L.DomUtil.create('tr', '', parent);
				td = L.DomUtil.create('td', '', containerToInsert);
			}

			var isVertical = childData.vertical === 'true' ? true : false;

			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var table = L.DomUtil.create('table', '', td);
			var childObject = L.DomUtil.create('tr', '', table);

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
					this.build(childObject, childData.children, isVertical);
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
