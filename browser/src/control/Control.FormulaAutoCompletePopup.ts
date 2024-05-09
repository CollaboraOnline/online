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
 * Control.FormulaAutoCompletePopup
 */

/* global app */

class FormulaAutoCompletePopup extends L.Control.AutoCompletePopup {
	functionList: Array<any>;

    constructor(map: ReturnType<typeof L.map>) {
        super('formulaautocompletePopup', map);
    }

    onAdd() {
        this.newPopupData.isAutoCompletePopup = true;
        this.map.on('openformulaautocompletepopup', this.openFormulaAutoCompletePopup, this);
        this.map.on('closeformulapopup', this.closePopup, this);
		this.map.on('sendformulatext', this.sendFormulaText, this);
		this.functionList = null;
    }

	openFormulaAutoCompletePopup(ev: FireEvent) {
		var formulaUsagePopup = L.DomUtil.get('formulausagePopup');
		if (formulaUsagePopup)
			this.map.fire('closeformulausagepopup');
		this.openMentionPopup({ data: ev });
	}

	sendFormulaText(ev: FireEvent) {
		this.openFormulaAutoCompletePopup(ev);
    }

    getPopupEntries(ev: FireEvent): any[] {
        const entries: any[] = [];
		this.functionList = ev.data.data;
		if (this.functionList.length !== 0) {
			for (var i in this.functionList) {
				var entry = {
					text: this.functionList[i].name,
					columns: [
						{ text: this.functionList[i].name },
						{ text: '\n' + this.functionList[i].description }
					],
					row: i.toString()
				};
				entries.push(entry);
			}
		}
        return entries;
    }

    callback(objectType: any, eventType: any, object: any, index: number) {
        if (eventType === 'close') {
            this.closePopup();
        } else if (eventType === 'select' || eventType === 'activate') {
			var currentText = this.map._docLayer._lastFormula;
			var chIndex = currentText.length - 1;
			var functionName = this.functionList[index].name;
			functionName = functionName.substring(chIndex);
			this.map._textInput._sendText(functionName + '(');
            this.closePopup();
        } else if (eventType === 'keydown') {
            if (object.key !== 'Tab' && object.key !== 'Shift') {
                this.map.focus();
                return true;
            }
        }
        return false;
    }
}

L.control.formulaautocomplete = function (map: any) {
    return new FormulaAutoCompletePopup(map);
};
