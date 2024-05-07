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
 * AutoCompletePopup - base class for mention, auto complete and auto fill popup
 */

/* global app */

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
	isAutoCompletePopup?: boolean;
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

	constructor(map: ReturnType<typeof L.map>) {
		this.map = map;
	}

	onAdd(id: string, bAutoComplete: boolean): void {
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
			isAutoCompletePopup: bAutoComplete,
			cancellable: true,
			popupParent: '_POPOVER_',
			clickToClose: '_POPOVER_',
			id: id,
		} as PopupData;
	}

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

	closePopup(id: string): void {
		var closePopupData = {
			jsontype: 'dialog',
			type: 'modalpopup',
			action: 'close',
			id: id,
		} as PopupData;

		this.map.fire('jsdialog', { data: closePopupData, callback: undefined });
	}

	abstract sendMentionText(ev: FireEvent): void;
	abstract openMentionPopup(ev: FireEvent): void;
	abstract callback(
		objectType: any,
		eventType: any,
		object: any,
		index: number,
	): void;
}

L.Control.AutoCompletePopup = AutoCompletePopup;
