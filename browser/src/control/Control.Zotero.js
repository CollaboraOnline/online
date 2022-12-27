/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Control.Zotero
 */

/* global _ Promise app Set */
L.Control.Zotero = L.Control.extend({
	_cachedURL: [],

	getCachedOrFetch: function (url) {
		var that = this;
		var cachedData = this._cachedURL[url];
		if (cachedData) {
			return new Promise(function(resolve) {
				resolve(cachedData);
			});
		} else {
			return fetch(url).then(function (response) {
				that._cachedURL[url] = response.json();
				return that._cachedURL[url];
			});
		}
	},

	settings: {
		hasBibliography: '0',
		bibliographyStyleHasBeenSet: '0',
		style: '',
		locale: 'en-US'
	},

	onAdd: function (map) {
		this.map = map;
		this.enable = false;
		this.map.on('updateviewslist', this.onUpdateViews, this);
	},

	onFieldValue: function(fields) {
		this.citations = new Set();

		for (var index = 0; index < fields.length; index++) {
			var field = fields[index];
			var braceIndex = field.command.indexOf('{');

			if (braceIndex < 0) {
				continue;
			}

			var values = JSON.parse(field.command.substring(braceIndex));
			if (!values) {
				return;
			}
			var that = this;
			values.citationItems.forEach(function(item) {
				that.citations.add(item);
			});
		}
	},

	getCitationKeys: function() {
		var keys = [];

		this.citations.forEach(function(item) {

			var slashIndex = item.id .indexOf('/');
			var key = slashIndex < 0 ? item.id : item.id .substring(slashIndex + 1);
			keys.push(key);
		});

		return keys;
	},

	onRemove: function () {
		this.map.off('updateviewslist', this.onUpdateViews, this);
	},

	onUpdateViews: function () {
		var userExtraInfo = this.map._docLayer ? this.map._viewInfo[this.map._docLayer._viewId].userextrainfo : null;
		if (userExtraInfo) {
			this.apiKey = userExtraInfo.ZoteroAPIKey;
			if (this.apiKey)
				this.updateUserID();
		}
	},

	updateUserID: function () {
		var that = this;
		fetch('https://api.zotero.org/keys/' + this.apiKey)
			.then(function (response) { return response.json(); })
			.then(function (data) {
				that.userID = data.userID;
				that.enable = !!that.userID;
				if (that.map.uiManager.notebookbar)
					that.map.uiManager.refreshNotebookbar();
				else
					that.map.uiManager.refreshMenubar();
			});
	},

	dialogSetup: function (title, showCategories, ShowLocale) {
		var that = this;
		var data = {
			id: 'ZoteroDialog',
			dialogid: 'ZoteroDialog',
			type: 'dialog',
			text: title,
			title: title,
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
					id: 'ZoteroDialog-mainbox',
					type: 'container',
					vertical: true,
					children: [
						{
							id: 'ZoteroDialog-search-container',
							type: 'container',
							layoutstyle: 'end',
							children: [
								{
									type: 'pushbutton',
									id: 'zoterorefresh',
									text: _('Refresh')
								},
								{
									type: 'fixedtext',
									id: 'zoterosearch-label',
									text: _('Search:')
								},
								{
									type: 'edit',
									id: 'zoterosearch',
									text: ''
								}
							]
						},
						{
							id: 'ZoteroDialog-content',
							type: 'container',
							children: [
								(showCategories) ? {
									type: 'treelistbox',
									id: 'zoterocategory',
									enabled: false,
									entries: this.getDefaultCategories()
								} : {},
								{
									type: 'treelistbox',
									id: 'zoterolist',
									enabled: false,
								}
							]
						},
						(ShowLocale) ? {
							id: 'ZoteroDialog-locale-container',
							type: 'container',
							children: [
								{
									type: 'fixedtext',
									id: 'zoterolocale-label',
									text: _('Language:')
								},
								{
									'id': 'zoterolocale',
									'type': 'combobox',
									'entries': Array.from(Object.keys(this.languageNames), function(langCode) {return that.languageNames[langCode][0];}),
									'selectedCount': '1',
									'selectedEntries': [
										Object.keys(this.languageNames).indexOf(this.settings.locale)
									],
								},
							]
						} : {},
						{
							id: 'ZoteroDialog-buttonbox',
							type: 'buttonbox',
							children: [
								{
									id: 'cancel',
									type: 'pushbutton',
									text: _('Cancel'),
								},
								{
									id: 'ok',
									type: 'pushbutton',
									text: _('OK'),
									'has_default': true,
								}
							],
							vertical: false,
							layoutstyle: 'end'
						}
					]
				},
			],
		};

		this.items = []; // zoterolist content
		this.categories = this.getDefaultCategories(); // zoterocategory content

		this.groups = [];
		this.collections = [];

		var dialogBuildEvent = {
			data: data,
			callback: this._onAction.bind(this),
		};


		this.map.fire(window.mode.isMobile() ? 'mobilewizard' : 'jsdialog', dialogBuildEvent);

		return this;
	},

	updateList: function(headerArray, failText) {
		if (this.items.length !== 0) {
			return {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: 'ZoteroDialog',
					control: {
						id: 'zoterolist',
						type: 'treelistbox',
						headers: headerArray.map(
							function(item) { return { text: item }; }
						),
						entries: this.items,
					},
				},
				callback: this._onAction.bind(this)
			};
		} else {
			return {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: 'ZoteroDialog',
					control: {
						id: 'zoterolist',
						type: 'treelistbox',
						entries: [ { text: failText } ]
					},
				},
			};
		}
	},

	getZoteroItemQuery: function() {
		return '?v=3&key=' + this.apiKey + '&include=data,citation,bib,csljson&style=' + this.settings.style + '&locale=' + this.settings.locale;
	},

	_getDefaultSubCollections: function () {
		return [
			{ columns: [ { text: _('My Publications') } ], row: 'https://api.zotero.org/users/' + this.userID + '/publications/items/top' + this.getZoteroItemQuery() },
		];
	},

	getDefaultCategories: function () {
		return [
			{ columns: [{ text: _('My Library') } ], row: 'https://api.zotero.org/users/' + this.userID + '/items/top' + this.getZoteroItemQuery(), children: this._getDefaultSubCollections() },
			{ columns: [{ text: _('Group Libraries')}] }];
	},

	updateCategories: function() {
		return {
			data: {
				jsontype: 'dialog',
				action: 'update',
				id: 'ZoteroDialog',
				control: {
					id: 'zoterocategory',
					type: 'treelistbox',
					entries: this.categories,
				},
			},
			callback: this._onAction.bind(this)
		};
	},

	getCitationJSONString: function(item) {
		var resultJSON = {};
		resultJSON['citationID'] = Math.random().toString(36).substring(2,12);

		resultJSON['schema'] = 'https://raw.githubusercontent.com/citation-style-language/schema/master/schemas/input/csl-citation.json';

		var properties = {
			formattedCitation: item['citation'],
			plainCitation: new DOMParser().parseFromString(item['citation'], 'text/html').documentElement.textContent,
			noteIndex: '0'
		};

		resultJSON['properties'] = properties;

		var citationItems = {
			id: item['csljson'].id,
			uris: [item['links']['self']['href'], item['links']['alternate']['href']],
		};

		citationItems['itemData'] = item['csljson'];

		resultJSON['citationItems'] = [citationItems];

		return JSON.stringify(resultJSON);
	},

	fillCategories: function () {
		this.categories = this.getDefaultCategories().slice();
		this.categories[0].children = this.categories[0].children.concat(this.collections.slice());
		this.categories[1].children = this.groups.slice();
	},

	// columns: Array of details which will be displayed in the dialog
	// entryData: Object containing extra details related to the entry
	createEntry: function (index, columns, entryData, hasIcon) {
		if (hasIcon) {
			var type = entryData.itemType;
			type = type.toUpperCase()[0] + type.substr(1);
			var icon = 'zotero' + type;
			var firstColumn = [ { collapsed: icon, expanded: icon } ];
		} else {
			firstColumn = [];
		}
		this.items.push(Object.assign({ 'columns': firstColumn.concat(columns.map(
			function (item) {
				return { text: item };
			}
		)), row: index,
		}, entryData));
	},

	fillItems: function (items) {
		var index = 0;
		for (var iterator = 0; iterator < items.length; ++iterator) {
			if (items[iterator].data.itemType === 'note')
				continue;

			var creatorArray = [];
			for (var creator = 0; items[iterator].data.creators && creator < items[iterator].data.creators.length; ++creator) {
				creatorArray.push(items[iterator].data.creators[creator].firstName + ' ' + items[iterator].data.creators[creator].lastName);
			}
			var creatorString = creatorArray.join(', ');
			this.createEntry(index++,
				[items[iterator].data.title, creatorString, items[iterator].data.date],
				{type: 'item', itemType: items[iterator].data.itemType, item: items[iterator]},
				true
			);
		}
	},

	fillStyles: function (styles) {
		for (var iterator = 0; iterator < styles.length; ++iterator) {
			this.createEntry(iterator, [styles[iterator].title], {name: styles[iterator].name, type: 'style'});
		}
	},

	fillNotes: function (items) {
		var index = 0;
		for (var iterator = 0; iterator < items.length; ++iterator) {
			if (items[iterator].data.itemType !== 'note')
				continue;

			var dummyNode = L.DomUtil.create('div');
			dummyNode.innerHTML = items[iterator].data.note;
			var note = dummyNode.innerText.replaceAll('\n', ' ');
			if (note.length > 100)
				note = note.substr(0, 100);

			this.createEntry(index++,
				[note],
				{type: 'note', itemType: items[iterator].data.itemType, item: items[iterator]},
				true
			);
		}
	},

	showItemList: function () {
		if (!this.settings.style) {
			this.pendingAction = this.showItemList;
			this.showStyleList();
			return;
		}
		var that = this;
		this.dialogType = 'itemlist';

		that.dialogSetup(_('My Library'), true);
		var dialogUpdateEvent = that.updateList([_('Title'), _('Creator(s)'), _('Date')], _('Loading'));
		that.map.fire('jsdialogupdate', dialogUpdateEvent);
		that.map.fire('jsdialogupdate', that.updateCategories());

		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/groups?v=3&key=' + this.apiKey)
			.then(function (data) {
				for (var i = 0; i < data.length; i++) {
					that.groups.push(
						{
							columns: [ { text: data[i].data.name } ],
							id: data[i].data.id,
							row: data[i].links.self.href + '/items/top' + that.getZoteroItemQuery()
						});
					that.fillCategories();
					that.map.fire('jsdialogupdate', that.updateCategories());
				}
			});

		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/collections' + this.getZoteroItemQuery())
			.then(function (data) {
				for (var i = 0; i < data.length; i++) {
					that.collections.push(
						{
							columns: [ { text: data[i].data.name } ],
							id: data[i].data.key,
							row: data[i].links.self.href + '/items/top' + that.getZoteroItemQuery(),
							children: [ { text: '<dummy>' } ],
							ondemand: true
						});
					that.fillCategories();
					that.map.fire('jsdialogupdate', that.updateCategories());
				}
			});

		this.showItemsForUrl('https://api.zotero.org/users/' + this.userID + '/items/top' + this.getZoteroItemQuery());
	},

	showStyleList: function() {
		var that = this;
		this.dialogType = 'stylelist';
		this.getCachedOrFetch('https://www.zotero.org/styles-files/styles.json')
			.then(function (data) {
				that.dialogSetup(_('Citation Style'), false, true);
				that.fillStyles(data);

				var dialogUpdateEvent = that.updateList([_('Styles')],_('An error occurred while fetching style list'));

				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
			});
	},

	fetchStyle: function() {
		app.socket.sendMessage('commandvalues command=.uno:SetDocumentProperties?namePrefix=ZOTERO_PREF_');
	},

	setFetchedStyle: function(userDefinedProperties) {
		var valueString = '';
		for (var i = 0; i < userDefinedProperties.length; i++) {
			valueString += userDefinedProperties[i].value;
		}

		var value = new DOMParser().parseFromString(valueString, 'text/html');
		var styleNode = value.getElementsByTagName('style')[0];

		this.settings.style = styleNode.id.substring(styleNode.id.lastIndexOf('/')+1);
		var locale = styleNode.getAttribute('locale');
		if (locale)
			this.settings.locale = locale;
		return;
	},

	setStyle: function(style) {
		this.settings.style = style.name;
		this.settings.hasBibliography = '1';

		var dataNode = document.createElement('data');

		var sessionNode = document.createElement('session');
		sessionNode.setAttribute('id', Math.random().toString(36).substring(2,10));

		dataNode.appendChild(sessionNode);

		var styleNode = document.createElement('style');
		styleNode.setAttribute('id', 'http://www.zotero.org/styles/' + style.name);
		styleNode.setAttribute('locale', this.settings.locale);
		styleNode.setAttribute('hasBibliography', this.settings.hasBibliography);
		styleNode.setAttribute('bibliographyStyleHasBeenSet', this.settings.bibliographyStyleHasBeenSet);

		dataNode.appendChild(styleNode);

		var prefsNode = document.createElement('prefs');

		var prefNode = document.createElement('pref');
		prefNode.setAttribute('name', 'fieldType');
		prefNode.setAttribute('value', 'Field');

		prefsNode.appendChild(prefNode);

		dataNode.appendChild(prefsNode);

		var valueString = dataNode.outerHTML;

		var style =
		{
			'UpdatedProperties': {
				'type': '[]com.sun.star.beans.PropertyValue',
				'value': {
					'NamePrefix': {
						'type': 'string',
						'value': 'ZOTERO_PREF_'
					},
					'UserDefinedProperties': {
						'type': '[]com.sun.star.beans.PropertyValue',
						'value': {
						}
					}
				}
			}
		};

		// style preference needs to be stored into chunks of max 255 chars
		for (var start = 0, end = 1; (end * 255) < (valueString.length + 255); start++, end++) {
			style['UpdatedProperties']['value']['UserDefinedProperties']['value']['ZOTERO_PREF_'+end] =
			{
				'type': 'string',
				'value': valueString.slice(start*255, end*255)
			};

		}
		this.map.sendUnoCommand('.uno:SetDocumentProperties', style);
	},

	_findEntryWithUrlImpl: function(entry, url) {
		if (entry.row === url)
			return entry;

		for (var i in entry.children) {
			var found = this._findEntryWithUrlImpl(entry.children[i], url);
			if (found)
				return found;
		}

		return null;
	},

	_findEntryWithUrl: function(data, url) {
		for (var i in data.entries) {
			var found = this._findEntryWithUrlImpl(data.entries[i], url);
			if (found)
				return found;
		}

		return null;
	},

	_fetchCollectionAndPushTo: function(collectionId, targetCollection) {
		var that = this;
		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/collections/' + collectionId + '/collections/?v=3&key=' + this.apiKey)
			.then(function (data) {
				for (var i = 0; i < data.length; i++) {
					targetCollection.children.push(
						{
							columns: [ { text: data[i].data.name } ],
							id: data[i].data.key,
							row: data[i].links.self.href + '/items/top' + that.getZoteroItemQuery(),
							children: [ { text: '<dummy>' } ],
							ondemand: true
						});
				}

				if (!data.length)
					targetCollection.children = undefined;
				that.fillCategories();
				that.map.fire('jsdialogupdate', that.updateCategories());
			});
	},

	_expandCollection: function(treeViewData, row) {
		var entry = this._findEntryWithUrl(treeViewData, row);
		var searchArray = { entries: this.collections };
		var targetEntry = this._findEntryWithUrl(searchArray, row);

		if (entry && targetEntry) {
			if (targetEntry.children.length === 1
				&& targetEntry.children[0].text === '<dummy>') {
				targetEntry.children = [];
				targetEntry.ondemand = undefined;
				this.fillCategories();
				this.map.fire('jsdialogupdate', this.updateCategories());

				this._fetchCollectionAndPushTo(entry.id, targetEntry);
			}
		}
	},

	showItemsForUrl: function(url) {
		var that = this;
		that.items = [];
		this.getCachedOrFetch(url)
			.then(function (data) {
				that.fillItems(data);
				var dialogUpdateEvent = that.updateList([_('Title'), _('Creator(s)'), _('Date')], _('Your library is empty'));
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
			});
	},

	_onAction: function(element, action, data, index) {
		if (element === 'dialog' && action === 'close') return;
		if (element === 'treeview') {
			if (action == 'keydown')
				return;
			if (data.id === 'zoterocategory') {
				var url = index;
				if (!url)
					return;

				if (action === 'expand')
					this._expandCollection(data, index);

				this.showItemsForUrl(url);
				return;
			} else {
				this.selected = data.entries[parseInt(index)];
				return;
			}
		}
		if (element === 'edit' && data.id === 'zoterosearch') {
			document.getElementById('zoterolist').filterEntries(data.value);
			return;
		}
		if (element === 'responsebutton' && data.id == 'ok') {
			if (this.selected)
				this._onOk(this.selected);
			if (this.selectedCitationLangCode)
				this.settings.locale = this.selectedCitationLangCode;
		}
		if (element === 'pushbutton' && data.id === 'zoterorefresh') {
			this._cachedURL = [];
			if (this.dialogType === 'itemlist')
				this.showItemList();
			else
				this.showStyleList();
			return;
		}
		if (element === 'combobox') {
			this.selectedCitationLangCode = Object.keys(this.languageNames)[parseInt(index)];
			return;
		}

		var closeEvent = {
			data: {
				action: 'close',
				id: 'ZoteroDialog',
			}
		};
		this.map.fire(window.mode.isMobile() ? 'closemobilewizard' : 'jsdialog', closeEvent);

		// clear all previous selections
		delete this.selectedCitationLangCode;
		delete this.selected;
		if (this.pendingAction) {
			this.pendingAction();
			delete this.pendingAction;
		}
	},

	_onOk: function (selected) {
		if (selected.type === 'item') {
			var parameters = {
				FieldType: {type: 'string', value: 'vnd.oasis.opendocument.field.UNHANDLED'},
				FieldCommand: {type: 'string', value: 'ADDIN ZOTERO_ITEM CSL_CITATION ' + this.getCitationJSONString(selected.item)},
				FieldResult: {type: 'string', value: selected.item.citation}
			};
			this.map.sendUnoCommand('.uno:TextFormField', parameters);
			this.updateFieldsList();
		}
		else if (selected.type === 'style') {
			this.setStyle(selected);
		}
		else if (selected.type === 'note') {
			if (this.map._clip) {
				this.map._clip.dataTransferToDocumentFallback(null, selected.item.data.note);
				app.socket.sendMessage('uno .uno:Paste');
			}
			else
				console.warn('zotero: cannot paste a note');
		}
	},

	handleItemList: function() {
		this.showItemList();
	},

	handleStyleList: function() {
		this.showStyleList();
	},

	handleInsertNote: function() {
		if (!this.settings.style) {
			this.pendingAction = this.handleInsertNote;
			this.showStyleList();
			return;
		}

		var that = this;
		this.dialogType = 'insertnote';
		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/items/top' + this.getZoteroItemQuery())
			.then(function (data) {
				that.dialogSetup(_('Add Note'), false);
				that.fillNotes(data);

				var dialogUpdateEvent = that.updateList([_('Notes')],_('An error occurred while fetching notes'));

				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
			});
	},

	handleInsertBibliography: function() {

		if (!this.settings.style) {
			this.pendingAction = this.handleInsertBibliography;
			this.showStyleList();
			return;
		}

		if (!this.citations.size)
			return;

		var that = this;

		fetch('https://api.zotero.org/users/' + this.userID + '/items?format=bib&itemKey=' + this.getCitationKeys().join(',') + '&v=3&key=' + this.apiKey + '&style=' + this.settings.style)
			.then(function (response) { return response.text(); })
			.then(function (html) {
				var parameters = {
					FieldType: {type: 'string', value: 'vnd.oasis.opendocument.field.UNHANDLED'},
					FieldCommand: {type: 'string', value: 'ADDIN ZOTERO_BIBL CSL_BIBLIOGRAPHY '},
					FieldResult: {type: 'string', value: html}
				};

				that.map.sendUnoCommand('.uno:TextFormField', parameters);
			});
	},

	updateFieldsList: function() {
		app.socket.sendMessage('commandvalues command=.uno:TextFormFields?type=vnd.oasis.opendocument.field.UNHANDLED&commandPrefix=ADDIN%20ZOTERO_ITEM%20CSL_CITATION');
	},

	_onMessage: function(message) {
		if (message.startsWith('itemslist: ')) {
			this.handleItemList(message);
		}
	},

	// from https://raw.githubusercontent.com/citation-style-language/locales/master/locales.json
	// saves us from fetching same thing every time for every user
	languageNames: {
		'af-ZA': [
			'Afrikaans',
			'Afrikaans'
		],
		'ar': [
			'العربية',
			'Arabic'
		],
		'bg-BG': [
			'Български',
			'Bulgarian'
		],
		'ca-AD': [
			'Català',
			'Catalan'
		],
		'cs-CZ': [
			'Čeština',
			'Czech'
		],
		'cy-GB': [
			'Cymraeg',
			'Welsh'
		],
		'da-DK': [
			'Dansk',
			'Danish'
		],
		'de-AT': [
			'Deutsch (Österreich)',
			'German (Austria)'
		],
		'de-CH': [
			'Deutsch (Schweiz)',
			'German (Switzerland)'
		],
		'de-DE': [
			'Deutsch (Deutschland)',
			'German (Germany)'
		],
		'el-GR': [
			'Ελληνικά',
			'Greek'
		],
		'en-GB': [
			'English (UK)',
			'English (UK)'
		],
		'en-US': [
			'English (US)',
			'English (US)'
		],
		'es-CL': [
			'Español (Chile)',
			'Spanish (Chile)'
		],
		'es-ES': [
			'Español (España)',
			'Spanish (Spain)'
		],
		'es-MX': [
			'Español (México)',
			'Spanish (Mexico)'
		],
		'et-EE': [
			'Eesti keel',
			'Estonian'
		],
		'eu': [
			'Euskara',
			'Basque'
		],
		'fa-IR': [
			'فارسی',
			'Persian'
		],
		'fi-FI': [
			'Suomi',
			'Finnish'
		],
		'fr-CA': [
			'Français (Canada)',
			'French (Canada)'
		],
		'fr-FR': [
			'Français (France)',
			'French (France)'
		],
		'he-IL': [
			'עברית',
			'Hebrew'
		],
		'hi-IN': [
			'हिंदी',
			'Hindi'
		],
		'hr-HR': [
			'Hrvatski',
			'Croatian'
		],
		'hu-HU': [
			'Magyar',
			'Hungarian'
		],
		'id-ID': [
			'Bahasa Indonesia',
			'Indonesian'
		],
		'is-IS': [
			'Íslenska',
			'Icelandic'
		],
		'it-IT': [
			'Italiano',
			'Italian'
		],
		'ja-JP': [
			'日本語',
			'Japanese'
		],
		'km-KH': [
			'ភាសាខ្មែរ',
			'Khmer'
		],
		'ko-KR': [
			'한국어',
			'Korean'
		],
		'la': [
			'Latina',
			'Latin'
		],
		'lt-LT': [
			'Lietuvių kalba',
			'Lithuanian'
		],
		'lv-LV': [
			'Latviešu',
			'Latvian'
		],
		'mn-MN': [
			'Монгол',
			'Mongolian'
		],
		'nb-NO': [
			'Norsk bokmål',
			'Norwegian (Bokmål)'
		],
		'nl-NL': [
			'Nederlands',
			'Dutch'
		],
		'nn-NO': [
			'Norsk nynorsk',
			'Norwegian (Nynorsk)'
		],
		'pl-PL': [
			'Polski',
			'Polish'
		],
		'pt-BR': [
			'Português (Brasil)',
			'Portuguese (Brazil)'
		],
		'pt-PT': [
			'Português (Portugal)',
			'Portuguese (Portugal)'
		],
		'ro-RO': [
			'Română',
			'Romanian'
		],
		'ru-RU': [
			'Русский',
			'Russian'
		],
		'sk-SK': [
			'Slovenčina',
			'Slovak'
		],
		'sl-SI': [
			'Slovenščina',
			'Slovenian'
		],
		'sr-RS': [
			'Српски / Srpski',
			'Serbian'
		],
		'sv-SE': [
			'Svenska',
			'Swedish'
		],
		'th-TH': [
			'ไทย',
			'Thai'
		],
		'tr-TR': [
			'Türkçe',
			'Turkish'
		],
		'uk-UA': [
			'Українська',
			'Ukrainian'
		],
		'vi-VN': [
			'Tiếng Việt',
			'Vietnamese'
		],
		'zh-CN': [
			'中文 (中国大陆)',
			'Chinese (PRC)'
		],
		'zh-TW': [
			'中文 (台灣)',
			'Chinese (Taiwan)'
		]
	}
});

L.control.zotero = function (map) {
	return new L.Control.Zotero(map);
};

