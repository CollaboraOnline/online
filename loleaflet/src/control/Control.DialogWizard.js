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
		L.DomEvent.on(this._container, 'click dblclick mousedown mousemove mouseup', L.DomEvent.stopPropagation);
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

L.ControllerDialogWizard = L.Class.extend({
	statics: {
		Dialogs: {},
		MACRO_SELECTOR: 1,
		MACRO_SECURITY: 2
	},

	initialize: function (map) {
		this._map = map;

		map.on('macroselector', this._runMacroSelector, this);
		map.on('macrosecurity', this._runMacroSecurity, this);
		map.on('commandresult', this._onCommandResult, this);
		map.on('dialogaction', this._executeAction, this);
	},

	_createDialog: function(dialogid, json) {
		var data = data = JSON.parse(json);
		var dlg = L.ControllerDialogWizard.Dialogs[dialogid];
		if (!dlg) {
			dlg = L.ControllerDialogWizard.Dialogs[dialogid] =
				L.control.dialogWizard(dialogid);
		}
		dlg._fillContent(data, this._map);
		dlg.addTo(this._map);
	},

	_onCommandResult: function (e) {
		if (!e.success || !e.result)
			return;

		if (e.commandName.startsWith('.uno:RunMacro')) {
			this._createDialog(L.ControllerDialogWizard.MACRO_SELECTOR, e.result.value);
		} else if (e.commandName.startsWith('.uno:OptionsTreeDialog')) {
			this._createDialog(L.ControllerDialogWizard.MACRO_SECURITY, e.result.value);
		}
	},

	_executeAction: function (action) {
		var selected;
		var dlg = L.ControllerDialogWizard.Dialogs[action.dialogid];

		switch (action.dialogid) {
		case L.ControllerDialogWizard.MACRO_SELECTOR:
			switch (action.controlid) {
			case 'categories':
				var target = action.data;
				var button = dlg._container.querySelector('#ok');
				var description = dlg._container.querySelector('#description');

				selected = dlg._container.querySelector(dlg.options.classPrefix + '-selected');
				if (selected)
					L.DomUtil.removeClass(selected, dlg.options.nameElement + '-selected');

				if (!target || !button || !description)
					break;

				if (target.hasAttribute('data-uri')) {
					target.classList.toggle(dlg.options.nameElement + '-selected');
					button.removeAttribute('disabled');
				} else {
					button.setAttribute('disabled', 'disabled');
				}

				description.innerHTML = target.getAttribute('data-description');
				break;
			case 'ok':
				var scriptURL;
				selected = dlg._container.querySelector(dlg.options.classPrefix + '-selected');
				if (selected && selected.hasAttribute('data-uri')) {
					scriptURL = selected.getAttribute('data-uri');
					this._map.sendUnoCommand('.uno:RunMacro?ScriptURL:string=' + scriptURL);
				}
				break;

			case 'cancel':
				dlg.remove();
				break;
			}
			break;

		case L.ControllerDialogWizard.MACRO_SECURITY:
			switch (action.controlid) {
			case 'cancel':
				dlg.remove();
				break;
			}
			break;
		}
	},

	_isDlgOpen: function(dlg) {
		var result = false;
		if (dlg) {
			var corner = this._map._controlCorners[dlg.getPosition()];
			result = corner.querySelector(dlg.options.idPrefix);
		}

		return result;
	},

	_runMacroSecurity: function () {
		var dlg = L.ControllerDialogWizard.Dialogs[L.ControllerDialogWizard.MACRO_SECURITY];
		if (!dlg) {
			this._map.sendUnoCommand('.uno:OptionsTreeDialog?Option:string=MacroSecurity');
		} else if (!this._isDlgOpen(dlg)) {
			dlg.addTo(this._map);
		}
	},

	_runMacroSelector: function () {
		var dlg = L.ControllerDialogWizard.Dialogs[L.ControllerDialogWizard.MACRO_SELECTOR];
		if (!dlg) {
			this._map.sendUnoCommand('.uno:RunMacro');
		} else if (!this._isDlgOpen(dlg)) {
			dlg.addTo(this._map);
		}
	}
});

L.Map.addInitHook('addController', 'dialogWizard', L.ControllerDialogWizard);
