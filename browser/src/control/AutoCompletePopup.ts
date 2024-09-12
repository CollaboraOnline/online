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
 * AutoCompletePopup - base class for mention, formula auto complete, auto fill popup and auto fill preview popup
 */

/* global app */

interface Point {
	x: number;
	y: number;
}

interface FireEvent {
	data?: any;
}
interface CloseMessageEvent extends FireEvent {
	typingMention?: boolean;
}

abstract class AutoCompletePopup {
	protected map: ReturnType<typeof L.map>;
	protected newPopupData: PopupData;
	protected data: MessageEvent<any>;
	protected popupId: string;

	constructor(popupId: string, map: ReturnType<typeof L.map>) {
		this.map = map;
		this.popupId = popupId;
		this.newPopupData = {
			children: [
				{
					id: 'container',
					type: 'container',
					enabled: true,
					children: new Array<WidgetJSON>(),
					vertical: true,
				} as any as WidgetJSON,
			] as Array<WidgetJSON>,
			jsontype: 'dialog',
			type: 'modalpopup',
			cancellable: true,
			popupParent: '_POPOVER_',
			clickToClose: '_POPOVER_',
			id: this.popupId,
		} as PopupData;

		this.onAdd();

		this.map.on('closepopup', this.closePopup, this);
	}

	abstract onAdd(): void;

	getCurrentCursorPosition(): Point {
		var currPos = {
			x: app.file.textCursor.rectangle.cX1,
			y: app.file.textCursor.rectangle.cY2,
		};
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		return new L.Point(
			Math.round(currPos.x + panePos.x - origin.x),
			Math.round(currPos.y + panePos.y - origin.y),
		);
	}

	closePopup(): void {
		var popupExists = L.DomUtil.get(this.popupId);
		if (!popupExists) return;

		var closePopupData = {
			jsontype: 'dialog',
			type: 'modalpopup',
			action: 'close',
			id: this.popupId,
		} as PopupData;

		this.map.fire('jsdialog', { data: closePopupData, callback: undefined });
	}

	abstract getPopupEntries(ev: FireEvent): Array<TreeEntryJSON>;

	getPopupJSON(control: any, framePos: any): PopupData {
		return {
			jsontype: 'dialog',
			id: this.popupId,
			action: 'update',
			control: control,
			posx: framePos.x,
			posy: framePos.y,
			children: undefined,
		} as any as PopupData;
	}

	getTreeJSON(): TreeWidget {
		return {
			id: this.popupId + 'List',
			type: 'treelistbox',
			text: '',
			enabled: true,
			singleclickactivate: false,
			fireKeyEvents: true,
			entries: [] as Array<TreeEntryJSON>,
		} as TreeWidget;
	}

	getSimpleTextJSON(): TextWidget {
		return {
			id: this.popupId + 'fixedtext',
			type: 'fixedtext',
			text: 'no search results found!',
			enabled: true,
		} as TextWidget;
	}

	sendUpdate(data: any): void {
		this.map.fire('jsdialogupdate', {
			data: data,
			callback: this.callback.bind(this),
		});
	}

	sendJSON(data: any): void {
		this.map.fire('jsdialog', {
			data: data,
			callback: this.callback.bind(this),
		});
	}

	openMentionPopup(ev: FireEvent): void {
		const framePos = this.getCurrentCursorPosition();
		const entries = this.getPopupEntries(ev);
		let data: PopupData;

		if (entries.length > 0) {
			const control = this.getTreeJSON();
			// update the popup with list if mentionList already exist
			if (L.DomUtil.get(this.popupId + 'List')) {
				data = this.getPopupJSON(control, framePos);
				(data.control as TreeWidget).entries = entries;
				this.sendUpdate(data);
				return;
			}
			if (L.DomUtil.get(this.popupId))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = this.newPopupData;
			data.children[0].children[0] = control;
			(data.children[0].children[0] as TreeWidget).entries = entries;
		} else {
			const control = this.getSimpleTextJSON();
			if (L.DomUtil.get(this.popupId + 'fixedtext')) {
				data = this.getPopupJSON(control, framePos);
				this.sendUpdate(data);
				return;
			}
			if (L.DomUtil.get(this.popupId))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = this.newPopupData;
			data.children[0].children[0] = control;
		}
		// add position
		data.posx = framePos.x;
		data.posy = framePos.y;
		this.sendJSON(data);
	}

	closeMentionPopup(ev: CloseMessageEvent): void {
		this.closePopup();
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
	}

	callback(objectType: any, eventType: any, object: any, index: number) {
		if (eventType === 'keydown') {
			if (object.key !== 'Tab' && object.key !== 'Shift') {
				this.map.focus();
				return true;
			}
		}
		return false;
	}
}

L.Control.AutoCompletePopup = AutoCompletePopup;
