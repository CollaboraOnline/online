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

type SnackbarData = {
	label: string;
	action: string | undefined;
	callback: () => void | undefined;
	timeout: number;
	hasProgress: boolean | undefined;
	withDismiss: boolean | undefined;
};

class SnackbarController {
	snackbarTimeout: number = 10000;
	snackbarQueue: Array<SnackbarData>;
	showingSnackbar: boolean = false;

	constructor() {
		this.snackbarQueue = new Array<SnackbarData>();
	}

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

		this.showingSnackbar = false;
		this.scheduleSnackbar();
	}

	public showSnackbar(
		label: string,
		action: string | undefined,
		callback: () => void | undefined,
		timeout: number | undefined,
		hasProgress: boolean | undefined,
		withDismiss: boolean | undefined,
	) {
		if (!app.socket) return;

		this.snackbarQueue.push({
			label: label,
			action: action,
			callback: callback,
			timeout: timeout,
			hasProgress: hasProgress,
			withDismiss: withDismiss,
		});

		this.scheduleSnackbar();
	}

	private extractTimeout(snackbarData: SnackbarData): number {
		return snackbarData.timeout || this.snackbarTimeout;
	}

	private scheduleSnackbar() {
		if (this.showingSnackbar || !this.snackbarQueue.length) return;

		const snackbarData = this.snackbarQueue.shift();
		this.showSnackbarImpl(snackbarData);
		this.showingSnackbar = true;
	}

	private showSnackbarImpl(snackbarData: SnackbarData) {
		var buttonId = 'button';
		var labelId = 'label';

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			timeout: this.extractTimeout(snackbarData),
			init_focus_id: snackbarData.action ? buttonId : undefined,
			children: [
				{
					id: snackbarData.hasProgress
						? 'snackbar-container-progress'
						: 'snackbar-container',
					type: 'container',
					children: [
						snackbarData.action
							? {
									id: labelId,
									type: 'fixedtext',
									text: snackbarData.label,
									labelFor: buttonId,
								}
							: {
									id: 'label-no-action',
									type: 'fixedtext',
									text: snackbarData.label,
								},
						snackbarData.withDismiss
							? {
									id: 'snackbar-dismiss-button',
									type: 'pushbutton',
									text: _('Dismiss'),
								}
							: {},
						snackbarData.hasProgress
							? { id: 'progress', type: 'progressbar', value: 0, maxValue: 100 }
							: {},
						snackbarData.action
							? {
									id: buttonId,
									type: 'pushbutton',
									text: snackbarData.action,
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
				if (typeof snackbarData.callback === 'function')
					snackbarData.callback();

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
