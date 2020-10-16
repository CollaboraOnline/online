/* -*- mode: js; js-indent-level: 8 -*- */
/*
 * L.Control.DialogWizard
 */

L.Control.DialogWizard = L.Control.MobileWizard.extend({
	options: {
		position: 'topright'
	},

	initialize: function (dialogid) {
		var options = {
			idPrefix: '#dialog-wizard',
			classPrefix: '.dialog-wizard',
			nameElement: 'dialog-wizard'
		};

		L.Control.MobileWizard.prototype.initialize.call(this, options);
		this._layout();
		this._container.dialogid = dialogid;
	},

	onAdd: function () {
		return this._container;
	},

	_layout: function () {
		this._initLayout();
		this._setupBackButton();
	},

	_initLayout: function () {
		this._container = L.DomUtil.createWithId('div', this.options.nameElement);
		this._container.className = 'leaflet-control-layers';

		L.DomUtil.createWithId('div', this.options.nameElement + '-tabs', this._container);

		var titlebar = L.DomUtil.createWithId('table', this.options.nameElement + '-titlebar', this._container);
		var tr = L.DomUtil.create('tr', '', titlebar);
		L.DomUtil.createWithId('td', this.options.nameElement + '-back', tr);
		L.DomUtil.createWithId('div', this.options.nameElement + '-title', tr);

		L.DomUtil.createWithId('div', this.options.nameElement + '-content', this._container);
	},

	_fillContent: function (data, map) {
		var builder;
		if (data) {
			this._reset();
			builder = L.control.dialogBuilder({mobileWizard: this, map: map, cssClass: this.options.nameElement});
			builder.build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);
		}
	}

});

L.control.dialogWizard = function (dialogid) {
	return new L.Control.DialogWizard(dialogid);
};
