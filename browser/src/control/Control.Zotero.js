/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Control.Zotero
 */

/* global _ */
L.Control.Zotero = L.Control.extend({

	initialize: function (map, zoteroProps) {
		this.map = map;
		this.enable = !!zoteroProps['Enable'];
	},

	dialogSetup: function () {
		this.remove();

		var data = {
			id: 'ZoteroLibraryDialog',
			dialogid: 'ZoteroLibraryDialog',
			type: 'dialog',
			text: _('My Library'),
			title: _('My Library'),
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
							id: 'versions',
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

	createItem: function (index, tilte, authors, dateTime) {
		this.items.push({ 'text': tilte, 'columns': [
			tilte,
			authors,
			dateTime
		].map(
			function (item) {
				return { text: item };
			}
		), 'row': index});
	},

	fillItems: function (items) {
		for (var iterator = 0; iterator < items.length; ++iterator) {
			var creatorArray = [];
			for (var creator = 0; creator < items[iterator].data.creators.length; ++creator) {
				creatorArray.push(items[iterator].data.creators[creator].firstName + ' ' + items[iterator].data.creators[creator].lastName);
			}
			var creatorString = creatorArray.join(', ');
			this.createItem(iterator, items[iterator].data.title, creatorString, items[iterator].data.date);
		}
	},

	show: function () {
		if (this.items.length !== 0) {
			var dialogUpdateEvent = {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: 'ZoteroLibraryDialog',
					control: {
						id: 'versions',
						type: 'treelistbox',
						headers: ['Title', 'Author(s)', 'Date'].map(
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
			var dialogUpdateEvent = {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: 'ZoteroLibraryDialog',
					control: {
						id: 'versions',
						type: 'fixedtext',
						text: _('Your library is empty'),
					},
				},
			};
		}
		if (window.mode.isMobile()) window.mobileDialogId = dialogUpdateEvent.data.id;
		this.map.fire('jsdialogupdate', dialogUpdateEvent);
	},

	_onAction: function(element, action, data, index) {
		if (element === 'dialog' && action === 'close') return;
		if (element === 'treeview') {
			var entry = data.entries[parseInt(index)];
			this.selected = {
				item: entry.columns[0].text,
				index: parseInt(entry.row),
			};
			return;
		}
		if (element === 'responsebutton' && data.id == 'ok' && this.selected) {
			this._onOk(this.selected.item, this.selected.index);
		}

		var closeEvent = {
		    data: {
				action: 'close',
				id: 'ZoteroLibraryDialog',
			}
		};
		this.map.fire(window.mode.isMobile() ? 'closemobilewizard' : 'jsdialog', closeEvent);
		console.log('Closed after');
	},

	_onOk: function (item, index) {
		console.log(item, index);
		// this._map.sendUnoCommand('.uno:' + action, command);
	},

	handItemList: function(itemList) {
		var itemListJSON = JSON.parse(itemList.substring('itemslist: '.length));
		console.log(itemListJSON);
		this.dialogSetup();
		this.fillItems(itemListJSON);
		this.show();
	},

	_onMessage: function(message) {
		if (message.startsWith('itemslist: ')) {
			this.handItemList(message);
		}
	}
});

L.control.zotero = function (map, zoteroProps) {
	return new L.Control.Zotero(map, zoteroProps);
};

