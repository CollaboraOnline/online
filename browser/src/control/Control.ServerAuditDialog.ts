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

	constructor(map: any) {
		this.map = map;
		this.map.on('receivedserveraudit', this.onServerAudit.bind(this), this);
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

		const errorIcon = { collapsed: 'serveraudit.svg' };

		app.serverAudit.forEach(function (entry: any) {
			switch (entry.code) {
				case 'is_admin': {
					if (entry.status === '0') {
						entries.push({
							row: 0,
							columns: [
								errorIcon,
								{ text: _('Admin user property not set') },
								{
									text: 'SDK: userextrainfo',
									link: 'https://sdk.collaboraonline.com/docs/advanced_integration.html?highlight=userprivateinfo#userextrainfo',
								},
							],
						} as TreeEntryJSON);
					}
					break;
				}
			}
		});

		return entries;
	}

	private getJSON(entries: Array<any>): JSDialogJSON {
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
						entries.length
							? {
									id: 'auditlist',
									type: 'treelistbox',
									headers: [
										/* icon */ { text: _('Status') },
										{ text: _('Help') },
									],
									entries: entries,
								}
							: {
									id: 'auditsuccess',
									type: 'fixedtext',
									text: _('No issues found'),
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
			this.map.uiManager.showSnackbar(
				_('Check security warnings of your server'),
				_('OPEN'),
				this.open.bind(this),
			);
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
