/* -*- tab-width: 4 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class NextEffectEventArray {
	aEventArray: EventBase[] = [];

	size() {
		return this.aEventArray.length;
	}

	at(nIndex: number) {
		return this.aEventArray[nIndex];
	}

	appendEvent(aEvent: EventBase) {
		const nSize = this.size();
		for (let i = 0; i < nSize; ++i) {
			if (this.aEventArray[i].getId() == aEvent.getId()) {
				aNextEffectEventArrayDebugPrinter.print(
					'NextEffectEventArray.appendEvent: event(' +
						aEvent.getId() +
						') already present',
				);
				return false;
			}
		}
		this.aEventArray.push(aEvent);
		aNextEffectEventArrayDebugPrinter.print(
			'NextEffectEventArray.appendEvent: event(' +
				aEvent.getId() +
				') appended',
		);
		return true;
	}

	clear() {
		this.aEventArray = [];
	}
}
