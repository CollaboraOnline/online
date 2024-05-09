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
 * Control.FormulaUsagePopup
 */

/* global app */

class FormulaUsagePopup extends L.Control.AutoCompletePopup {
	usageText: string;
	newPopupData: PopupData;

	constructor(map: ReturnType<typeof L.map>) {
        super('formulausagePopup', map);
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
            type: 'dialog',
            cancellable: true,
            popupParent: '',
            clickToClose: '',
            id: 'formulausagePopup',
            title: '',
        } as PopupData;

    }

	onAdd() {
        this.newPopupData.isAutoCompletePopup = true;
        this.map.on('openformulausagepopup', this.openFormulaUsagePopup, this);
        this.map.on('closeformulausagepopup', this.closePopup, this);
        this.map.on('sendformulausagetext', this.sendFormulaUsageText, this);
    }

	openFormulaUsagePopup(ev: FireEvent) {
		this.openMentionPopup({ data: ev });
		this.map.focus();
	}

	sendFormulaUsageText(ev: FireEvent) {
		this.openFormulaUsagePopup(ev);
	}

	getPopupEntries(ev: FireEvent): any[] {
		this.usageText = ev.data.data;
		var chIndex = this.usageText.indexOf(':');
		var functionUsage = this.usageText.substring(0, chIndex);
		var usageDescription = this.usageText.substring(chIndex + 1);
		const entries =
		[
			{ row: 0, columns: [ { text: functionUsage }], collapsed: false ,
				children: [
					{ row: 1, columns: [ { text: usageDescription } ]}
				]
			}
		];

        return entries;
    }

	callback(objectType: any, eventType: any, object: any, index: number) {
        if (eventType === 'close') {
            this.closePopup();
        }
        return false;
    }
}

L.control.formulausage = function (map: any) {
    return new FormulaUsagePopup(map);
};

