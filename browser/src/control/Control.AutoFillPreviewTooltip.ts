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
 * Control.AutoFillPreviewTooltip - class for tooltip of cell previews during auto fill
 */

/* global app */

class AutoFillPreviewTooltip extends L.Control.AutoCompletePopup {
	usageText: string;
	newPopupData: PopupData;

	constructor(map: ReturnType<typeof L.map>) {
		super('autoFillPreviewTooltip', map);
		this.newPopupData = {
			children: [
				{
					id: 'container',
					type: 'container',
					enabled: false,
					children: new Array<WidgetJSON>(),
					vertical: false,
				} as any as WidgetJSON,
			] as Array<WidgetJSON>,
			jsontype: 'dialog',
			type: 'modalpopup',
			cancellable: false,
			popupParent: '_POPOVER_',
			clickToClose: '_POPOVER_',
			id: 'autoFillPreviewTooltip',
			canHaveFocus: false,
			noOverlay: true,
			title: '',
		} as PopupData;
	}

	onAdd() {
		this.newPopupData.isAutoCompletePopup = true;
		this.map.on('openautofillpopup', this.openAutoFillPopup, this);
		this.map.on('sendautofilllocation', this.sendAutoFillLocation, this);
	}

	getAutoFillAreaBottomRightLocation(ev: FireEvent): Point {
		var currPos = {
			x: app.calc.cellCursorRectangle.pX2 + ev.data.location.x,
			y: app.calc.cellCursorRectangle.pY2 + ev.data.location.y,
		};

		// console.error("--core   : " + JSON.stringify(ev.data.location));
		// console.error("--currPos: " + JSON.stringify(currPos));

		return new L.Point(currPos.x, currPos.y);
	}

	sendAutoFillLocation(ev: FireEvent) {
		this.openAutoFillPopup({ data: ev.data });
	}

	getSimpleTextJSON(cellValue: string): TextWidget {
		return {
			id: this.popupId + 'fixedtext',
			type: 'fixedtext',
			text: cellValue,
			enabled: false,
		} as TextWidget;
	}

	openAutoFillPopup(ev: FireEvent): void {
		const entry = ev.data.text;
		let data: PopupData;

		if (entry.length > 0) {
			this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);

			const control = this.getSimpleTextJSON(entry);
			if (L.DomUtil.get(this.popupId + 'fixedtext')) {
				data = this.getPopupJSON(control, {
					x: ev.data.location.cX,
					y: ev.data.location.cY,
				});
				this.sendUpdate(data);
				return;
			}

			if (L.DomUtil.get(this.popupId))
				this.closeMentionPopup({ typingMention: true } as CloseMessageEvent);
			data = Object.assign({}, this.newPopupData);
			data.children[0].children[0] = control;
		}

		// add position
		data.posx = ev.data.location.cX;
		data.posy = ev.data.location.cY;
		this.sendJSON(data);
	}
}
L.control.autofillpreviewtooltip = function (map: any) {
	return new AutoFillPreviewTooltip(map);
};
