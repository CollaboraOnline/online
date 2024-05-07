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
 * Control.Mention
 */

/* global app */

// TODO: duplicate from MessageRouter
interface WidgetJSON {
	id: string; // unique id of a widget
	type: string; // type of widget
	enabled: boolean | undefined; // enabled state
	visible: boolean | undefined; // visibility state
	children: Array<WidgetJSON> | undefined; // child nodes
}

interface JSDialogJSON extends WidgetJSON {
	id: string; // unique windowId
	jsontype: string; // specifies target componenet, on root level only
	action: string | undefined; // optional name of an action
	control?: WidgetJSON;
}

interface PopupData extends JSDialogJSON {
	isMention?: boolean;
	cancellable?: boolean;
	popupParent?: string;
	clickToClose?: string;
	posx: number;
	posy: number;
}

interface Entry {
	text: string;
	columns: { text: any }[];
	row: string;
}

interface MentionWidget extends WidgetJSON {
	text: string;
	singleclickactivate: boolean;
	fireKeyEvents: boolean;
	entries: Array<Entry>;
}

interface FireEvent {
	data?: any
}
interface CloseMessageEvent extends FireEvent {
	typingMention?: boolean;
}

class Mention {
	map: ReturnType<typeof L.map>;
	newPopupData: PopupData;
	firstChar: string;
	users: any;
	itemList: Array<any>;
	data: MessageEvent<any>;

	onAdd(map: ReturnType<typeof L.map>) {
		this.map = map;
		this.map.on('openmentionpopup', this.openMentionPopup, this);
		this.map.on('closementionpopup', this.closeMentionPopup, this);
		this.map.on('sendmentiontext', this.sendMentionText, this);
		this.newPopupData = {
			children: [
				{
					id: 'container',
					type: 'container',
					enabled: true,
					children: new Array<WidgetJSON>(),
					vertical: true,
				} as any as WidgetJSON
			] as Array<WidgetJSON>,
			jsontype: 'dialog',
			type: 'modalpopup',
			isMention: true,
			cancellable: true,
			popupParent: '_POPOVER_',
			clickToClose: '_POPOVER_',
			id: 'mentionPopup',
		} as PopupData;
		this.firstChar = null;
		this.users = null;
		this.itemList = null;
	}

	sendMentionText(ev: FireEvent) {
		var text = ev.data.join('').substring(1);
		if (text.length === 1 && this.firstChar !== text[0]) {
			this.map.fire('postMessage', {
				msgId: 'UI_Mention',
				args: { type: 'autocomplete', text: text },
			});
			this.firstChar = text[0];
		} else {
			this.openMentionPopup({ data: this.users });
		}
	}

	getCurrentCursorPosition() {
		var currPos = this.map._docLayer._corePixelsToCss(this.map._docLayer._cursorCorePixels.getBottomLeft());
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		return new L.Point(
			Math.round(currPos.x + panePos.x - origin.x),
			Math.round(currPos.y + panePos.y - origin.y),
		);
	}

	openMentionPopup(ev: FireEvent) {
		var framePos = this.getCurrentCursorPosition();
		this.users = ev.data;
		if (this.users === null) return;

		var text = this.map._docLayer._mentionText.join('').substring(1);
		// filterout the users from list according to the text
		if (text.length > 1) {
			this.itemList = this.users.filter((element: any) => {
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
					text: this.itemList[i].username,
					columns: [
						{
							text: this.itemList[i].username,
						},
					],
					row: i.toString(),
				};
				entries.push(entry);
			}

			var data: PopupData;
			const control = {
				id: 'mentionList',
				type: 'treelistbox',
				text: '',
				enabled: true,
				singleclickactivate: false,
				fireKeyEvents: true,
				entries: [] as Array<Entry>,
			} as MentionWidget;
			// update the popup with list if mentionList already exist
			if (L.DomUtil.get('mentionList')) {
				data = {
					jsontype: 'dialog',
					id: 'mentionPopup',
					action: 'update',
					control: control,
					posx: framePos.x,
					posy: framePos.y,
				} as any as PopupData;
				(data.control as MentionWidget).entries = entries;
				this.map.fire('jsdialogupdate', {
					data: data,
					callback: this.callback.bind(this),
				});
				return;
			}
			if (L.DomUtil.get('mentionPopup'))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = this.newPopupData;
			data.children[0].children[0] = control;
			(data.children[0].children[0] as MentionWidget).entries = entries;
		} else {
			const control = {
				id: 'fixedtext',
				type: 'fixedtext',
				text: 'no search results found!',
				enabled: true,
				singleclickactivate: undefined,
				fireKeyEvents: undefined,
			} as MentionWidget;
			if (L.DomUtil.get('fixedtext')) {
				data = {
					jsontype: 'dialog',
					id: 'mentionPopup',
					action: 'update',
					control: control,
					posx: framePos.x,
					posy: framePos.y,
					children: undefined,
				} as any as PopupData;
				this.map.fire('jsdialogupdate', {
					data: data,
					callback: this.callback.bind(this),
				});
				return;
			}
			if (L.DomUtil.get('mentionPopup'))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = this.newPopupData;
			data.children[0].children[0] = control;
		}
		// add position
		data.posx = framePos.x;
		data.posy = framePos.y;
		this.map.fire('jsdialog', {
			data: data,
			callback: this.callback.bind(this),
		});
	}

	closeMentionPopup(ev: CloseMessageEvent) {
		var closePopupData = {
			jsontype: 'dialog',
			type: 'modalpopup',
			action: 'close',
			id: 'mentionPopup',
		} as PopupData;
		this.map.fire('jsdialog', { data: closePopupData, callback: undefined });
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
	}

	callback(objectType: any, eventType: any, object: any, index: number) {
		if (eventType === 'close') {
			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'select' || eventType === 'activate') {
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
				},
			};
			this.map.sendUnoCommand('.uno:SetHyperlink', command, true);
			this.map.fire('postMessage', {
				msgId: 'UI_Mention',
				args: { type: 'selected', username: this.itemList[index].username },
			});
			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'keydown') {
			if (object.key !== 'Tab' && object.key !== 'Shift') {
				this.map.focus();
				return true;
			}
		}
		return false;
	}
}
L.control.mention = function () {
	return new Mention();
};
