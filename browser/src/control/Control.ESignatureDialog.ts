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

	export interface Country {
		// ISO 3166-1 alpha-2 code
		code: string;
		name: string;
	}

	/**
	 * Provides a dialog to select an electronic signing provider.
	 */
	export class ESignatureDialog {
		id: string = 'ESignatureDialog';

		countries: Array<Country>;

		defaultCountryCode: string;

		defaultProviderId: string;

		providers: Array<SignatureProvider>;

		constructor(
			countries: Array<Country>,
			providers: Array<SignatureProvider>,
		) {
			this.countries = countries;
			this.providers = providers;
		}

		getChildrenJSON(
			countries: Array<string>,
			defaultCountryIndex: number,
			providers: Array<string>,
			defaultProviderIndex: number,
		): Array<WidgetJSON> {
			return [
				{
					id: 'countryft',
					type: 'fixedtext',
					text: _('Country:'),
					enabled: true,
					labelFor: 'countrylb',
				} as TextWidget,
				{
					id: 'countrylb',
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
					labelledBy: 'countryft',
					entries: countries,
					selectedCount: 1,
					selectedEntries: [String(defaultCountryIndex)],
				} as ListBoxWidget,
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
					entries: providers,
					selectedCount: 1,
					selectedEntries: [String(defaultProviderIndex)],
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
			const countries = this.countries.map((entry) => entry.name);
			let defaultCountryIndex = this.countries
				.map((entry) => entry.code)
				.indexOf(this.defaultCountryCode);
			if (defaultCountryIndex == -1) {
				defaultCountryIndex = 0;
			}
			const providers = this.providers.map((entry) => entry.name);
			let defaultProviderIndex = this.providers
				.map((entry) => entry.action_type)
				.indexOf(this.defaultProviderId);
			if (defaultProviderIndex == -1) {
				defaultProviderIndex = 0;
			}
			const children = this.getChildrenJSON(
				countries,
				defaultCountryIndex,
				providers,
				defaultProviderIndex,
			);
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
				const countries = <HTMLSelectElement>(
					document.querySelector('#ESignatureDialog select#countrylb-input')
				);
				const countryIndex = countries.selectedIndex;
				this.close();
				app.map.eSignature.handleSelectedProvider(countryIndex, providerIndex);
			}
		}

		open(): void {
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
		}

		setDefaultCountryCode(countryCode: string): void {
			this.defaultCountryCode = countryCode;
		}

		setDefaultProviderId(providerId: string): void {
			this.defaultProviderId = providerId;
		}
	}
}

JSDialog.eSignatureDialog = (
	countries: Array<cool.Country>,
	providers: Array<cool.SignatureProvider>,
) => {
	return new cool.ESignatureDialog(countries, providers);
};
