/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * JSDialog.StatusBar - statusbar component
 */

/* global $ app JSDialog _ _UNO  getPermissionModeElements */
class StatusBar extends JSDialog.Toolbar {
	constructor(map) {
		super(map, 'toolbar-down');

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('languagesupdated', this.onLanguagesUpdated, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
		app.events.on('contextchange', this.onContextChange.bind(this));
		app.events.on('updatepermission', this.onPermissionChanged.bind(this));
		map.on('updatestatepagenumber', this.onPageChange, this);
		map.on('search', this.onSearch, this);
		map.on('zoomend', this.onZoomEnd, this);
	}

	localizeStateTableCell(text) {
		var stateArray = text.split(';');
		var stateArrayLength = stateArray.length;
		var localizedText = '';
		for (var i = 0; i < stateArrayLength; i++) {
			var labelValuePair = stateArray[i].split(':');
			localizedText += _(labelValuePair[0].trim()) + ':' + labelValuePair[1];
			if (stateArrayLength > 1 && i < stateArrayLength - 1) {
				localizedText += '; ';
			}
		}
		return localizedText;
	}

	toLocalePattern(pattern, regex, text, sub1, sub2) {
		var matches = new RegExp(regex, 'g').exec(text);
		if (matches) {
			text = pattern.toLocaleString().replace(sub1, parseInt(matches[1].replace(/,/g,'')).toLocaleString(String.locale)).replace(sub2, parseInt(matches[2].replace(/,/g,'')).toLocaleString(String.locale));
		}
		return text;
	}

	_updateToolbarsVisibility(context) {
		var isReadOnly = this.map.isReadOnlyMode();
		if (isReadOnly) {
			this.enableItem('languagestatus', false);
			this.showItem('insertmode-container', false);
			this.showItem('statusselectionmode-container', false);
		} else {
			this.enableItem('languagestatus', true);
		}
		this.updateVisibilityForToolbar(context);
	}

	onContextChange(event) {
		this._updateToolbarsVisibility(event.detail.context);
	}

	callback(objectType, eventType, object, data, builder) {
		if (object.id === 'search-input' || object.id === 'search') {
			// its handled by window.setupSearchInput
			return;
		} else if (object.id === 'zoom') {
			var selected = this._generateZoomItems().filter((item) => { return item.id === data; });
			if (selected.length)
				this.map.setZoom(selected[0].scale, null, true /* animate? */);
			return;
		} else if (object.id === 'StateTableCellMenu') {
			// TODO: multi-selection
			var selected = [];
			if (data === '1') { // 'None' was clicked, remove all other options
				selected = ['1'];
			} else { // Something else was clicked, remove the 'None' option from the array
				selected = [data];
			}

			var value = 0;
			for (var it = 0; it < selected.length; it++) {
				value = +value + parseInt(selected[it]);
			}

			var command = {
				'StatusBarFunc': {
					type: 'unsigned short',
					value: value
				}
			};

			this.map.sendUnoCommand('.uno:StatusBarFunc', command);
			return;
		}

		this.builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	}

	onSearch(e) {
		var searchInput = L.DomUtil.get('search-input');
		if (e.count === 0) {
			this.enableItem('searchprev', false);
			this.enableItem('searchnext', false);
			this.showItem('cancelsearch', false);
			L.DomUtil.addClass(searchInput, 'search-not-found');
			$('#findthis').addClass('search-not-found');
			this.map.resetSelection();
			setTimeout(function () {
				$('#findthis').removeClass('search-not-found');
				L.DomUtil.removeClass(searchInput, 'search-not-found');
			}, 800);
		}
	}

	onZoomEnd() {
		var zoomPercent = 100;
		var zoomSelected = null;
		switch (this.map.getZoom()) {
			case 1:  zoomPercent =  20; zoomSelected = 'zoom20'; break;  // 0.2102
			case 2:  zoomPercent =  25; zoomSelected = 'zoom25'; break;  // 0.2500
			case 3:  zoomPercent =  30; zoomSelected = 'zoom30'; break;  // 0.2973
			case 4:  zoomPercent =  35; zoomSelected = 'zoom35'; break;  // 0.3535
			case 5:  zoomPercent =  40; zoomSelected = 'zoom40'; break;  // 0.4204
			case 6:  zoomPercent =  50; zoomSelected = 'zoom50'; break;  // 0.5
			case 7:  zoomPercent =  60; zoomSelected = 'zoom60'; break;  // 0.5946
			case 8:  zoomPercent =  70; zoomSelected = 'zoom70'; break;  // 0.7071
			case 9:  zoomPercent =  85; zoomSelected = 'zoom85'; break;  // 0.8409
			case 10: zoomPercent = 100; zoomSelected = 'zoom100'; break; // 1
			case 11: zoomPercent = 120; zoomSelected = 'zoom120'; break; // 1.1892
			// Why do we call this 150% even if it is actually closer to 140%
			case 12: zoomPercent = 150; zoomSelected = 'zoom150'; break; // 1.4142
			case 13: zoomPercent = 170; zoomSelected = 'zoom170'; break; // 1.6818
			case 14: zoomPercent = 200; zoomSelected = 'zoom200'; break; // 2
			case 15: zoomPercent = 235; zoomSelected = 'zoom235'; break; // 2.3784
			case 16: zoomPercent = 280; zoomSelected = 'zoom280'; break; // 2.8284
			case 17: zoomPercent = 335; zoomSelected = 'zoom335'; break; // 3.3636
			case 18: zoomPercent = 400; zoomSelected = 'zoom400'; break; // 4
			default:
				var zoomRatio = this.map.getZoomScale(this.map.getZoom(), this.map.options.zoom);
				zoomPercent = Math.round(zoomRatio * 100);
			break;
		}

		this.builder.updateWidget(this.parentContainer,
			{
				id: 'zoom',
				type: 'menubutton',
				text: '' + zoomPercent,
				selected: zoomSelected,
				menu: this._generateZoomItems(),
				image: false
			});
	}

	onPageChange(e) {
		var state = e.state;
		state = this.toLocalePattern('Page %1 of %2', 'Page (\\d+) of (\\d+)', state, '%1', '%2');
		this.updateHtmlItem('StatePageNumber', state ? state : ' ');
	}

	_generateHtmlItem(id) {
		var isReadOnlyMode = app.map ? app.map.isReadOnlyMode() : true;
		var canUserWrite = !app.isReadOnly();

		return {
			type: 'container',
			id: id + '-container',
			children: [
				{type: 'htmlcontent', id: id, htmlId: id, text: ' ', isReadOnlyMode: isReadOnlyMode, canUserWrite: canUserWrite},
				{type: 'separator', id: id + 'break', orientation: 'vertical'}
			],
			vertical: false,
			visible: false
		};
	}

	_generateStateTableCellMenuItem(value, visible) {
		var submenu = [
			{id: '2', text: _('Average')},
			{id: '8', text: _('CountA')},
			{id: '4', text: _('Count')},
			{id: '16', text: _('Maximum')},
			{id: '32', text: _('Minimum')},
			{id: '512', text: _('Sum')},
			{id: '8192', text: _('Selection count')},
			{id: '1', text: _('None')}
		];
		var selected = submenu.filter((item) => { return item.id === value; });
		var text = selected.length ? selected[0].text : _('None');
		return {type: 'menubutton', id: 'StateTableCellMenu', text: text, image: false, menu: submenu, visible: visible};
	}

	_generateZoomItems() {
		return [
			{ id: 'zoom20', text: '20', scale: 1},
			{ id: 'zoom25', text: '25', scale: 2},
			{ id: 'zoom30', text: '30', scale: 3},
			{ id: 'zoom35', text: '35', scale: 4},
			{ id: 'zoom40', text: '40', scale: 5},
			{ id: 'zoom50', text: '50', scale: 6},
			{ id: 'zoom60', text: '60', scale: 7},
			{ id: 'zoom70', text: '70', scale: 8},
			{ id: 'zoom85', text: '85', scale: 9},
			{ id: 'zoom100', text: '100', scale: 10},
			{ id: 'zoom120', text: '120', scale: 11},
			{ id: 'zoom150', text: '150', scale: 12},
			{ id: 'zoom170', text: '170', scale: 13},
			{ id: 'zoom200', text: '200', scale: 14},
			{ id: 'zoom235', text: '235', scale: 15},
			{ id: 'zoom280', text: '280', scale: 16},
			{ id: 'zoom335', text: '335', scale: 17},
			{ id: 'zoom400', text: '400', scale: 18},
		];
	}

	getToolItems() {
		return [
			{type: 'edit',  id: 'search', placeholder: _('Search'), text: ''},
			{type: 'customtoolitem',  id: 'searchprev', command: 'searchprev', text: _UNO('.uno:UpSearch'), enabled: false, pressAndHold: true},
			{type: 'customtoolitem',  id: 'searchnext', command: 'searchnext', text: _UNO('.uno:DownSearch'), enabled: false, pressAndHold: true},
			{type: 'customtoolitem',  id: 'cancelsearch', command: 'cancelsearch', text: _('Cancel the search'), visible: false},
			{type: 'separator', id: 'searchbreak', orientation: 'vertical' },
			this._generateHtmlItem('statusdocpos'), 					// spreadsheet
			this._generateHtmlItem('rowcolselcount'), 					// spreadsheet
			this._generateHtmlItem('statepagenumber'), 					// text
			this._generateHtmlItem('statewordcount'), 					// text
			this._generateHtmlItem('insertmode'),						// spreadsheet, text
			this._generateHtmlItem('statusselectionmode'),				// text
			this._generateHtmlItem('slidestatus'),						// presentation
			this._generateHtmlItem('pagestatus'),						// drawing
			{type: 'menubutton', id: 'languagestatus:LanguageStatusMenu'},	// spreadsheet, text, presentation
			{type: 'separator', id: 'languagestatusbreak', orientation: 'vertical', visible: false}, // spreadsheet
			this._generateHtmlItem('statetablecell'),					// spreadsheet
			this._generateStateTableCellMenuItem('2', false),			// spreadsheet
			{type: 'separator', id: 'statetablebreak', orientation: 'vertical', visible: false}, // spreadsheet
			this._generateHtmlItem('permissionmode'),					// spreadsheet, text, presentation
			{type: 'toolitem', id: 'signstatus', command: '.uno:Signature', w2icon: '', text: _UNO('.uno:Signature'), visible: false},
			{type: 'spacer',  id: 'permissionspacer'},
			{type: 'customtoolitem',  id: 'prev', command: 'prev', text: _UNO('.uno:PageUp', 'text'), pressAndHold: true},
			{type: 'customtoolitem',  id: 'next', command: 'next', text: _UNO('.uno:PageDown', 'text'), pressAndHold: true},
			{type: 'separator', id: 'prevnextbreak', orientation: 'vertical'},
		].concat(window.mode.isTablet() ? [] : [
			{type: 'customtoolitem',  id: 'zoomreset', command: 'zoomreset', text: _('Reset zoom'), icon: 'zoomreset.svg'},
			{type: 'customtoolitem',  id: 'zoomout', command: 'zoomout', text: _UNO('.uno:ZoomMinus'), icon: 'minus.svg'},
			{type: 'menubutton', id: 'zoom', text: '100', selected: 'zoom100', menu: this._generateZoomItems(), image: false},
			{type: 'customtoolitem',  id: 'zoomin', command: 'zoomin', text: _UNO('.uno:ZoomPlus'), icon: 'plus.svg'}
		]);
	}

	create() {
		if (this.parentContainer.firstChild)
			return;

		this.parentContainer.replaceChildren();
		this.builder.build(this.parentContainer, this.getToolItems());

		this.onLanguagesUpdated();
		window.setupSearchInput();
		JSDialog.MakeScrollable(this.parentContainer, this.parentContainer.querySelector('div'));
		JSDialog.RefreshScrollables();
	}

	onDocLayerInit() {
		var showStatusbar = this.map.uiManager.getBooleanDocTypePref('ShowStatusbar', true);
		if (showStatusbar)
			this.map.uiManager.showStatusBar();
		else
			this.map.uiManager.hideStatusBar(true);

		var docType = this.map.getDocType();

		switch (docType) {
		case 'spreadsheet':
			this.showItem('prev', false);
			this.showItem('next', false);
			this.showItem('prevnextbreak', false);

			if (!window.mode.isMobile()) {
				this.showItem('statusdocpos-container', true);
				this.showItem('rowcolselcount-container', true);
				this.showItem('insertmode-container', true);
				this.showItem('statusselectionmode-container', true);
				this.showItem('languagestatus', !app.map.isReadOnlyMode());
				this.showItem('languagestatusbreak', !app.map.isReadOnlyMode());
				this.showItem('statetablecell-container', true);
				this.showItem('StateTableCellMenu', !app.map.isReadOnlyMode());
				this.showItem('statetablebreak', !app.map.isReadOnlyMode());
				this.showItem('permissionmode-container', true);
			}
			break;

		case 'text':
			if (!window.mode.isMobile()) {
				this.showItem('statepagenumber-container', true);
				this.showItem('statewordcount-container', true);
				this.showItem('insertmode-container', true);
				this.showItem('statusselectionmode-container', true);
				this.showItem('languagestatus', !app.map.isReadOnlyMode());
				this.showItem('languagestatusbreak', !app.map.isReadOnlyMode());
				this.showItem('permissionmode-container', true);
			}
			break;

		case 'presentation':
			if (!window.mode.isMobile()) {
				this.showItem('slidestatus-container', true);
				this.showItem('languagestatus', !app.map.isReadOnlyMode());
				this.showItem('languagestatusbreak', !app.map.isReadOnlyMode());
				this.showItem('permissionmode-container', true);
			}
			break;
		case 'drawing':
			if (!window.mode.isMobile()) {
				this.showItem('pagestatus-container', true);
				this.showItem('languagestatus', !app.map.isReadOnlyMode());
				this.showItem('languagestatusbreak', !app.map.isReadOnlyMode());
				this.showItem('permissionmode-container', true);
			}
			break;
		}

		var language = app.map['stateChangeHandler'].getItemValue('.uno:LanguageStatus');
		if (language)
			this.updateLanguageItem(this.extractLanguageFromStatus(language));

		this._updateToolbarsVisibility();
		JSDialog.RefreshScrollables();
	}

	show() {
		this.parentContainer.style.display = '';
		JSDialog.RefreshScrollables();
	}

	hide() {
		this.parentContainer.style.display = 'none';
	}

	updateHtmlItem(id, text, disabled) {
		this.builder.updateWidget(this.parentContainer, {
			id: id,
			type: 'htmlcontent',
			htmlId: id.toLowerCase(),
			text: text,
			enabled: !disabled
		});

		JSDialog.RefreshScrollables();
	}

	updateLanguageItem(language) {
		if (app.map.isReadOnlyMode())
			return;

		this.builder.updateWidget(this.parentContainer,
			{type: 'menubutton', id: 'languagestatus:LanguageStatusMenu', noLabel: false, text: language});
		JSDialog.RefreshScrollables();
	}

	showSigningItem(icon, text) {
		this.builder.updateWidget(this.parentContainer,
			{type: 'toolitem', id: 'signstatus', command: '.uno:Signature', w2icon: icon, text: text ? text : _UNO('.uno:Signature')});
		JSDialog.RefreshScrollables();
	}

	onPermissionChanged(event) {
		var isReadOnlyMode = event.detail.perm === 'readonly';
		if (isReadOnlyMode) {
			$('#toolbar-down').addClass('readonly');
		} else {
			$('#toolbar-down').removeClass('readonly');
		}

		var canUserWrite = window.ThisIsAMobileApp ? !app.isReadOnly() : this.map['wopi'].UserCanWrite;
		var EditDocMode = true;
		if (app.map['stateChangeHandler'].getItemValue('EditDoc') !== undefined) {
			EditDocMode = app.map['stateChangeHandler'].getItemValue('EditDoc') === "true";
			if (!EditDocMode)
				app.map.uiManager.showSnackbar(_('To prevent accidental changes, the author has set this file to open as view-only'));
		}

		canUserWrite = canUserWrite && EditDocMode;

		var permissionContainer = document.getElementById('permissionmode-container');
		if (permissionContainer) {
			while (permissionContainer.firstChild)
				permissionContainer.removeChild(permissionContainer.firstChild);
			permissionContainer.appendChild(getPermissionModeElements(isReadOnlyMode, canUserWrite));
		}

		this.builder.updateWidget(this.parentContainer, {
			id: 'PermissionMode',
			type: 'htmlcontent',
			htmlId: 'permissionmode',
			isReadOnlyMode: isReadOnlyMode,
			canUserWrite: canUserWrite
		});

		JSDialog.RefreshScrollables();
	}

	extractLanguageFromStatus(state) {
		var code = state;
		var language = _(state);
		var split = code.split(';');
		if (split.length > 1)
			language = _(split[0]);
		return language;
	}

	onCommandStateChanged(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (!commandName)
			return;

		if (commandName === '.uno:StatusDocPos') {
			state = this.toLocalePattern('Sheet %1 of %2', 'Sheet (\\d+) of (\\d+)', state, '%1', '%2');
			this.updateHtmlItem('StatusDocPos', state ? state : ' ');
		}
		else if (commandName === '.uno:LanguageStatus') {
			var language = this.extractLanguageFromStatus(state);
			this.updateLanguageItem(language);
		}
		else if (commandName === '.uno:RowColSelCount') {
			state = this.toLocalePattern('$1 rows, $2 columns selected', '(\\d+) rows, (\\d+) columns selected', state, '$1', '$2');
			state = this.toLocalePattern('$1 of $2 records found', '(\\d+) of (\\d+) records found', state, '$1', '$2');
			this.updateHtmlItem('RowColSelCount', state ? state : _('Select multiple cells'), !state);
		}
		else if (commandName === '.uno:InsertMode') {
			this.updateHtmlItem('InsertMode', state ? L.Styles.insertMode[state].toLocaleString() : _('Insert mode: inactive'), !state);

			$('#InsertMode').removeClass();
			$('#InsertMode').addClass('jsdialog ui-badge insert-mode-' + state);

			if ((state === 'false' || !state) && app.definitions.urlPopUpSection.isOpen()) {
				this.map.hyperlinkUnderCursor = null;
				app.definitions.urlPopUpSection.closeURLPopUp();
			}
		}
		else if (commandName === '.uno:StatusSelectionMode' || commandName === '.uno:SelectionMode') {
			this.updateHtmlItem('StatusSelectionMode', state ? L.Styles.selectionMode[state].toLocaleString() : _('Selection mode: inactive'), !state);
		}
		else if (commandName == '.uno:StateTableCell') {
			this.updateHtmlItem('StateTableCell', state ? this.localizeStateTableCell(state) : ' ');
		}
		else if (commandName === '.uno:StatusBarFunc') {
			if (app.map.isReadOnlyMode())
				return;

			// Check 'None' even when state is 0
			if (state === '0')
				state = '1';

			this.builder.updateWidget(this.parentContainer, this._generateStateTableCellMenuItem(state, true));
			JSDialog.RefreshScrollables();
		}
		else if (commandName === '.uno:StatePageNumber') {
			this.onPageChange(e);
			return;
		}
		else if (commandName === '.uno:StateWordCount') {
			state = this.toLocalePattern('%1 words, %2 characters', '([\\d,]+) words, ([\\d,]+) characters', state, '%1', '%2');
			this.updateHtmlItem('StateWordCount', state ? state : ' ');
		}
		else if (commandName === '.uno:PageStatus') {
			if (this.map.getDocType() === 'presentation') {
				state = this.toLocalePattern('Slide %1 of %2', 'Slide (\\d+) of (\\d+)', state, '%1', '%2');
				this.updateHtmlItem('SlideStatus', state ? state : ' ');
			} else {
				state = this.toLocalePattern('Page %1 of %2', 'Slide (\\d+) of (\\d+)', state, '%1', '%2');
				this.updateHtmlItem('PageStatus', state ? state : ' ');
			}
		}
		else if (commandName === '.uno:EditDoc') {
			state = state === "true";
			this.onPermissionChanged({detail : {
				perm: state && this.map.isEditMode() ? "edit" : "readonly"
			} });
		}
		else if (commandName === '.uno:Signature') {
			// Use the same handler as the 'signaturestatus:' protocol message, which is
			// sent right after document load.
			this.map.onChangeSignStatus(state);
		}
	}

	onLanguagesUpdated() {
		var menuEntries = [];
		var translated, neutral;
		var constLang = '.uno:LanguageStatus?Language:string=';
		var constDefault = 'Default_RESET_LANGUAGES';
		var constNone = 'Default_LANGUAGE_NONE';
		var resetLang = _('Reset to Default Language');
		var noneLang = _('None (Do not check spelling)');
		var languages = app.languages;

		menuEntries.push({id: 'nonelanguage', uno: constLang + constNone, text: noneLang});

		for (var lang in languages) {
			if (languages.length > 10 && app.favouriteLanguages.indexOf(languages[lang].iso) < 0)
				continue;

			translated = languages[lang].translated;
			neutral = languages[lang].neutral;
			var splitNeutral = neutral.split(';');
			menuEntries.push({id: neutral, text: translated, uno: constLang + encodeURIComponent('Default_' + splitNeutral[0])});
		}

		menuEntries.push({id: 'reset', text: resetLang, uno: constLang + constDefault});
		menuEntries.push({id: 'morelanguages', action: 'morelanguages-all', text: _('Set Language for All text')});

		if (this.map.getDocType() === 'text') {
			menuEntries.push({id: 'langpara', action: 'morelanguages-paragraph', text: _('Set Language for Paragraph')});
			menuEntries.push({id: 'langselection', action: 'morelanguages-selection', text:  _('Set Language for Selection')});
		}

		JSDialog.MenuDefinitions.set('LanguageStatusMenu', menuEntries);
	}
}

JSDialog.StatusBar = function (map) {
	return new StatusBar(map);
};
