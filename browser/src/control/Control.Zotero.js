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
		this.resetCitation();

		for (var index = 0; index < fields.length; index++) {
			var field = fields[index];
			var fieldString;
			if (this.getFieldType() === 'Field')
				fieldString = field.command;
			else if (this.getFieldType() === 'ReferenceMark')
				fieldString = field.name;
			else if (this.getFieldType() === 'Bookmark')
				fieldString = field.bookmark;

			var firstBraceIndex = fieldString.indexOf('{');
			var lastBraceIndex = fieldString.lastIndexOf('}');

			if (firstBraceIndex < 0 || lastBraceIndex > fieldString.length || lastBraceIndex < 0)
				continue;

			var values = JSON.parse(fieldString.substring(firstBraceIndex, lastBraceIndex+1));
			if (!values) {
				return;
			}
			var that = this;
			this.citationCluster[values.citationID] = [];
			var citationString = L.Util.trim(values.properties.plainCitation, this.settings.layout.prefix, this.settings.layout.suffix);
			var citations = citationString.split(this.settings.layout.delimiter);
			values.citationItems.forEach(function(item, i) {
				var citationId = item.id.toString().substr(item.id.toString().indexOf('/')+1);
				that.citationCluster[values.citationID].push(citationId);
				that.citations[citationId] = L.Util.trim(citations[i], that.settings.group.prefix, that.settings.group.suffix);
				that.setCitationNumber(that.citations[citationId]);
			});
		}

		if (this.pendingCitationUpdate || this.previousNumberOfFields !== fields.length) {
			delete this.pendingCitationUpdate;
			this.updateCitations();
		}
		this.previousNumberOfFields = fields.length;
	},

	getCitationKeys: function() {
		return Object.keys(this.citations);
	},

	onRemove: function () {
		this.map.off('updateviewslist', this.onUpdateViews, this);
	},

	onUpdateViews: function () {
		var userPrivateInfo = this.map._docLayer ? this.map._viewInfo[this.map._docLayer._viewId].userprivateinfo : null;
		if (userPrivateInfo) {
			this.apiKey = userPrivateInfo.ZoteroAPIKey;
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
									id: 'zoterorefresh-buttonbox',
									type: 'buttonbox',
									leftaligned: 'true',
									children: [
										{
											type: 'pushbutton',
											id: 'zoterorefresh',
											text: _('Refresh')
										}
									],
									vertical: false,
									layoutstyle: 'end'
								},
								{
									type: 'edit',
									id: 'zoterosearch',
									placeholder: _('Search'),
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
									entries: [ { columns: [ { text: _('Loading...') } ] } ]
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
									enabled: false,
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

	enableDialogOKButton: function() {
		this.map.fire('jsdialogupdate', {
			data: {
				jsontype: 'dialog',
				action: 'update',
				id: 'ZoteroDialog',
				control: {
					id: 'ok',
					type: 'pushbutton',
					text: _('OK'),
					'has_default': true
				},
			},
			callback: this._onAction.bind(this)
		});
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
						entries: [ { columns: [ { text: failText } ] } ]
					},
				},
			};
		}
	},

	getZoteroItemQuery: function() {
		return '?v=3&key=' + this.apiKey + '&include=data,citation,csljson&style=' + this.settings.style + '&locale=' + this.settings.locale;
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

	resetCitation: function() {
		this.citationCluster = {};
		this.citations = {};
		delete this.settings.citationNumber;
		if (this.getFieldType() === 'Bookmark')
			this.bookmarksOrder = [];
	},

	setCitationNumber: function(number) {
		if (this.settings.citationFormat !== 'numeric')
			return;

		if (!this.settings.citationNumber)
			this.settings.citationNumber = 1;

		this.settings.citationNumber = this.settings.citationNumber <= parseInt(number) ? parseInt(number) + 1 : this.settings.citationNumber;

	},

	getCitationText: function(citationId, text) {
		if (this.citations && this.citations[citationId])
			return this.citations[citationId];

		if (this.settings.citationFormat === 'numeric') {
			if (!this.settings.citationNumber)
				this.settings.citationNumber = 1;
			this.citations[citationId] = this.settings.citationNumber++;
		} else {
			this.citations[citationId] = L.Util.trim(text, this.settings.layout.prefix, this.settings.layout.suffix);
		}

		return this.settings.group.prefix + this.citations[citationId] + this.settings.group.suffix;
	},

	handleCitationText: function(citationItems) {
		//Some citations have style so trying to change just inner most text without affecting other html
		var citationString = '';
		var citationNode = new DOMParser().parseFromString(citationItems[0].citation, 'text/html').body;

		var that = this;
		citationItems.forEach(function(item) {
			var itemHTML = new DOMParser().parseFromString(item.citation, 'text/html').body;
			// last-child works here only because its a single chain of nodes
			var innerMostNode = itemHTML.querySelector('*:last-child');

			citationString += innerMostNode ? that.getCitationText(item['key'], innerMostNode.textContent)
				: that.getCitationText(item['key'], item.citation.toString());
			citationString += that.settings.layout.delimiter;
		});

		citationString = this.settings.layout.prefix + L.Util.trimEnd(citationString, this.settings.layout.delimiter) + this.settings.layout.suffix;
		// last-child works here only because its a single chain of nodes
		var innerText = citationNode.querySelector('*:last-child');
		if (!innerText)
			citationNode.textContent = citationString;
		else
			innerText.textContent = citationString;
		return citationNode;
	},

	getCitationJSONString: function(items) {
		var resultJSON = {};
		resultJSON['citationID'] = L.Util.randomString(10);

		var citationNode = this.handleCitationText(items);

		var properties = {
			formattedCitation: citationNode.innerHTML,
			plainCitation: citationNode.textContent,
			noteIndex: '0'
		};

		resultJSON['properties'] = properties;

		resultJSON['citationItems'] = [];

		items.forEach(function(item) {
			var citationItems = {
				id: item['csljson'].id,
				uris: [item['links']['self']['href'], item['links']['alternate']['href']],
				itemData: item['csljson']
			};
			resultJSON['citationItems'].push(citationItems);
		});


		resultJSON['schema'] = 'https://raw.githubusercontent.com/citation-style-language/schema/master/schemas/input/csl-citation.json';

		return {jsonString: JSON.stringify(resultJSON),
			citationString: properties.formattedCitation};
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
		if (this.settings.style === '' && window.isLocalStorageAllowed)
			this.settings.style = localStorage.getItem('Zotero_LastUsedStyle');

		for (var iterator = 0; iterator < styles.length; ++iterator) {
			this.createEntry(iterator, [styles[iterator].title],
				Object.assign({name: styles[iterator].name, type: 'style'},
					this.settings.style === styles[iterator].name ? {selected: true} : null));
		}
	},

	fillNotes: function (items, notesCount) {
		var index = notesCount;
		for (var iterator = 0; iterator < items.length; ++iterator) {
			if (items[iterator].data.itemType !== 'note')
				continue;

			var dummyNode = L.DomUtil.create('div');
			dummyNode.innerHTML = items[iterator].data.note;
			var note = dummyNode.innerText.replaceAll('\n', ' ');

			this.createEntry(index++,
				[note],
				{type: 'note', itemType: items[iterator].data.itemType, item: items[iterator]},
				true
			);
		}
		return index;
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
		this.dialogSetup(_('Citation Style'), false, true);
		this.getCachedOrFetch('https://www.zotero.org/styles-files/styles.json')
			.then(function (data) {
				that.fillStyles(data);

				var dialogUpdateEvent = that.updateList([_('Styles')],_('An error occurred while fetching style list'));

				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
			});
	},

	fetchStyle: function() {
		this.fetchCustomProperty('ZOTERO_PREF_');
	},

	fetchCustomProperty: function(prefix) {
		app.socket.sendMessage('commandvalues command=.uno:SetDocumentProperties?namePrefix=' + prefix);
	},

	setFetchedCitationFormat: function(style) {
		if (!style)
			style = this.settings.style;

		var that = this;
		fetch('https://www.zotero.org/styles/' + style)
			.then(function (response) { return response.text(); })
			.then(function (html) {
				var csl = new DOMParser().parseFromString(html, 'text/xml');
				var categories = csl.getElementsByTagName('category');
				for (var i = 0; i < categories.length; i++) {
					if (categories[i].getAttribute('citation-format')) {
						that.settings.citationFormat = categories[i].getAttribute('citation-format');
						break;
					}
				}

				var citation = csl.getElementsByTagName('citation')[0];

				if (citation) {
					that.setCitationLayout(citation);
					that.updateCitations(true);
				} else {
					var link = csl.getElementsByTagName('link');
					for (var i = 0; i < link.length; i++) {
						if (link[i].getAttribute('rel') === 'independent-parent') {
							that.setFetchedCitationFormat(link[i].getAttribute('href').substring(link[i].getAttribute('href').lastIndexOf('/')+1));
							break;
						}
					}
				}
			});
	},

	setCitationLayout: function(ciatationNode) {
		var layout = ciatationNode.getElementsByTagName('layout')[0];
		this.settings.layout = {};
		this.settings.layout['prefix'] = layout && layout.getAttribute('prefix') ? layout.getAttribute('prefix') : '';
		this.settings.layout['suffix'] = layout && layout.getAttribute('suffix') ? layout.getAttribute('suffix') : '';
		this.settings.layout['delimiter'] = layout && layout.getAttribute('delimiter') ? layout.getAttribute('delimiter') : '';

		var group = layout.getElementsByTagName('group')[0];
		this.settings.group = {};
		this.settings.group['prefix'] = group && group.getAttribute('prefix') ? group.getAttribute('prefix') : '';
		this.settings.group['suffix'] = group && group.getAttribute('suffix') ? group.getAttribute('suffix') : '';
		this.settings.group['delimiter'] = group && group.getAttribute('delimiter') ? group.getAttribute('delimiter') : '';
	},

	setFetchedStyle: function(valueString) {

		var value = new DOMParser().parseFromString(valueString, 'text/xml');
		var styleNode = value.getElementsByTagName('style')[0];

		this.settings.style = styleNode.id.substring(styleNode.id.lastIndexOf('/')+1);
		var locale = styleNode.getAttribute('locale');
		if (locale)
			this.settings.locale = locale;
		this.settings.fieldType = value.getElementsByName('fieldType')[0].getAttribute('value');
		this.settings.hasBibliography = styleNode.getAttribute('hasBibliography');
		this.settings.bibliographyStyleHasBeenSet = styleNode.getAttribute('bibliographyStyleHasBeenSet');

		this.setFetchedCitationFormat();

		if (window.isLocalStorageAllowed)
			localStorage.setItem('Zotero_LastUsedStyle', this.settings.style);
	},

	setStyle: function(style) {
		this.settings.style = style.name;
		this.settings.hasBibliography = '1';

		var dataNode = document.createElement('data');
		dataNode.setAttribute('data-version', '3');

		var sessionNode = document.createElement('session');
		sessionNode.setAttribute('id', L.Util.randomString(8));

		dataNode.appendChild(sessionNode);

		var styleNode = document.createElement('style');
		styleNode.setAttribute('id', 'http://www.zotero.org/styles/' + style.name);
		if (this.selectedCitationLangCode)
			this.settings.locale = this.selectedCitationLangCode;
		styleNode.setAttribute('locale', this.settings.locale);
		styleNode.setAttribute('hasBibliography', this.settings.hasBibliography);
		styleNode.setAttribute('bibliographyStyleHasBeenSet', this.settings.bibliographyStyleHasBeenSet);

		dataNode.appendChild(styleNode);

		var prefsNode = document.createElement('prefs');

		var prefNode = document.createElement('pref');
		prefNode.setAttribute('name', 'fieldType');
		prefNode.setAttribute('value', this.getFieldType());

		prefsNode.appendChild(prefNode);

		dataNode.appendChild(prefsNode);

		var valueString = dataNode.outerHTML;

		this.setCustomProperty('ZOTERO_PREF_', valueString);
		this.setFetchedCitationFormat();

		if (window.isLocalStorageAllowed)
			localStorage.setItem('Zotero_LastUsedStyle', this.settings.style);
	},

	getFieldType: function() {
		if (this.settings.fieldType)
			return this.settings.fieldType;

		var fileExtension = this.map['wopi'].BaseFileName.substring(this.map['wopi'].BaseFileName.lastIndexOf('.') + 1);
		this.settings.fieldType = fileExtension.startsWith('doc') ? 'Field' : 'ReferenceMark';

		return this.settings.fieldType;
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
				this.enableDialogOKButton();
				return;
			}
		}
		if (element === 'edit' && data.id === 'zoterosearch') {
			document.getElementById('zoterolist').filterEntries(data.value);
			return;
		}
		if (data.id == 'ok') {
			// style already specified just changing the language
			if (!this.selected && this.selectedCitationLangCode)
				this._onOk({name: this.settings.style, type: 'style'});
			else
				this._onOk(this.selected);
		}
		if (element === 'pushbutton' && data.id === 'zoterorefresh') {
			this._cachedURL = [];
			if (this.dialogType === 'itemlist')
				this.showItemList();
			else if (this.dialogType === 'insertnote')
				this.handleInsertNote();
			else
				this.showStyleList();
			return;
		}
		if (element === 'combobox') {
			this.selectedCitationLangCode = Object.keys(this.languageNames)[parseInt(index)];
			if (this.settings.style)
				this.enableDialogOKButton();
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
			var citationData = this.getCitationJSONString([selected.item]);
			this.sendInsertCitationCommand(citationData.jsonString, citationData.citationString);

			// update all the citations once citations are inserted and we get updated fields
			this.pendingCitationUpdate = true;
		}
		else if (selected.type === 'style') {
			this.setStyle(selected);
		}
		else if (selected.type === 'note') {
			if (this.map._clip) {
				this.map._clip.dataTransferToDocumentFallback(null, selected.item.data.note);
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
		var notesCount = 0;

		this.dialogSetup(_('Add Note'), false);

		var updateDialog = function () {
			var dialogUpdateEvent = that.updateList([_('Notes')],_('An error occurred while fetching notes'));
			if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
			that.map.fire('jsdialogupdate', dialogUpdateEvent);
		};

		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/items' + this.getZoteroItemQuery())
			.then(function (data) {
				notesCount += that.fillNotes(data, notesCount);
				updateDialog();

				that.getCachedOrFetch('https://api.zotero.org/users/' + that.userID + '/groups?v=3&key=' + that.apiKey)
					.then(function (data) {
						for (var i = 0; i < data.length; i++) {
							var groupUrl = data[i].links.self.href + '/items' + that.getZoteroItemQuery();
							that.getCachedOrFetch(groupUrl)
								.then(function (data) {
									notesCount += that.fillNotes(data, notesCount);
									updateDialog();
								});
						}
					});
			});
	},

	handleInsertBibliography: function() {

		if (!this.settings.style) {
			this.pendingAction = this.handleInsertBibliography;
			this.showStyleList();
			return;
		}

		if (!(this.citations && Object.keys(this.citations)))
			return;

		var that = this;

		fetch('https://api.zotero.org/users/' + this.userID + '/items?format=bib&itemKey=' + this.getCitationKeys().join(',') + '&v=3&key=' + this.apiKey + '&style=' + this.settings.style + '&locale=' + this.settings.locale)
			.then(function (response) { return response.text(); })
			.then(function (html) {
				that.sendInsertBibCommand(html);
				that.settings.bibliographyStyleHasBeenSet = '1';
				that.setStyle({name: that.settings.style}); // update the document meta data about bib being set
			});
	},

	updateFieldsList: function() {
		if (this.getFieldType() === 'Field')
			app.socket.sendMessage('commandvalues command=.uno:TextFormFields?type=vnd.oasis.opendocument.field.UNHANDLED&commandPrefix=ADDIN%20ZOTERO_ITEM%20CSL_CITATION');
		else if (this.getFieldType() === 'ReferenceMark')
			app.socket.sendMessage('commandvalues command=.uno:Fields?typeName=SetRef&namePrefix=ZOTERO_ITEM%20CSL_CITATION');
		else if (this.getFieldType() === 'Bookmark')
			app.socket.sendMessage('commandvalues command=.uno:Bookmarks?namePrefix=ZOTERO_BREF_');
	},

	updateCitations: function(showSnackbar) {
		if (!this.citations) {
			this.updateFieldsList();
			return;
		}


		var that = this;
		var citationKeys = this.getCitationKeys();
		var citationCluster = this.citationCluster;

		this.getCachedOrFetch('https://api.zotero.org/users/' + this.userID + '/items/top' + this.getZoteroItemQuery() + '&itemKey=' + citationKeys.join(','))
			.then(function (data) {
				that.resetCitation();
				// creating object for faster search
				var dataMap = data.reduce(function(map, item) {
					map[item.key] = item;
					return map;
				}, {});

				var newValues = [];
				Object.keys(citationCluster).forEach(function (clusterKey) {
					var itemList = citationCluster[clusterKey].reduce(function(list, item) {
						list.push(dataMap[item]);
						return list;
					}, []);
					var citationData = that.getCitationJSONString(itemList);
					var updateParameter = that.getFieldParameters(citationData.jsonString, citationData.citationString);
					newValues.push(that.getFieldType() !== 'Bookmark' ? updateParameter : {parameter: updateParameter, cslJSON: citationData.jsonString});
				});

				that.sendUpdateCitationCommand(newValues);
				if (showSnackbar)
					that.map.uiManager.showSnackbar(_('Updated citations'));
			});

		if (showSnackbar)
			this.map.uiManager.showSnackbar(_('Updating citations'));
	},

	refreshCitations: function() {
		//discard the cached url and fetch fresh one
		var refreshURL = 'https://api.zotero.org/users/' + this.userID + '/items/top' + this.getZoteroItemQuery() + '&itemKey=' + this.getCitationKeys().join(',');
		if (this._cachedURL[refreshURL])
			delete this._cachedURL[refreshURL];
		this.updateCitations(true);
	},

	sendInsertCitationCommand: function(cslJSON, citationString) {
		var command = '';
		var parameters = this.getFieldParameters(cslJSON, citationString);
		if (this.getFieldType() === 'Field')
			command = '.uno:TextFormField';
		else if (this.getFieldType() === 'ReferenceMark')
			command = '.uno:InsertField';
		else if (this.getFieldType() == 'Bookmark') {
			command = '.uno:InsertBookmark';
			this.setCustomProperty(parameters['Bookmark'].value + '_', 'ZOTERO_ITEM CSL_CITATION ' + cslJSON);
		}

		this.map.sendUnoCommand(command, parameters);
		this.updateFieldsList();
	},

	sendUpdateCitationCommand: function(newValueArray) {

		var updatedCitations;
		if (this.getFieldType() === 'Field') {
			updatedCitations = {
				'FieldType': {
					'type': 'string',
					'value': 'vnd.oasis.opendocument.field.UNHANDLED'
				},
				'FieldCommandPrefix': {
					'type': 'string',
					'value': 'ADDIN ZOTERO_ITEM CSL_CITATION'
				},
				'Fields': {
					'type': '[][]com.sun.star.beans.PropertyValue',
					'value': newValueArray
				}
			};
			this.map.sendUnoCommand('.uno:TextFormFields', updatedCitations);
		} else if (this.getFieldType() === 'ReferenceMark') {
			updatedCitations = {
				'TypeName': {
					'type': 'string',
					'value': 'SetRef'
				},
				'NamePrefix': {
					'type': 'string',
					'value': 'ZOTERO_ITEM CSL_CITATION'
				},
				'Fields': {
					'type': '[][]com.sun.star.beans.PropertyValue',
					'value': newValueArray
				}
			};
			this.map.sendUnoCommand('.uno:UpdateFields', updatedCitations);
		} else if (this.getFieldType() === 'Bookmark') {
			updatedCitations = {
				'BookmarkNamePrefix': {
					'type': 'string',
					'value': 'ZOTERO_BREF_'
				},
				'Bookmarks': {
					'type': '[][]com.sun.star.beans.PropertyValue',
					'value': newValueArray.map(function(value) {return value.parameter;})
				}
			};
			var that = this;
			newValueArray.forEach(function(value) {
				that.setCustomProperty(value.parameter['Bookmark'].value + '_', 'ZOTERO_ITEM CSL_CITATION ' + value.cslJSON);
			});
			this.map.sendUnoCommand('.uno:UpdateBookmarks', updatedCitations);
		}

		this.updateFieldsList();
	},

	getFieldParameters: function(cslJSON, citationString) {
		var field = {};

		if (this.getFieldType() === 'Field') {
			field['FieldType'] = {type: 'string', value: 'vnd.oasis.opendocument.field.UNHANDLED'};
			field['FieldCommand'] = {type: 'string', value: 'ADDIN ZOTERO_ITEM CSL_CITATION ' + cslJSON};
			field['FieldResult'] = {type: 'string', value: citationString};
		} else if (this.getFieldType() === 'ReferenceMark') {
			field['TypeName'] = {type: 'string', value: 'SetRef'};
			field['Name'] = {type: 'string', value: 'ZOTERO_ITEM CSL_CITATION ' + cslJSON + ' RND' + L.Util.randomString(10)};
			field['Content'] = {type: 'string', value: citationString};
		} else if (this.getFieldType() == 'Bookmark') {
			field['Bookmark'] = {type: 'string', value: 'ZOTERO_BREF_' + L.Util.randomString(12)};
			field['BookmarkText'] = {type: 'string', value: citationString};
		}

		return field;
	},

	getBibParameters: function(html) {
		var field = {};
		// TODO: support uncited ommited(citation) and custom sources in bibliography
		if (this.getFieldType() === 'Field') {
			field['FieldType'] = {type: 'string', value: 'vnd.oasis.opendocument.field.UNHANDLED'};
			field['FieldCommand'] = {type: 'string', value: 'ADDIN ZOTERO_BIBL {"uncited":[],"omitted":[],"custom":[]} CSL_BIBLIOGRAPHY'};
			field['FieldResult'] = {type: 'string', value: html};
		} else if (this.getFieldType() == 'Bookmark') {
			field['Bookmark'] = {type: 'string', value: 'ZOTERO_BREF_' + L.Util.randomString(12)};
			field['BookmarkText'] = {type: 'string', value: html};
		} else {
			field['RegionName'] = {type: 'string', value: 'ZOTERO_BIBL {"uncited":[],"omitted":[],"custom":[]} CSL_BIBLIOGRAPHY ' + ' RND' + L.Util.randomString(10)};
			field['Content'] = {type: 'string', value: html};
		}

		return field;
	},

	sendInsertBibCommand: function(html) {
		var command = '';
		var parameters = this.getBibParameters(html);
		if (this.getFieldType() === 'Field') {
			command = '.uno:TextFormField';
			if (this.settings.bibliographyStyleHasBeenSet == '1') {
				parameters = {
					'FieldType': {
						'type': 'string',
						'value': 'vnd.oasis.opendocument.field.UNHANDLED'
					},
					'FieldCommandPrefix': {
						'type': 'string',
						'value': 'ADDIN ZOTERO_BIBL'
					},
					'Fields': {
						'type': '[][]com.sun.star.beans.PropertyValue',
						'value': [parameters]
					}
				};
				command = '.uno:TextFormFields';
			}

		} else if (this.getFieldType() == 'Bookmark') {
			command = '.uno:InsertBookmark';
			var newBibBookmarkName = parameters['Bookmark'].value;
			if (this.settings.bibliographyStyleHasBeenSet == '1') {
				command = '.uno:UpdateBookmarks';
				parameters = {
					'BookmarkNamePrefix': {
						'type': 'string',
						'value': this.bibBookmarkName
					},
					'Bookmarks': {
						'type': '[][]com.sun.star.beans.PropertyValue',
						'value': [parameters]
					}
				};
			}
			this.bibBookmarkName = newBibBookmarkName;
			this.setCustomProperty(this.bibBookmarkName + '_', 'ZOTERO_BIBL {"uncited":[],"omitted":[],"custom":[]} CSL_BIBLIOGRAPHY');
		} else {
			command = '.uno:InsertSection';
			if (this.settings.bibliographyStyleHasBeenSet == '1') {
				var command = '.uno:UpdateSections';
				parameters = {
					'SectionNamePrefix': {
						'type': 'string',
						'value': 'ZOTERO_BIBL'
					},
					'Sections': {
						'type': '[][]com.sun.star.beans.PropertyValue',
						'value': [parameters]
					}
				};
			}
		}

		this.map.sendUnoCommand(command, parameters);
	},

	setCustomProperty: function(prefix, string) {
		var property =
		{
			'UpdatedProperties': {
				'type': '[]com.sun.star.beans.PropertyValue',
				'value': {
					'NamePrefix': {
						'type': 'string',
						'value': prefix
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
		for (var start = 0, end = 1; (end * 255) < (string.length + 255); start++, end++) {
			property['UpdatedProperties']['value']['UserDefinedProperties']['value'][prefix+end] =
			{
				'type': 'string',
				'value': string.slice(start*255, end*255)
			};

		}
		this.map.sendUnoCommand('.uno:SetDocumentProperties', property);
	},

	handleCustomProperty: function(userDefinedProperties) {
		var prefixList = new Set();
		var nameValueMap = {};
		var resultMap = {};
		for (var i = 0; i < userDefinedProperties.length; i++) {
			prefixList.add(userDefinedProperties[i].name.substring(0, userDefinedProperties[i].name.lastIndexOf('_')));
			nameValueMap[userDefinedProperties[i].name] = userDefinedProperties[i].value;
		}

		prefixList.forEach(function(prefix) {
			for (i = 1; nameValueMap[prefix + '_' + i]; i++) {
				if (resultMap[prefix])
					resultMap[prefix] += nameValueMap[prefix + '_' + i];
				else
					resultMap[prefix] = nameValueMap[prefix + '_' + i];
			}
		});
		if (resultMap.ZOTERO_PREF)
			this.setFetchedStyle(resultMap.ZOTERO_PREF);
		else if (Object.keys(resultMap)[0].startsWith('ZOTERO_BREF')) {
			var fields = [];
			var that = this;
			this.bookmarksOrder.forEach(function(bookmark) {
				if (resultMap[bookmark].startsWith('ZOTERO_BIBL')) {
					that.bibBookmarkName = bookmark;
					return;
				}
				fields.push({bookmark: resultMap[bookmark]});
			});
			this.onFieldValue(fields);
		}
	},

	handleBookmark: function(bookmarks) {
		this.resetCitation();
		var that = this;
		bookmarks.forEach(function(bookmark) {
			that.bookmarksOrder.push(bookmark.name);
		});
		this.fetchCustomProperty('ZOTERO_BREF_');
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
