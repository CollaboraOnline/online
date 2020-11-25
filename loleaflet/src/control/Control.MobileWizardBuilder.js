/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizardBuilder used for building the native HTML components
 * from the JSON description provided by the server.
 */

/* global */

L.Control.MobileWizardBuilder = L.Control.JSDialogBuilder.extend({
	_customizeOptions: function() {
		this.options.noLabelsForUnoButtons = false;
		this.options.useInLineLabelsForUnoButtons = false;
		this.options.cssClass = 'mobile-wizard';
	},

	_overrideHandlers: function() {
		// eg. this._controlHandlers['combobox'] = this._comboboxControlHandler;
	},
});

L.control.mobileWizardBuilder = function (options) {
	var builder = new L.Control.MobileWizardBuilder(options);
	builder._setup(options);
	builder._overrideHandlers();
	builder._customizeOptions();
	return builder;
};
