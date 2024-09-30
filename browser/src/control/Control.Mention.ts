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

class Mention extends L.Control.AutoCompletePopup {
	map: ReturnType<typeof L.map>;
	newPopupData: PopupData;
	firstChar: string;
	users: any;
	itemList: Array<any>;
	data: MessageEvent<any>;

	constructor(map: ReturnType<typeof L.map>) {
		super('mentionPopup', map);
	}

	onAdd() {
		this.newPopupData.isAutoCompletePopup = true;
		this.map.on('openmentionpopup', this.openMentionPopup, this);
		this.map.on('closementionpopup', this.closeMentionPopup, this);
		this.map.on('sendmentiontext', this.sendMentionText, this);
		this.firstChar = null;
		this.users = null;
		this.itemList = null;
	}

	sendMentionText(ev: FireEvent) {
		const text = ev.data.join('').substring(1);
		if (text.length === 1 && this.firstChar !== text[0]) {
			this.map.fire('postMessage', {
				msgId: 'UI_Mention',
				args: { type: 'autocomplete', text: text },
			});
			this.firstChar = text[0];
		} else {
			this.openMentionPopup({ data: this.users, cursor: ev.cursor });
		}
	}

	getPopupEntries(ev: FireEvent): any[] {
		const entries: any[] = [];
		this.users = ev.data;
		if (this.users === null) return entries;

		const text = this.map._docLayer._mentionText.join('').substring(1);
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
		}

		return entries;
	}

	private sendHyperlinkUnoCommand(
		username: string,
		profile: string,
		replacement: string,
	) {
		var command = {
			'Hyperlink.Text': {
				type: 'string',
				value: '@' + username,
			},
			'Hyperlink.URL': {
				type: 'string',
				value: profile,
			},
			'Hyperlink.ReplacementText': {
				type: 'string',
				value: replacement,
			},
		};
		this.map.sendUnoCommand('.uno:SetHyperlink', command, true);
		this.map.fire('postMessage', {
			msgId: 'UI_Mention',
			args: { type: 'selected', username: username },
		});
	}

	callback(objectType: any, eventType: any, object: any, index: number) {
		if (eventType === 'close') {
			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'select' || eventType === 'activate') {
			const username = this.itemList[index].username;
			const profileLink = this.itemList[index].profile;
			const replacement = this.map._docLayer._mentionText.join('');

			var section = app.sectionContainer.getSectionWithName(
				L.CSections.CommentList.name,
			);
			if (
				section &&
				section.sectionProperties.selectedComment &&
				section.sectionProperties.selectedComment.isEdit()
			)
				section.sectionProperties.selectedComment.autoCompleteMention(
					username,
					profileLink,
					replacement,
				);
			else this.sendHyperlinkUnoCommand(username, profileLink, replacement);

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
L.control.mention = function (map: any) {
	return new Mention(map);
};
