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
 * ServerAuditDialog - Dialog for admin users showing checklist of server security settings
 */

declare var JSDialog: any;

class ServerAuditDialog {
	map: any;
	id: string = 'ServerAuditDialog';
	errorCodes: any;

	constructor(map: any) {
		this.map = map;
		this.map.on('receivedserveraudit', this.onServerAudit.bind(this), this);

		this.errorCodes = {
			is_admin: {
				missing: [
					_('The is_admin user property is not set'),
					'SDK: userextrainfo',
					'https://sdk.collaboraonline.com/docs/advanced_integration.html?highlight=userprivateinfo#userextrainfo',
				],
				ok: [_('The is_admin user property is set'), '', ''],
			},
		};
	}

	public open() {
		const entries = this.getEntries();
		const dialogBuildEvent = {
			data: this.getJSON(entries),
			callback: this.callback.bind(this) as JSDialogCallback,
		};

		this.map.fire(
			window.mode.isMobile() ? 'mobilewizard' : 'jsdialog',
			dialogBuildEvent,
		);
	}

	private getEntries(): Array<TreeEntryJSON> {
		const entries = new Array<TreeEntryJSON>();

		if (!app.serverAudit) return entries;

		const errorIcon = { collapsed: 'serverauditerror.svg' };
		const okIcon = { collapsed: 'serverauditok.svg' };

		app.serverAudit.forEach((entry: any) => {
			const found = this.errorCodes[entry.code];
			if (found) {
				const status = found[entry.status];
				if (status) {
					entries.push({
						row: 0,
						columns: [
							entry.status === 'ok' ? okIcon : errorIcon,
							{ text: status[0] },
							status[1] && status[2]
								? {
										text: status[1],
										link: status[2],
									}
								: { text: '' },
						],
					} as TreeEntryJSON);
				}
			} else {
				console.warn('Unknown server audit entry: ' + entry.code);
			}
		});

		return entries;
	}

	private getJSON(entries: Array<any>): JSDialogJSON {
		let hasErrors = false;
		app.serverAudit.forEach((entry: any) => {
			if (entry.status !== 'ok') {
				hasErrors = true;
			}
		});

		return {
			id: this.id,
			dialogid: this.id,
			type: 'dialog',
			text: _('Server audit'),
			title: _('Server audit'),
			jsontype: 'dialog',
			responses: [
				{
					id: 'ok',
					response: 1,
				},
			],
			children: [
				{
					id: this.id + '-mainbox',
					type: 'container',
					vertical: true,
					children: [
						!hasErrors
							? {
									id: 'auditsuccess',
									type: 'fixedtext',
									text: _('No issues found'),
								}
							: {},
						{
							id: 'auditlist',
							type: 'treelistbox',
							headers: [/* icon */ { text: _('Status') }, { text: _('Help') }],
							entries: entries,
							enabled: entries.length > 0,
						},
						{
							id: this.id + '-buttonbox',
							type: 'buttonbox',
							children: [
								{
									id: 'ok',
									type: 'pushbutton',
									text: _('OK'),
								},
							],
							layoutstyle: 'end',
						},
					],
				},
			],
		} as any as JSDialogJSON;
	}

	public close() {
		const closeEvent = {
			data: {
				action: 'close',
				id: this.id,
			},
		};
		this.map.fire(
			window.mode.isMobile() ? 'closemobilewizard' : 'jsdialog',
			closeEvent,
		);
	}

	private onServerAudit() {
		var docLayer = this.map._docLayer || {};
		var viewInfo = this.map._viewInfo
			? this.map._viewInfo[docLayer._viewId]
			: null;

		if (app.serverAudit.length) {
			// TODO: enable annoying snackbar later
			if (viewInfo && viewInfo.userextrainfo.is_admin === true) {
				this.map.uiManager.showSnackbar(
					_('Check security warnings of your server'),
					_('OPEN'),
					this.open.bind(this),
				);
			}

			this.map.uiManager.refreshUI();
		}
	}

	private callback(
		objectType: string,
		eventType: string,
		object: any,
		data: any,
		builder: any,
	) {
		if (eventType === 'response' || object.id === 'ok') this.close();
	}
}

JSDialog.serverAuditDialog = (map: any) => {
	return new ServerAuditDialog(map);
};
