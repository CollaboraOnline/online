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

interface MentionUserData {
	username: string;
	profile: string;
}

class Mention extends L.Control.AutoCompletePopup {
	map: ReturnType<typeof L.map>;
	newPopupData: PopupData;
	users: Array<MentionUserData>;
	filteredUsers: Array<MentionUserData>;
	data: MessageEvent<any>;
	debouceTimeoutId: NodeJS.Timeout;
	lastTriggerKey: string;
	partialMention: Array<string>;
	typingMention: boolean;

	constructor(map: ReturnType<typeof L.map>) {
		super('mentionPopup', map);
	}

	onAdd() {
		this.newPopupData.isAutoCompletePopup = true;
		this.typingMention = false;
		this.partialMention = [];
		this.lastTriggerKey = '';
	}

	sendMentionPostMsg(partialText: string) {
		if (this.debouceTimeoutId) clearTimeout(this.debouceTimeoutId);

		// happens when user deletes last character before '@'
		// if we send empty string to the WOPIHost. They might return us list
		// with thousand of users
		if (partialText === '') {
			this.closeMentionPopup(true);
			return;
		}

		this.debouceTimeoutId = setTimeout(() => {
			this.map.fire('postMessage', {
				msgId: 'UI_Mention',
				args: { type: 'autocomplete', text: partialText },
			});
		}, 300);
	}

	getPopupEntries(users: Array<MentionUserData>): any[] {
		const entries: Array<TreeEntryJSON> = [];
		if (users === null) return entries;

		const text = this.getPartialMention();

		// filterout the users from list according to the text
		if (text.length > 1) {
			this.filteredUsers = users.filter((element: any) => {
				// case insensitive
				return element.username.toLowerCase().includes(text.toLowerCase());
			});
		} else {
			this.filteredUsers = users;
		}

		if (this.filteredUsers.length !== 0) {
			for (const i in this.filteredUsers) {
				const entry = {
					text: this.filteredUsers[i].username,
					columns: [
						{
							text: this.filteredUsers[i].username,
						},
					],
					row: i.toString(),
				} as TreeEntryJSON;
				entries.push(entry);
			}
		}
		return entries;
	}

	openMentionPopup(users: Array<MentionUserData>) {
		if (!this.typingMention) return;

		const entries = this.getPopupEntries(users);
		const commentSection = app.sectionContainer.getSectionWithName(
			L.CSections.CommentList.name,
		);

		const isMobileCommentActive = commentSection?.isMobileCommentActive();
		const mobileCommentModalId = commentSection?.getMobileCommentModalId();
		if (entries.length === 0 && this.isMobile && isMobileCommentActive) {
			const control = this.getTreeJSON();
			control.hideIfEmpty = true;
			const data = this.getPopupJSON(control, { x: 0, y: 0 });
			data.id = mobileCommentModalId;
			(data.control as TreeWidget).entries = [];
			this.sendUpdate(data);
			return;
		}

		const cursorPos = this.getCursorPosition();
		if (entries.length === 0) {
			// If the key pressed was a space, and there are no matches, then just
			// dismiss the popup.
			// const noMatchOnFinalSpace: boolean = ev.triggerKey === ' ';
			const noMatchOnFinalSpace = this.lastTriggerKey === ' ';
			if (noMatchOnFinalSpace) {
				this.closeMentionPopup(false);
				return;
			}
			const control = this.getSimpleTextJSON();
			if (L.DomUtil.get(this.popupId + 'fixedtext')) {
				const data = this.getPopupJSON(control, cursorPos);
				this.sendUpdate(data);
				return;
			}
			if (L.DomUtil.get(this.popupId)) this.closeMentionPopup(true);
			const data = this.newPopupData;
			data.children[0].children[0] = control;
			data.posx = cursorPos.x;
			data.posy = cursorPos.y;
			this.sendJSON(data);
			return;
		}

		const control = this.getTreeJSON();
		if (isMobileCommentActive) control.hideIfEmpty = true;
		if (L.DomUtil.get(this.popupId + 'List')) {
			const data = this.getPopupJSON(control, cursorPos);
			if (isMobileCommentActive) data.id = mobileCommentModalId;
			(data.control as TreeWidget).entries = entries;
			this.sendUpdate(data);
			return;
		}

		if (L.DomUtil.get(this.popupId)) this.closeMentionPopup(true);
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
			text: _('No search results found!'),
			enabled: true,
		} as TextWidget;
	}

	closeMentionPopup(typingMention: boolean): void {
		this.typingMention = typingMention;
		if (!typingMention) this.partialMention = [];

		const mentionPopup =
			L.DomUtil.get(this.popupId) ||
			L.DomUtil.get(this.popupId + 'List') ||
			L.DomUtil.get(this.popupId + 'fixedtext');
		if (!mentionPopup) return;

		this.map.jsdialog.focusToLastElement(this.popupId);
		if (this.isMobile) {
			const commentSection = app.sectionContainer.getSectionWithName(
				L.CSections.CommentList.name,
			);
			const isMobileCommentActive = commentSection?.isMobileCommentActive();
			const mobileCommentModalId = commentSection?.getMobileCommentModalId();

			if (isMobileCommentActive) {
				const control = this.getTreeJSON();
				control.hideIfEmpty = true;
				const data = this.getPopupJSON(control, { x: 0, y: 0 });
				data.id = mobileCommentModalId;
				(data.control as TreeWidget).entries = [];
				this.sendUpdate(data);
			} else {
				this.map.fire('closemobilewizard');
			}
		} else this.map.jsdialog.clearDialog(this.popupId);
	}

	// get partialMention excluding '@'
	getPartialMention(): string {
		return this.partialMention.join('').substring(1);
	}

	isTypingMention(): boolean {
		return this.typingMention;
	}

	handleMentionInput(ev: any) {
		if (this.map.getDocType() === 'text' && !this.typingMention) {
			if (ev.data === '@') {
				this.partialMention.push(ev.data);
				this.typingMention = true;
			}
			return;
		}

		const deleteEvent =
			ev.inputType === 'deleteContentBackward' ||
			ev.inputType === 'deleteContentForward';
		if (deleteEvent) {
			const ch = this.partialMention.pop();
			if (ch === '@') this.closeMentionPopup(false);
			else this.sendMentionPostMsg(this.getPartialMention());
			return;
		}

		if (ev.data === '@' && this.partialMention.length === 1) {
			return;
		}

		const regEx = /^[0-9a-zA-Z ]+$/;
		if (ev.data && ev.data.match(regEx)) {
			this.partialMention.push(ev.data);
			this.lastTriggerKey = ev.data;
			this.sendMentionPostMsg(this.getPartialMention());
		} else {
			this.closeMentionPopup(false);
		}
	}

	getMentionUserData(index: number): MentionUserData {
		if (index >= this.filteredUsers.length)
			return { username: '', profile: '' } as MentionUserData;
		return this.filteredUsers[index];
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
			this.closeMentionPopup(false);
		} else if (eventType === 'select' || eventType === 'activate') {
			const username = this.filteredUsers[index].username;
			const profileLink = this.filteredUsers[index].profile;
			const replacement = '@' + this.getPartialMention();

			if (comment)
				comment.autoCompleteMention(username, profileLink, replacement);
			else this.sendHyperlinkUnoCommand(username, profileLink, replacement);
			this.closeMentionPopup(false);
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
