/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

namespace cool {
	export interface SignatureProvider {
		action_type: string;
		name: string;
	}

	/**
	 * Provides a dialog to select an electronic signing provider.
	 */
	export class ESignatureDialog {
		id: string = 'ESignatureDialog';

		providers: Array<SignatureProvider>;

		constructor(providers: Array<SignatureProvider>) {
			this.providers = providers;
		}

		getChildrenJSON(entries: Array<string>): Array<WidgetJSON> {
			return [
				{
					id: 'providerft',
					type: 'fixedtext',
					text: _('Provider:'),
					enabled: true,
					labelFor: 'providerlb',
				} as TextWidget,
				{
					id: 'providerlb',
					type: 'listbox',
					enabled: true,
					children: [
						{
							id: '',
							type: 'control',
							enabled: true,
							children: [],
						},
						{
							type: 'pushbutton',
							enabled: true,
							symbol: 'SPIN_DOWN',
						} as PushButtonWidget,
					],
					labelledBy: 'providerft',
					entries: entries,
					selectedCount: 1,
					selectedEntries: ['0'],
				} as ListBoxWidget,
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
			];
		}

		getJSON(): JSDialogJSON {
			const entries = this.providers.map((entry) => entry.name);
			const children = this.getChildrenJSON(entries);
			return {
				id: this.id,
				dialogid: this.id,
				type: 'dialog',
				text: _('Insert Electronic Signature'),
				title: _('Insert Electronic Signature'),
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
						children: children,
					} as ContainerWidgetJSON,
				],
			} as JSDialogJSON;
		}

		public close(): void {
			const closeEvent = {
				data: {
					action: 'close',
					id: this.id,
				},
			};
			app.map.fire('jsdialog', closeEvent);
		}

		private callback(
			objectType: string,
			eventType: string,
			object: any,
			data: any,
			builder: any,
		) {
			if (eventType === 'response' || object.id === 'ok') {
				const providers = <HTMLSelectElement>(
					document.querySelector('#ESignatureDialog select#providerlb-input')
				);
				const providerIndex = providers.selectedIndex;
				this.close();
				app.map.eSignature.handleSelectedProvider(providerIndex);
			}
		}

		open(): void {
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
		}
	}
}

JSDialog.eSignatureDialog = (providers: Array<cool.SignatureProvider>) => {
	return new cool.ESignatureDialog(providers);
};
