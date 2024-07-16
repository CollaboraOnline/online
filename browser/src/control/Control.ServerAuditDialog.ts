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

interface AuditEntry {
	code: string;
	status: string;
}
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
					_('The IsAdminUser property is not set by integration'),
					'SDK: IsAdminUser',
					'https://sdk.collaboraonline.com/docs/advanced_integration.html?highlight=IsAdminUser#isadminuser',
				],
				deprecated: [
					_(
						'Used deprecated is_admin field, integration should use IsAdminUser property instead',
					),
					'SDK: IsAdminUser',
					'https://sdk.collaboraonline.com/docs/advanced_integration.html?highlight=IsAdminUser#isadminuser',
				],
				ok: [_('The IsAdminUser user property is set by integration'), '', ''],
			},
			certwarning: {
				sslverifyfail: [
					_('Your WOPI server is not secure: SSL verification failed'),
					'SDK: ssl-configuration',
					'https://sdk.collaboraonline.com/docs/installation/Configuration.html?highlight=ssl#ssl-configuration',
				],
				ok: [_('No problems with SSL verification detected'), '', ''],
			},
			postmessage: {
				ok: [_('PostMessage API is initialized'), '', ''],
				hostnotready: [
					_('Integrator is not ready for PostMessage calls'),
					'SDK: post-message-initialization',
					'https://sdk.collaboraonline.com/docs/postmessage_api.html#initialization',
				],
			},
		};
	}

	private performClientAudit(): Array<AuditEntry> {
		const entries = new Array<AuditEntry>();
		return entries;
	}

	public open() {
		const serverEntries = this.getEntries(app.serverAudit);
		const clientEntries = this.getEntries(this.performClientAudit());

		const dialogBuildEvent = {
			data: this.getJSON(serverEntries.concat(clientEntries)),
			callback: this.callback.bind(this) as JSDialogCallback,
		};

		this.map.fire(
			window.mode.isMobile() ? 'mobilewizard' : 'jsdialog',
			dialogBuildEvent,
		);
	}

	private getEntries(source: any): Array<TreeEntryJSON> {
		const entries = new Array<TreeEntryJSON>();

		if (!source) return entries;

		const errorIcon = { collapsed: 'serverauditerror.svg' };
		const okIcon = { collapsed: 'serverauditok.svg' };

		source.forEach((entry: AuditEntry) => {
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

	private hasErrors(): boolean {
		let hasErrors = false;
		if (app.serverAudit) {
			app.serverAudit.forEach((entry: any) => {
				if (entry.status !== 'ok') {
					hasErrors = true;
				}
			});
		}

		if (app.clientAudit) {
			app.clientAudit.forEach((entry: any) => {
				if (entry.status !== 'ok') {
					hasErrors = true;
				}
			});
		}

		return hasErrors;
	}

	private getJSON(entries: Array<any>): JSDialogJSON {
		const hasErrors = this.hasErrors();

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
		if (app.serverAudit.length) {
			let hasErrors = false;
			app.serverAudit.forEach((entry: any) => {
				if (entry.status !== 'ok') {
					hasErrors = true;
				}
			});

			// only show the snackbar if there are specific warnings
			// and if the current view isadminuser
			if (hasErrors && app.isAdminUser) {
				this.map.uiManager.showSnackbar(
					_('Check security warnings of your server'),
					_('OPEN'),
					this.open.bind(this),
				);
			}

			// but if we any results, enable the toolbar entry for the server audit
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
