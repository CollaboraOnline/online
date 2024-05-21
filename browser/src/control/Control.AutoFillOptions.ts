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
 * Control.AutoFillOptions - class for auto fill popup
 */

/* global app */

class AutoFillOptions extends L.Control.AutoCompletePopup {
	map: ReturnType<typeof L.map>;
	newPopupData: PopupData;
	firstChar: string;
	users: any;
	itemList: Array<any>;
	data: MessageEvent<any>;

	constructor(map: ReturnType<typeof L.map>) {
		super('autoFillPopup', map);
	}

	onAdd() {
		this.newPopupData.isAutoCompletePopup = true;
		this.map.on('openautofillpopup', this.openAutoFillPopup, this);
		this.map.on('closeautofillpopup', this.closeMentionPopup, this);
		this.map.on('sendautofilllocation', this.sendAutoFillLocation, this);
		this.firstChar = null;
		this.users = null;
		this.itemList = null;
	}

	getAutoFillRectanglePosition(ev: FireEvent): Point {
		var currPos = ev.data;
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		return new L.Point(
			Math.round(currPos.x + panePos.x - origin.x),
			Math.round(currPos.y + panePos.y - origin.y),
		);
	}

	sendAutoFillLocation(ev: FireEvent) {
		this.openAutoFillPopup({ data: ev.data });
	}

	getPopupEntries(): any[] {
		const entries: any[] = [{ text: 'copy', columns: [{ text: 'Copy cells' }], row: '0' },
		{ text: 'fill', columns: [{ text: 'Fill series' }], row: '1' }];
		return entries;
	}

	openAutoFillPopup(ev: FireEvent): void {
		const framePos = this.getAutoFillRectanglePosition(ev); // bottom-right position
		const entries = this.getPopupEntries();
		let data: PopupData;

		if (entries.length > 0) {
			const control = this.getTreeJSON();

			if (L.DomUtil.get(this.popupId))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = this.newPopupData;
			data.children[0].children[0] = control;
			(data.children[0].children[0] as TreeWidget).entries = entries;
		}

		// add position
		data.posx = framePos.x;
		data.posy = framePos.y;
		this.sendJSON(data);
	}

	closeMentionPopup(ev: CloseMessageEvent) {
		this.map._docLayer.isAutoFillFromOnMouseUp = false;
		super.closePopup();
		if (!ev.typingMention) {
			this.map._docLayer._typingMention = false;
			this.map._docLayer._mentionText = [];
		}
	}

	callback(objectType: any, eventType: any, object: any, index: number) {
		this.map._docLayer.isAutoFillFromOnMouseUp = false;

		if (eventType === 'close') {
			this.closeMentionPopup({ typingMention: false } as CloseMessageEvent);
		} else if (eventType === 'select' || eventType === 'activate') {
			this.map.fire('closeautofillpopup');

			if (index == 0) {
				/*
					- Copy cells
					undo needed here, "Copy cells" should operate on the original content,
					not the new content of the cells.
				*/
				this.map.sendUnoCommand('.uno:Undo');
				this.map.sendUnoCommand('.uno:AutoFill?Copy:bool=true');
			} else if (index == 1) {
				/*
					- Fill series
					undo needed here, "Fill series" should operate on the original content,
					not the new content of the cells.
				*/
				this.map.sendUnoCommand('.uno:Undo');
				this.map.sendUnoCommand('.uno:AutoFill?Copy:bool=false');
			}

		} else if (eventType === 'keydown') {
			if (object.key !== 'Tab' && object.key !== 'Shift') {
				this.map.focus();
				return true;
			}
		}
		return false;
	}
}
L.control.autofilloptions = function (map: any) {
	return new AutoFillOptions(map);
};
