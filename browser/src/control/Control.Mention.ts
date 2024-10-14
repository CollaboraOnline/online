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

	sendMentionText(ev: MentionEvent) {
		const text = ev.data.join('').substring(1);
		if (text.length === 1 && this.firstChar !== text[0]) {
			this.map.fire('postMessage', {
				msgId: 'UI_Mention',
				args: { type: 'autocomplete', text: text },
			});
			this.firstChar = text[0];
		} else {
			this.openMentionPopup({
				data: this.users,
				triggerKey: ev.triggerKey,
			} as MentionEvent);
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

	private openMentionPopup(ev: MentionEvent): void {
		const entries = this.getPopupEntries(ev);
		const commentSection = app.sectionContainer.getSectionWithName(
			L.CSections.CommentList.name,
		);
		if (
			entries.length === 0 &&
			this.isMobile &&
			commentSection?.isMobileCommentActive()
		) {
			const control = this.getTreeJSON();
			const data = this.getPopupJSON(control, { x: 0, y: 0 });
			if (commentSection?.isMobileCommentActive()) {
				data.id = 'modal-dialog-new-annotation-dialog';
			}
			(data.control as TreeWidget).entries = [];
			this.sendUpdate(data);
			return;
		}

		const cursorPos = this.getCursorPosition();
		if (entries.length === 0) {
			// If the key pressed was a space, and there are no matches, then just
			// dismiss the popup.
			// const noMatchOnFinalSpace: boolean = ev.triggerKey === ' ';
			const noMatchOnFinalSpace = ev.triggerKey === ' ';
			if (noMatchOnFinalSpace) {
				this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
				return;
			}
			const control = this.getSimpleTextJSON();
			if (L.DomUtil.get(this.popupId + 'fixedtext')) {
				const data = this.getPopupJSON(control, cursorPos);
				this.sendUpdate(data);
				return;
			}
			if (L.DomUtil.get(this.popupId))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			const data = this.newPopupData;
			data.children[0].children[0] = control;
			data.posx = cursorPos.x;
			data.posy = cursorPos.y;
			this.sendJSON(data);
			return;
		}

		const control = this.getTreeJSON();
		if (L.DomUtil.get(this.popupId + 'List')) {
			const data = this.getPopupJSON(control, cursorPos);
			if (commentSection?.isMobileCommentActive())
				data.id = 'modal-dialog-new-annotation-dialog';
			(data.control as TreeWidget).entries = entries;
			this.sendUpdate(data);
			return;
		}

		if (L.DomUtil.get(this.popupId))
			this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
		const data = this.newPopupData;
		data.children[0].children[0] = control;
		(data.children[0].children[0] as TreeWidget).entries = entries;
		data.posx = cursorPos.x;
		data.posy = cursorPos.y;
		this.sendJSON(data);
	}

	private getSimpleTextJSON(): TextWidget {
		return {
			id: this.popupId + 'fixedtext',
			type: 'fixedtext',
			text: 'no search results found!',
			enabled: true,
		} as TextWidget;
	}

	private closeMentionPopup(ev: CloseMessageEvent): void {
		var popupExists =
			L.DomUtil.get(this.popupId) || L.DomUtil.get(this.popupId + 'List');
		if (!popupExists) return;

		this.map.jsdialog.focusToLastElement(this.popupId);
		if (this.isMobile) {
			const commentSection = app.sectionContainer.getSectionWithName(
				L.CSections.CommentList.name,
			);

			if (commentSection?.isMobileCommentActive()) {
				const control = this.getTreeJSON();
				const data = this.getPopupJSON(control, { x: 0, y: 0 });
				if (commentSection?.isMobileCommentActive()) {
					data.id = 'modal-dialog-new-annotation-dialog';
				}
				(data.control as TreeWidget).entries = [];
				this.sendUpdate(data);
			} else {
				this.map.fire('closemobilewizard');
			}
		} else this.map.jsdialog.clearDialog(this.popupId);
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
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
		const commentSection = app.sectionContainer.getSectionWithName(
			L.CSections.CommentList.name,
		);
		const comment = commentSection?.getActiveEdit();
		if (eventType === 'close') {
			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'select' || eventType === 'activate') {
			const username = this.itemList[index].username;
			const profileLink = this.itemList[index].profile;
			const replacement = this.map._docLayer._mentionText.join('');

			if (comment)
				comment.autoCompleteMention(username, profileLink, replacement);
			else this.sendHyperlinkUnoCommand(username, profileLink, replacement);

			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'keydown') {
			if (object.key !== 'Tab' && object.key !== 'Shift') {
				if (comment) comment.focus();
				else this.map.focus();
				return true;
			}
		}
		return false;
	}
}
L.control.mention = function (map: any) {
	return new Mention(map);
};
