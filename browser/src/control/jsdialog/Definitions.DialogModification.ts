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
 * Definitions.DialogModification - dialog-specific customization callbacks
 */

declare var JSDialog: any;

type DialogModificationCallback = (instance: any) => void;

const dialogModifications = new Map<string, DialogModificationCallback>();

// Find & Replace Dialog keyboard handler
dialogModifications.set('FindReplaceDialog', function (instance: any) {
	if (!instance.container) return;

	instance.container.addEventListener('keydown', function (e: KeyboardEvent) {
		if (e.code !== 'Enter') return; // Only handle Enter key

		const activeElement = document.activeElement as HTMLElement;
		if (!activeElement) return;

		if (activeElement.tagName === 'INPUT') {
			const inputElement = activeElement as HTMLInputElement;
			if (inputElement.type === 'text') {
				const activeId = inputElement.id;
				let pushButtonWrapperId: string | null = null;

				if (activeId.includes('searchterm')) {
					pushButtonWrapperId = e.shiftKey ? 'backsearch' : 'search';
				} else if (activeId.includes('replaceterm')) {
					pushButtonWrapperId = 'replace';
				}

				if (pushButtonWrapperId) {
					const pushButtonWrapper = instance.container.querySelector(
						`#${pushButtonWrapperId}`,
					);
					/* Pushbutton wrapper always has a single child: button */
					const button = pushButtonWrapper
						? (pushButtonWrapper.firstChild as HTMLButtonElement)
						: null;
					if (button && !button.disabled) {
						button.click();
						e.preventDefault();
					}
				}
			} else if (inputElement.type === 'checkbox') {
				inputElement.click();
				e.preventDefault();
			}
		}
	});
});

JSDialog.getDialogModificationCallback = function (
	dialogId: string,
): DialogModificationCallback | undefined {
	return dialogModifications.get(dialogId);
};
