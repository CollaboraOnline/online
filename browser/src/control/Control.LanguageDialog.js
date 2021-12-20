/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.LanguageDialog used for spellchecking language selection on mobile devices
 */

/* global _ $ vex */
L.Control.LanguageDialog = L.Control.extend({

	_languages: [],

	onAdd: function (map) {
		map.on('commandvalues', this._onCommandValues, this);
		map.on('languagedialog', this._onLanguageDialog, this);
	},

	_onCommandValues: function(e) {
		if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
			var languages = [];

			e.commandValues.forEach(function(language) {
				var split = language.split(';');
				language = split[0];
				var isoCode = '';
				if (split.length > 1)
					isoCode = split[1];
				languages.push({translated: _(language), neutral: language, iso: isoCode});
			});

			languages.sort(function(a, b) {
				return a.translated < b.translated ? -1 : a.translated > b.translated ? 1 : 0;
			});

			this._languages = languages;
		}
	},

	_onItemSelected: function(e) {
		var unoCommand = '.uno:LanguageStatus?Language:string=Default_' + e.data.language;
		e.data.self._map.sendUnoCommand(unoCommand);
		vex.closeAll();
	},

	_getSelectedLanguageCode: function() {
		var constState = 'stateChangeHandler';
		var languageAndCode = this._map[constState].getItemValue('.uno:LanguageStatus');
		var split = languageAndCode.split(';');
		var code = '-';
		if (split.length > 1)
			code = split[1];
		else
			window.app.console.error('Language code not found');
		return code;
	},

	_addItem: function(parent, language) {
		var selectedLanguageCode = this._getSelectedLanguageCode();
		var neutralLanguage = 'LANGUAGE_NONE';
		var code = '';

		var tr = L.DomUtil.create('tr', '', parent);
		var td = L.DomUtil.create('td', '', tr);
		var a = L.DomUtil.create('a', '', td);

		if (language) {
			neutralLanguage = language.neutral;
			code = language.iso;
			a.innerHTML = language.iso;
		} else {
			a.innerHTML = _('None (Do not check spelling)');
		}

		if ((selectedLanguageCode != '-' && code.indexOf(selectedLanguageCode) !== -1)
			|| (selectedLanguageCode == '-' && !language)) {
			$(a).addClass('highlighted');
		} else {
			$(a).removeClass('highlighted');
		}

		$(tr).on('click', {self: this, language: encodeURIComponent(neutralLanguage)}, this._onItemSelected);
	},

	_onLanguageDialog: function() {
		var dialog = vex.dialog.open({
			message: '',
			buttons: [
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
		});

		var div = L.DomUtil.create('div', '');
		var ul = L.DomUtil.create('table', 'lo-menu', div);

		// Add NONE
		this._addItem(ul, null);

		for (var lang in this._languages) {
			this._addItem(ul, this._languages[lang]);
		}

		dialog.get(0).insertBefore(div, dialog.get(0).childNodes[0]);
	}
});

L.control.languageDialog = function (options) {
	return new L.Control.LanguageDialog(options);
};
