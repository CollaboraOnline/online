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
 * L.Map.Settings.
 */

interface IFrameDialog {
	remove(): void;
	hasLoaded(): boolean;
	postMessage(message: any): void;
	show(): void;
}

L.Map.mergeOptions({
	settings: true,
});

L.Map.Settings = L.Handler.extend({
	_iframeDialog: null as IFrameDialog | null,
	_url: '',

	_getLocalSettingsUrl: function (): string {
		const settingsLocation: string = app.LOUtil.getURL(
			'/admin/adminIntegratorSettings.html',
		);
		if (window.socketProxy) return window.makeWsUrl(settingsLocation);
		return settingsLocation;
	},

	initialize: function (map: any): void {
		L.Handler.prototype.initialize.call(this, map);

		this._url = this._getLocalSettingsUrl();
	},

	addHooks: function (): void {
		L.DomEvent.on(window, 'message', this.onMessage, this);
	},

	removeHooks: function (): void {
		L.DomEvent.off(window, 'message', this.onMessage, this);
	},

	removeIframe: function (): void {
		if (this._iframeDialog) this._iframeDialog.remove();
	},

	showSettingsDialog: function (): void {
		if (this._iframeDialog && this._iframeDialog.hasLoaded())
			this.removeIframe();

		const theme = window.prefs.getBoolean('darkTheme') ? 'dark' : 'light';

		const params: Array<Record<string, any>> = [
			{ ui_theme: theme },
			{ lang: window.langParam },
			{ mobile: window.mode.isMobile() },
			{ access_token: window.accessToken },
			{ access_token_ttl: window.accessTokenTTL },
			{ wopi_setting_base_url: window.wopiSettingBaseUrl },
		];

		const options = {
			prefix: 'iframe-settings',
			stylesheets: ['../settings.css'],
			titlebar: _('Options'),
			modalButtons: [
				{
					id: 'iframe-settings-cancel',
					text: _('Cancel'),
					align: 'right',
				},
				{
					id: 'iframe-settings-save',
					text: _('Save'),
					align: 'right',
				},
			],
			dialogCssClass:
				'jsdialog-container ui-dialog lokdialog_container ui-widget-content',
		};

		this._iframeDialog = L.iframeDialog(this._url, params, null, options);

		const cancelButton = document.getElementById('iframe-settings-cancel');
		const saveButton = document.getElementById('iframe-settings-save');

		L.DomEvent.on(
			cancelButton,
			'click',
			() => {
				this.removeIframe();
			},
			this,
		);

		L.DomEvent.on(
			saveButton,
			'click',
			() => {
				this._iframeDialog.postMessage({
					MessageId: 'settings-save-all',
				});
				setTimeout(() => {
					this.removeIframe();
				}, 300);
			},
			this,
		);
	},

	onMessage: function (e: MessageEvent): void {
		if (typeof e.data !== 'string') return; // Some extensions may inject scripts resulting in load events that are not strings
		const data = JSON.parse(e.data);

		if (data.MessageId === 'settings-show') {
			this._iframeDialog.show();
		} else if (data.MessageId === 'settings-cancel') {
			this.removeIframe();
		} else if (data.MessageId === 'settings-ready') {
			this._iframeDialog.postMessage(data);
		}
	},
});

if (window.prefs.canPersist) {
	L.Map.addInitHook('addHandler', 'settings', L.Map.Settings);
}
