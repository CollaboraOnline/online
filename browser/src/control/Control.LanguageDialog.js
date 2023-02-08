/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.LanguageDialog used for spellchecking language
 */

/* global _ app */
L.Control.LanguageDialog = L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		map.on('morelanguages', this._onLanguageDialog, this);
	},

	onRemove: function (map) {
		map.off('morelanguages', this._onLanguageDialog, this);
	},

	_onItemSelected: function(language) {
		var unoCommand = '.uno:LanguageStatus?Language:string=' + this.applyTo + '_' + language;
		this.map.sendUnoCommand(unoCommand);
	},

	_getSelectedLanguage: function() {
		var languageAndCode = this._map['stateChangeHandler'].getItemValue('.uno:LanguageStatus');
		var split = languageAndCode.split(';');
		var language = '';
		if (split.length > 1)
			language = split[0];
		else
			window.app.console.error('Language not found');
		return language;
	},

	_onLanguageDialog: function(e) {
		var languageEntries = [];
		this.selectedLanguage = this._getSelectedLanguage();

		switch (e.applyto) {
		case 'all':
			this.applyTo = 'Default';
			break;
		case 'paragraph':
			this.applyTo = 'Paragraph';
			break;
		case 'selection':
			this.applyTo = 'Current';
			break;
		default:
			this.applyTo = 'Default';
			break;
		}

		languageEntries.push({
			columns: [ { text: _('None (Do not check spelling)') } ],
			row: 'LANGUAGE_NONE',
			selected: 'LANGUAGE_NONE' === this.selectedLanguage
		});

		var that = this;
		app.languages.forEach(function (language) {
			languageEntries.push({
				columns: [ { text: language.neutral } ],
				row: language.neutral,
				selected: language.neutral === that.selectedLanguage
			});
		});

		var data = {
			id: 'LanguageDialog',
			dialogid: 'LanguageDialog',
			type: 'dialog',
			title: _('Select language'),
			jsontype: 'dialog',
			responses: [
				{
					id: 'ok',
					response: 1
				},
				{
					id: 'cancel',
					response: 0
				},
			],
			children: [
				{
					id: 'LanguageDialog-mainbox',
					type: 'container',
					vertical: true,
					children: [
						{
							type: 'treelistbox',
							id: 'languages',
							headers: [ { text: _('Language') } ],
							entries: languageEntries
						},
						{
							id: 'LanguageDialog-buttonbox',
							type: 'buttonbox',
							children: [
								{
									id: 'cancel',
									type: 'pushbutton',
									text: _('Cancel'),
								},
								{
									id: 'ok',
									'has_default': true,
									type: 'pushbutton',
									text: _('OK'),
								}
							],
							vertical: false,
							layoutstyle: 'end'
						}
					]
				}
			]
		};

		var dialogBuildEvent = {
			data: data,
			callback: this._onAction.bind(this),
		};

		this.map.fire(window.mode.isMobile() ? 'mobilewizard' : 'jsdialog', dialogBuildEvent);
	},

	_onAction: function (element, action, data, index) {
		if (element === 'responsebutton' && data.id === 'ok')
			this._onItemSelected(this.selectedLanguage);
		else if (element === 'treeview') {
			if (action == 'select')
				this.selectedLanguage = index;
			return;
		}

		var closeEvent = {
			data: {
				action: 'close',
				id: 'LanguageDialog',
			}
		};
		this.map.fire(window.mode.isMobile() ? 'closemobilewizard' : 'jsdialog', closeEvent);
	}
});

L.control.languageDialog = function (options) {
	return new L.Control.LanguageDialog(options);
};
