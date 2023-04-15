/* -*- js-indent-level: 8 -*- */
/*
* Control.Mention
*/
L.Control.Mention = L.Control.extend({
	onAdd: function (map) {
		this.map = map;
		this.map.on('openmentionpopup', this.openMentionPopup, this);
		this.map.on('closementionpopup', this.closeMentionPopup, this);
		this.map.on('sendmentiontext', this.sendMentionText, this);
		this.newPopupData = {
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
			this.map.fire('postMessage', { msgId: 'UI_Mention', args: { type: 'autocomplete', text: text } });
			this.firstChar = text[0];
		} else {
			this.openMentionPopup({ data: this.users });
		}
	},

	getCurrentCursorPosition: function () {
		var currPos = this.map._docLayer._corePixelsToCss(this.map._docLayer._cursorCorePixels.getBottomLeft());
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		return new L.Point(Math.round(currPos.x + panePos.x - origin.x), Math.round(currPos.y + panePos.y - origin.y));
	},

	openMentionPopup: function (ev) {
		var framePos = this.getCurrentCursorPosition();
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

			var data;
			var control = {
				'id': 'mentionList',
				'type': 'treelistbox',
				'text': '',
				'enabled': true,
				'singleclickactivate': false,
				'fireKeyEvents': true
			};
			// update the popup with list if mentionList already exist
			if (L.DomUtil.get('mentionList')) {
				data = {
					'jsontype': 'dialog',
					'id': 'mentionPopup',
					'control': control
				};
				data.control.entries = entries;
				data.posx = framePos.x;
				data.posy = framePos.y;
				this.map.fire('jsdialogupdate', { data: data, callback: this.callback.bind(this) });
				return;
			}
			if (L.DomUtil.get('mentionPopup'))
				this.closeMentionPopup({ typingMention: true });
			data = this.newPopupData;
			data.children[0].children[0] = control;
			data.children[0].children[0].entries = entries;
		} else {
			var control = {
				'id': 'fixedtext',
				'type': 'fixedtext',
				'text': 'no search results found!',
				'enabled': true,
			};
			if (L.DomUtil.get('fixedtext')) {
				data = {
					'jsontype': 'dialog',
					'id': 'mentionPopup',
					'control': control
				};
				data.posx = framePos.x;
				data.posy = framePos.y;
				this.map.fire('jsdialogupdate', { data: data, callback: this.callback.bind(this) });
				return;
			}
			if (L.DomUtil.get('mentionPopup'))
				this.closeMentionPopup({ typingMention: true });
			data = this.newPopupData;
			data.children[0].children[0] = control;
		}
		// add position
		data.posx = framePos.x;
		data.posy = framePos.y;
		this.map.fire('jsdialog', { data: data, callback: this.callback.bind(this) });
	},

	closeMentionPopup: function (ev) {
		var closePopupData = {
			'jsontype': 'dialog',
			'type': 'modalpopup',
			'action': 'close',
			'id': 'mentionPopup',
		};
		this.map.fire('jsdialog', { data: closePopupData, callback: undefined });
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
	},

	callback: function (objectType, eventType, object, index) {
		if (eventType === 'close') {
			this.closeMentionPopup({ 'typingMention': false });
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
			this._map.sendUnoCommand('.uno:SetHyperlink', command, true);
			this.map.fire('postMessage', { msgId: 'UI_Mention', args: { type: 'selected', username: this.itemList[index].username }});
			this.closeMentionPopup({ 'typingMention': false });
		} else if (eventType === 'keydown') {
			if (object.key !== 'Tab' && object.key !== 'Shift') {
				this.map.focus();
				return true;
			}
		}
		return false;
	},
});
L.control.mention = function () {
	return new L.Control.Mention();
};