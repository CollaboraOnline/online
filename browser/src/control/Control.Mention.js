/* -*- js-indent-level: 8 -*- */
/*
* Control.Mention
*/
L.Control.Mention = L.Control.extend({
	onAdd: function (map) {
		this.map = map;
		this.map.on('openmentionpopup', this.openMentionPopup, this);
		this.map.on('closementionpopup', this.closeMentionPopup, this);
		this.closeMentionPopupJson = {
			'jsontype': 'dialog',
			'type': 'modalpopup',
			'action': 'close',
			'id': 'mentionPopup',
		};
		this.map.on('sendmentiontext', this.sendMentionText, this);
		this.data = {
			'children': [
				{
					'id': 'container',
					'type': 'container',
					'text': '',
					'enabled': true,
					'children': [],
					'vertical': true
				}
			],
			'jsontype': 'dialog',
			'type': 'modalpopup',
			'isMention': true,
			'cancellable': true,
			'popupParent': '_POPOVER_',
			'clickToClose': '_POPOVER_',
			'id': 'mentionPopup'
		};
		this.firstChar = null;
		this.users = null;
		this.itemList = null;
	},

	sendMentionText: function (ev) {
		var text = ev.data.join('').substring(1);
		if (text.length === 1 && this.firstChar !== text[0]) {
			// TODO: if waiting time to get list is unbearable uncomment below line to show spinner 
			// this.openMentionPopup({ showSpinner: true });
			this.map.fire('postMessage', { msgId: 'UI_Mention', args: { type: 'autocomplete', text: text } });
			this.firstChar = text[0];
		} else {
			this.openMentionPopup({ data: this.users });
		}
	},

	getCurrentCursorPostion: function () {
		var cursorCorePixels = this.map._docLayer._cursorCorePixels;
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		return new L.Point(Math.round(cursorCorePixels.max.x + panePos.x - origin.x), Math.round(cursorCorePixels.max.y + panePos.y - origin.y));
	},

	openMentionPopup: function (ev) {
		var framePos = this.getCurrentCursorPostion();
		var data = this.data;
		if (ev.showSpinner) {
			data.children[0].children[0] = {
				'id': 'spinner',
				'type': 'spinner',
				'text': '',
				'enabled': true,
				'singleclickactivate': true,
			};
		} else {
			this.users = ev.data;
			if (this.users === null)
				return;
			
			var text = this.map._docLayer._mentionText.join('').substring(1);
			// filterout the users from list according to the text
			if (text.length > 1) {
				this.itemList = this.users.filter(function (element) {
					// case insensitive
					return element.username.toLowerCase().includes(text.toLowerCase());
				});
			} else {
				this.itemList = this.users;
			}

			if (this.itemList.length !== 0) {
				var entries = [];
				data.children[0].children[0] = {
					'id': 'mentionList',
					'type': 'treelistbox',
					'text': '',
					'enabled': true,
					'singleclickactivate': true,
				};

				// add entries
				for (var i in this.itemList) {
					var entry = {
						'text': this.itemList[i].username,
						'columns': [
							{
								'text': this.itemList[i].username
							}
						],
						'row': i.toString()
					};
					entries.push(entry);
				}
				data.children[0].children[0].entries = entries;

			} else {
				data.children[0].children[0] = {
					'id': 'fixedtext',
					'type': 'fixedtext',
					'text': 'no search results found!',
					'enabled': true,
					'singleclickactivate': true,
				};
			}
		}

		// add position
		data.posx = framePos.x;
		data.posy = framePos.y;

		// close the mention popup if already exist
		var mentionPopup = L.DomUtil.get('mentionPopup');
		if (mentionPopup) {
			this.closeMentionPopup({'typingMention' : true});
		}

		this.map.fire('jsdialog', { data: data, callback: this.callback.bind(this) });
	},

	closeMentionPopup: function (ev) {
		this.map.fire('jsdialog', { data: this.closeMentionPopupJson, callback: undefined });
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
	},

	callback: function (objectType, eventType, object, index) {
		if (eventType === 'close') {
			this.map.fire('jsdialog', { data: this.closeMentionPopupJson, callback: undefined });
		} else if (eventType === 'select') {
			var command = {
				'Hyperlink.Text': {
					type: 'string',
					value: '@' + this.itemList[index].username,
				},
				'Hyperlink.URL': {
					type: 'string',
					value: this.itemList[index].profile,
				},
				'Hyperlink.ReplacementText': {
					type: 'string',
					value: this.map._docLayer._mentionText.join(''),
				}
			};
			this._map.sendUnoCommand('.uno:SetHyperlink', command);
			this.map.fire('jsdialog', { data: this.closeMentionPopupJson, callback: undefined });
		}
		this.map._docLayer._typingMention = false;
		this.map._docLayer._mentionText = [];
	},
});
L.control.mention = function () {
	return new L.Control.Mention();
};