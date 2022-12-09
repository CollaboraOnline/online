/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Control.Zotero
 */

/* global _ */
L.Control.Zotero = L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		this.enable = false;
		this.map.on('updateviewslist', this.onUpdateViews, this);
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
				if (that.map.uiManager.isMenubarHidden())
					;
				else
					that.map.menubar._onRefresh();
			});
	},

	dialogSetup: function (title) {
		this.remove();

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
			enabled: true,
			children: [
				{
					id: 'dialog-vbox1',
					type: 'container',
					text: '',
					enabled: true,
					vertical: true,
					children: [
						{
							type: 'treelistbox',
							id: 'zoterolist',
							enabled: false,
						},
						{
							id: 'dialog-action_area1',
							type: 'container',
							text: '',
							enabled: true,
							vertical: true,
							children: [
								{
									id: '',
									type: 'buttonbox',
									text: '',
									enabled: true,
									children: [
										{
											id: 'cancel',
											type: 'pushbutton',
											text: '~Cancel',
											enabled: true
										},
										{
											id: 'ok',
											type: 'pushbutton',
											text: '~Ok',
											enabled: true,
											'has_default': true,
										}
									],
									vertical: false,
									layoutstyle: 'end'
								},
							],
						},
					]
				},
			],
		};

		this.items = [];

		var dialogBuildEvent = {
			data: data,
			callback: this._onAction.bind(this),
		};


		this.map.fire(window.mode.isMobile() ? 'mobilewizard' : 'jsdialog', dialogBuildEvent);

		return this;
	},

	updateDialog: function(headerArray, failText) {
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
						text: '',
						enabled: true,
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
						type: 'fixedtext',
						text: failText,
					},
				},
			};
		}
	},

	// columns: Array of details which will be displayed in the dialog
	// entryData: Object containing extra details related to the entry
	createEntry: function (index, columns, entryData) {
		this.items.push(Object.assign({ 'columns': columns.map(
			function (item) {
				return { text: item };
			}
		), 'row': index,
		}, entryData));
	},

	fillItems: function (items) {
		for (var iterator = 0; iterator < items.length; ++iterator) {
			var creatorArray = [];
			for (var creator = 0; items[iterator].data.creators && creator < items[iterator].data.creators.length; ++creator) {
				creatorArray.push(items[iterator].data.creators[creator].firstName + ' ' + items[iterator].data.creators[creator].lastName);
			}
			var creatorString = creatorArray.join(', ');
			this.createEntry(iterator,
				[items[iterator].data.title, creatorString, items[iterator].data.date],
				{citation: items[iterator].citation, bib: items[iterator].bib, type: 'item'}
			);
		}
	},

	fillStyles: function (styles) {
		for (var iterator = 0; iterator < styles.length; ++iterator) {
			this.createEntry(iterator, [styles[iterator].title], {name: styles[iterator].name, type: 'style'});
		}
	},

	showItemList: function () {
		var that = this;
		fetch('https://api.zotero.org/users/' + this.userID + '/items/top?v=3&key=' + this.apiKey + '&include=data,citation,bib')
			.then(function (response) { return response.json();})
			.then(function (data) {
				that.dialogSetup(_('My Library'));
				that.fillItems(data);

				var dialogUpdateEvent = that.updateDialog(['Title', 'Creator(s)', 'Date'], _('Your library is empty'));

				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
			});
	},

	showStyleList: function() {
		var that = this;
		fetch('https://www.zotero.org/styles-files/styles.json')
			.then(function (response) { return response.json();})
			.then(function (data) {
				that.dialogSetup(_('Citation Style'));
				that.fillStyles(data);

				var dialogUpdateEvent = that.updateDialog(['Styles'],_('An error occurred while fetching style list'));

				if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
				that.map.fire('jsdialogupdate', dialogUpdateEvent);
			});
	},

	_onAction: function(element, action, data, index) {
		if (element === 'dialog' && action === 'close') return;
		if (element === 'treeview') {
			this.selected = data.entries[parseInt(index)];
			return;
		}
		if (element === 'responsebutton' && data.id == 'ok' && this.selected) {
			this._onOk(this.selected);
		}

		var closeEvent = {
			data: {
				action: 'close',
				id: 'ZoteroDialog',
			}
		};
		this.map.fire(window.mode.isMobile() ? 'closemobilewizard' : 'jsdialog', closeEvent);
		console.log('Closed after');
	},

	_onOk: function (selected) {
		console.log(selected);


		if (selected.type === 'item') {
			var parameters = {
				FieldType: {type: 'string', value: 'vnd.oasis.opendocument.field.UNHANDLED'},
				FieldCommand: {type: 'string', value: 'ADDIN ZOTERO_ITEM CSL_CITATION'},
				FieldResult: {type: 'string', value: selected.citation}
			};

			this.map.sendUnoCommand('.uno:TextFormField', parameters);
		}
		else if (selected.type === 'style') {
			console.log('do something');
		}
	},

	handleItemList: function() {
		this.showItemList();
	},

	handleStyleList: function() {
		this.showStyleList();
	},

	_onMessage: function(message) {
		if (message.startsWith('itemslist: ')) {
			this.handleItemList(message);
		}
	}
});

L.control.zotero = function (map) {
	return new L.Control.Zotero(map);
};

