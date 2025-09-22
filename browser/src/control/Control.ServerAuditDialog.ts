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
 * ServerAuditDialog - Dialog for admin users showing checklist of server security settings
 */

declare var JSDialog: any;

interface AuditEntry {
	code: string;
	status: string;
}

class ClientAuditor {
	private static checkPostMessages(entries: Array<AuditEntry>) {
		if ((window as any).WOPIPostmessageReady)
			entries.push({ code: 'postmessage', status: 'ok' });
		else entries.push({ code: 'postmessage', status: 'hostnotready' });
	}

	public static performClientAudit(): Array<AuditEntry> {
		const entries = new Array<AuditEntry>();
		ClientAuditor.checkPostMessages(entries);
		return entries;
	}
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
				ok: [
					_('The IsAdminUser user property is set by integration'),
					'SDK: IsAdminUser',
					'https://sdk.collaboraonline.com/docs/advanced_integration.html?highlight=IsAdminUser#isadminuser',
				],
			},
			certwarning: {
				sslverifyfail: [
					_('Your WOPI server is not secure: SSL verification failed'),
					'SDK: ssl-configuration',
					'https://sdk.collaboraonline.com/docs/installation/Configuration.html?highlight=ssl#ssl-configuration',
				],
				ok: [
					_('No problems with SSL verification detected'),
					'SDK: ssl-configuration',
					'https://sdk.collaboraonline.com/docs/installation/Configuration.html?highlight=ssl#ssl-configuration',
				],
			},
			postmessage: {
				ok: [
					_('PostMessage API is initialized'),
					'SDK: post-message-initialization',
					'https://sdk.collaboraonline.com/docs/postmessage_api.html#initialization',
				],
				hostnotready: [
					_('Integrator is not ready for PostMessage calls'),
					'SDK: post-message-initialization',
					'https://sdk.collaboraonline.com/docs/postmessage_api.html#initialization',
				],
			},
			hardwarewarning: {
				lowresources: [
					_(
						'Your server is configured with insufficient hardware resources, which may lead to poor performance.',
					),
					'SDK: hardware-requirements',
					'https://sdk.collaboraonline.com/docs/installation/Configuration.html#performance',
				],
				ok: [
					_('Hardware resources are sufficient for optimal performance'),
					'SDK: hardware-requirements',
					'https://sdk.collaboraonline.com/docs/installation/Configuration.html#performance',
				],
			},
		};
	}

	public isClipboardAvailable(
		clipboard = navigator.clipboard,
		isSecure = window.isSecureContext,
	): boolean {
		return !!clipboard && isSecure;
	}

	public open() {
		const serverEntries = this.getEntries(app.serverAudit);
		const clientEntries = this.getEntries(ClientAuditor.performClientAudit());

		// allEntries = serveEntries + clientEntries
		const allEntries = serverEntries.concat(clientEntries);

		// ✅ Combine all audit entries into a single string for clipboard copying
		function dedent(str: string) {
			return str.replace(/^[ \t]+/gm, ''); // removes leading spaces/tabs on each line
		}

		const auditText =
			allEntries
				.map((entry) => {
					const statusIcon = entry.columns[0]?.collapsed;
					const statusText = entry.columns[1]?.text;
					const helpText = entry.columns[2]?.text;
					const helpLink = entry.columns[2]?.link;

					const statusLabel =
						statusIcon === 'serverauditok.svg'
							? 'ok'
							: statusIcon === 'serverauditerror.svg'
								? 'error'
								: 'unknown';

					return dedent(`
			======================================
		
			Status (${statusLabel}):
			${statusText}
		
			Help (SDK: ${helpText}):
			${helpLink}
		`);
				})
				.join('') + '\n======================================\n';

		const finalAuditText = `Summary of Server Audit Dialog:\n${auditText}`;

		// ✅ Attempt to copy to clipboard
		this.copyAuditToClipboard(finalAuditText);

		const dialogBuildEvent = {
			data: this.getJSON(serverEntries.concat(clientEntries)),
			callback: this.callback.bind(this) as JSDialogCallback,
		};

		this.map.fire(
			window.mode.isMobile() ? 'mobilewizard' : 'jsdialog',
			dialogBuildEvent,
		);
	}

	private showClipboardSnackbar(message: string, color: string): void {
		const snackbar = document.createElement('div');
		snackbar.textContent = '';
		snackbar.textContent = message;
		snackbar.style.position = 'fixed';
		snackbar.style.bottom = '20px';
		snackbar.style.left = '50%';
		snackbar.style.transform = 'translateX(-50%)';
		snackbar.style.backgroundColor = '#4CAF50';
		snackbar.style.color = 'white';
		snackbar.style.padding = '12px 24px';
		snackbar.style.borderRadius = '4px';
		snackbar.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
		snackbar.style.zIndex = '9999';

		document.body.appendChild(snackbar);

		setTimeout(() => {
			snackbar.remove();
		}, 3000); // hide after 3 seconds
	}

	private additionalWarnings: any[] = [];

	private copyAuditToClipboard(text: string): void {
		if (this.isClipboardAvailable()) {
			navigator.clipboard
				.writeText(text)
				.then(() => {
					const msg = '✅ Server audit log copied!!';
					console.warn(msg);

					// ✅ Show a small confirmation popup/snackbar
					this.showClipboardSnackbar(msg, '#4CAF50');
				})
				.catch((err) => {
					const msg = `❌ Failed to copy server audit log: ${err}`;
					console.warn(msg);

					// ❌ Show a small confirmation popup/snackbar
					this.showClipboardSnackbar(msg, '#FF4933');
				});
		} else {
			console.warn(
				'⚠️ Clipboard unsupported. Could not copy server audit log.',
			);

			const warning = {
				id: this.id + '-clipboardwarning',
				type: 'fixedtext',
				text: '⚠️ Clipboard unsupported. You may not be able to copy the audit results.',
				style:
					'background-color: yellow; color: black; padding: 6px; margin-top: 8px; border: 1px solid red; font-weight: bold;',
			};

			// Push this to the dialog only if needed (see next step)
			this.additionalWarnings = [warning];
		}
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

	private countErrors(): number {
		return (
			(app.serverAudit?.filter((entry: AuditEntry) => entry.status !== 'ok')
				.length ?? 0) +
			(app.clientAudit?.filter((entry: AuditEntry) => entry.status !== 'ok')
				.length ?? 0)
		);
	}

	private getJSON(entries: Array<any>): JSDialogJSON {
		const hasErrors = this.hasErrors();
		const countErrors = this.countErrors();

		// '✅' Clipboard availability check function
		// function isClipboardBroken(): boolean {
		// 	const broken =
		// 		!navigator.clipboard ||
		// 		typeof navigator.clipboard.write !== 'function' ||
		// 		typeof navigator.clipboard.read !== 'function' ||
		// 		window.location.protocol !== 'https:';

		// 	// Optional: detailed logging
		// 	console.log('🧪 [Clipboard Check]');
		// 	console.log('navigator.clipboard:', navigator.clipboard);
		// 	console.log('navigator.clipboard.write:', navigator.clipboard?.write);
		// 	console.log('navigator.clipboard.read:', navigator.clipboard?.read);
		// 	console.log('window.location.protocol:', window.location.protocol);
		// 	console.log('🧪 Clipboard broken?', broken);

		// 	return broken;
		// }

		// '✅' Conditionally render a clipboard warning if API is unavailable or insecure
		// const clipboardWarning =
		// 	isClipboardBroken()
		// 		? {
		// 				id: this.id + '-clipboardwarning',
		// 				type: 'fixedtext',
		// 				text: 'Clipboard unsupported. You may not be able to copy the audit results.',
		// 				style:
		// 					'background-color: yellow; color: black; padding: 6px; margin-top: 8px; border: 1px solid red; font-weight: bold;',
		// 		  }
		// 		: null;

		// ✅ Construct children array with clipboardWarning included
		const childrenArray = [
			...this.additionalWarnings, // <-- insert warning block here
			{
				id: 'auditlist',
				type: 'treelistbox',
				headers: [
					{ text: _('Status'), sortable: false },
					{ text: _('Help'), sortable: false },
				],
				entries: entries,
				enabled: entries.length > 0,
			},
			!hasErrors
				? {
						id: 'auditsuccess',
						type: 'fixedtext',
						text: _('No issues found'),
					}
				: {
						id: 'auditerror',
						type: 'fixedtext',
						text: _('Alerts:') + ' ' + countErrors,
					},
			{
				id: this.id + '-buttonbox',
				type: 'buttonbox',
				children: [
					{
						id: 'ok',
						type: 'pushbutton',
						text: _('OK'),
					} as PushButtonWidget,
				],
				layoutstyle: 'end',
			} as ButtonBoxWidget,
		].filter(Boolean); // Remove nulls if clipboardWarning is null

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
					children: childrenArray,
				} as ContainerWidgetJSON,
			],
		} as JSDialogJSON;
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
