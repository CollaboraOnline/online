/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global $ */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	onAdd: function (map) {
		this.map = map;
	},

	build: function(parent, data) {
		this._amendJSDialogData(data);

		if (data.length > 1) {
			var table = L.DomUtil.create('table', '', parent);
			var tr = L.DomUtil.create('tr', '', table);
		} else {
			tr = parent;
		}

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			var td = (data.length > 1) ? L.DomUtil.create('td', '', tr) : tr;

			this._parentize(childData);
			var childType = childData.type;
			var processChildren = true;
			var needsToCreateContainer =
				childType == 'panel' || childType == 'frame';

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var childObject = needsToCreateContainer ? L.DomUtil.createWithId('div', childData.id, td) : td;

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
					this.build(childObject, childData.children);
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
	return builder;
};
