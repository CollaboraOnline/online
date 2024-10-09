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
	}

	onAdd() {
		this.newPopupData.isAutoFillPreviewTooltip = true;
		this.newPopupData.canHaveFocus = false;
		this.newPopupData.noOverlay = true;
		this.newPopupData.id = 'autoFillPreviewTooltip';

		this.map.on(
			'openautofillpreviewpopup',
			this.openAutoFillPreviewPopup,
			this,
		);
		this.map.on(
			'closeautofillpreviewpopup',
			this.closeAutoFillPreviewPopup,
			this,
		);
	}

	getSimpleTextJSON(cellValue: string): TextWidget {
		return {
			id: this.popupId + 'fixedtext',
			type: 'fixedtext',
			text: cellValue,
			enabled: false,
		} as TextWidget;
	}

	openAutoFillPreviewPopup(ev: FireEvent): void {
		// calculate the popup position
		var cellRange = this.map._docLayer._parseCellRange(
			JSON.stringify(ev.data.celladdress),
		);
		ev.data.celladdress = this.map._docLayer
			._cellRangeToTwipRect(cellRange)
			.toRectangle();

		ev.data.celladdress = new app.definitions.simplePoint(
			parseInt(ev.data.celladdress[0]),
			parseInt(ev.data.celladdress[1]),
		);
		ev.data.celladdress.pX -=
			app.sectionContainer.getDocumentTopLeft()[0] -
			app.sectionContainer.getDocumentAnchor()[0];
		ev.data.celladdress.pY -=
			app.sectionContainer.getDocumentTopLeft()[1] -
			app.sectionContainer.getDocumentAnchor()[1];

		const entry = ev.data.text;
		let data: PopupData;

		if (entry.length > 0) {
			this.closeAutoFillPreviewPopup();
			const control = this.getSimpleTextJSON(entry);
			if (L.DomUtil.get(this.popupId + 'fixedtext')) {
				data = this.getPopupJSON(control, {
					x: ev.data.celladdress.cX,
					y: ev.data.celladdress.cY,
				});
				this.sendUpdate(data);
				return;
			}

			if (L.DomUtil.get(this.popupId)) this.closeAutoFillPreviewPopup();
			data = Object.assign({}, this.newPopupData);
			data.children[0].children[0] = control;
		}

		// add position
		data.posx = ev.data.celladdress.cX;
		data.posy = ev.data.celladdress.cY;
		this.sendJSON(data);
	}

	closeAutoFillPreviewPopup(): void {
		super.closePopup();
	}
}
L.control.autofillpreviewtooltip = function (map: any) {
	return new AutoFillPreviewTooltip(map);
};
