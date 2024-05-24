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
 * Util.SnackbarController - helper for managing the snackbars queue
 */

declare var JSDialog: any;

class SnackbarController {
	public closeSnackbar() {
		var closeMessage = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			action: 'close',
		};
		app.socket._onMessage({
			textMsg: 'jsdialog: ' + JSON.stringify(closeMessage),
		});
	}

	public showSnackbar(
		label: string,
		action: string,
		callback: () => void,
		timeout: number,
		hasProgress: boolean,
		withDismiss: boolean,
	) {
		if (!app.socket) return;

		this.closeSnackbar();

		var buttonId = 'button';
		var labelId = 'label';

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			timeout: timeout,
			init_focus_id: action ? buttonId : undefined,
			children: [
				{
					id: hasProgress
						? 'snackbar-container-progress'
						: 'snackbar-container',
					type: 'container',
					children: [
						action
							? {
									id: labelId,
									type: 'fixedtext',
									text: label,
									labelFor: buttonId,
								}
							: { id: 'label-no-action', type: 'fixedtext', text: label },
						withDismiss
							? {
									id: 'snackbar-dismiss-button',
									type: 'pushbutton',
									text: _('Dismiss'),
								}
							: {},
						hasProgress
							? { id: 'progress', type: 'progressbar', value: 0, maxValue: 100 }
							: {},
						action
							? {
									id: buttonId,
									type: 'pushbutton',
									text: action,
									labelledBy: labelId,
								}
							: {},
					],
				},
			],
		};

		var builderCallback: JSDialogCallback = (
			objectType: string,
			eventType: string,
			object: any,
			data: any,
			builder: any,
		) => {
			window.app.console.debug(
				"control: '" +
					objectType +
					"' id:'" +
					object.id +
					"' event: '" +
					eventType +
					"' state: '" +
					data +
					"'",
			);

			if (
				object.id === buttonId &&
				objectType === 'pushbutton' &&
				eventType === 'click'
			) {
				if (callback) callback();

				this.closeSnackbar();
			} else if (
				object.id === '__POPOVER__' &&
				objectType === 'popover' &&
				eventType === 'close'
			) {
				this.closeSnackbar();
			}

			if (
				object.id === 'snackbar-dismiss-button' &&
				objectType === 'pushbutton' &&
				eventType === 'click'
			) {
				this.closeSnackbar();
			}
		};

		app.socket._onMessage({
			textMsg: 'jsdialog: ' + JSON.stringify(json),
			callback: builderCallback,
		});
	}

	// value should be in range 0-100
	public setSnackbarProgress(value: number) {
		if (!app.socket) return;

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			action: 'update',
			control: {
				id: 'progress',
				type: 'progressbar',
				value: value,
				maxValue: 100,
			},
		};

		app.socket._onMessage({ textMsg: 'jsdialog: ' + JSON.stringify(json) });
	}
}

JSDialog.SnackbarController = new SnackbarController();
