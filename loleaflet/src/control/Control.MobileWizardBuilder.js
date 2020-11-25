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
		// eg. this._controlHandlers['combobox'] = this._comboboxControlHandler;
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
