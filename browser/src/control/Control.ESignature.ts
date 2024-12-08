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
	export interface SignatureResponse {
		signatureTime: number;
		digest: string;
	}

	export interface CommandValuesResponse {
		commandName: string;
		commandValues: SignatureResponse;
	}

	export interface CommandResultResponse {
		commandName: string;
		success: boolean;
		// Depends on the value of commandName
		result: any;
	}

	export interface HashSendResponse {
		doc_id: string;
		available_methods: Array<string>;
		message: string;
	}

	export interface SignedResponse {
		type: string;
		error: string;
	}

	export interface ReceiveSignatureResponse {
		status: string;
		signed_file_contents: string;
	}

	/**
	 * Provides electronic signing with document hashes for PDF files.
	 */
	export class ESignature {
		// Base url, e.g. https://id.eideasy.com or https://test.eideasy.com
		url: string;
		// These are kind of API tokens, see
		// <https://docs.eideasy.com/guide/api-credentials.html>
		secret: string;
		clientId: string;

		// Timestamp of the hash extraction
		signatureTime: number;

		// Identifier of the document on the eIDEasy side
		docId: string;

		// The popup window we opened.
		popup: Window;

		availableProviderIDs: Array<string>;

		// Provider ID to name map.
		static providerNames: { [name: string]: string } = {
			// The /api/client-config API would provide this, but having the data here
			// saves us from fetching the same data every time for every user.
			'id-signature': 'Estonian ID card',
			'mid-signature': 'Estonian Mobile-ID',
			'lt-mid-signature': 'Lithuanian Mobile-ID',
			'smart-id-signature': 'Smart-ID',
			'be-id-signature': 'Belgian ID card',
			'lt-id-signature': 'Lithuanian ID card',
			'lv-id-signature': 'Latvian ID card',
			'lv-eparaksts-mobile-signature': 'Latvian eParaksts Mobile',
			'fi-id-signature': 'Finnish ID card',
			'at-handy-signatur-signature': 'Austrian Handy-Signatur',
			'evrotrust-signature': 'Evrotrust',
			'd-trust-sign-me-qes-signature': 'D-Trust sign-me',
			'certeurope-usb-token-signature': 'CertEurope USB token',
			'certsign-usb-token-signature': 'certSIGN USB token',
			'zealid-signature': 'ZealID app',
			'audkenni-qes-signature': 'Audkenni',
			'simply-sign-qes-signature': 'SimplySign',
			'halcom-qes-signature': 'Halcom',
			'hr-id-signature': 'Croatian ID Card',
			'uanataca-qes-signature': 'Uanataca',
			'itsme-qes-signature': 'Itsme',
			'harica-qes-signature': 'Harica',
			'lt-id-qes-signature': 'LT ID',
			'trust-asia-signature': 'TrustAsia',
			'buypass-qes-signature': 'Buypass',
			'cert-store-qes-signature': 'Local Certificate',
			'fi-ftn-intesi-adv-signature':
				'Finnish Trust Network / Luottamusverkosto',
			'cz-id-signature': 'Czech ID Card',
			'es-lleida-advanced-signature': 'Lleida',
			'serpro-id-advanced-signature': 'SerproID',
		};

		constructor(url: string, secret: string, clientId: string) {
			this.url = url;
			this.secret = secret;
			this.clientId = clientId;

			app.map.on('commandvalues', this.onCommandValues.bind(this));
			app.map.on('commandresult', this.onCommandResult.bind(this));
		}

		insert(): void {
			// Step 1: extract the document hash.
			app.socket.sendMessage('commandvalues command=.uno:Signature');
		}

		// Handles the result of dispatched UNO commands
		onCommandResult(event: CommandResultResponse): void {
			if (event.commandName == '.uno:PrepareSignature') {
				const response = <HashSendResponse>event.result;
				this.handleSendHashResponse(event.success, response);
			}
		}

		// Handles the command values response for .uno:Signature
		onCommandValues(event: CommandValuesResponse): void {
			if (event.commandName != '.uno:Signature') {
				return;
			}

			const signatureResponse = event.commandValues;

			// Save this, we'll need it for the serialize step.
			this.signatureTime = signatureResponse.signatureTime;

			const digest = signatureResponse.digest;

			// Step 2: send the hash, get a document ID.
			const redirectUrl = window.makeHttpUrl('/cool/signature');
			const documentName = <HTMLInputElement>(
				document.querySelector('#document-name-input')
			);
			const fileName = documentName.value;
			const body = {
				client_id: this.clientId,
				// Create a PKCS#7 binary signature
				container_type: 'cades',
				files: [
					{
						// Actual file name appears during 2FA
						fileName: fileName,
						mimeType: 'application/pdf',
						fileContent: digest,
					},
				],
				// Learn about possible providers
				return_available_methods: true,
				signature_redirect: redirectUrl,
				// Automatic file download will not happen after signing
				nodownload: true,
			};
			const args = {
				body: body,
			};
			app.map.sendUnoCommand('.uno:PrepareSignature', args);
		}

		// Handles the 'send hash' response JSON
		handleSendHashResponse(ok: boolean, response: HashSendResponse): void {
			if (!ok) {
				app.console.log(
					'/api/signatures/prepare-files-for-signing failed: ' +
						response.message,
				);
				return;
			}

			this.docId = response.doc_id;
			this.availableProviderIDs = response.available_methods;
			const providers = this.createProviders(this.availableProviderIDs);
			const dialog = JSDialog.eSignatureDialog(providers);
			dialog.open();
		}

		// Handles the selected provider from the dialog
		handleSelectedProvider(providerIndex: number): void {
			const provider = this.availableProviderIDs[providerIndex];
			app.console.log(
				'attempting to esign using the "' + provider + '" provider',
			);

			let url = this.url + '/single-method-signature';
			url += '?client_id=' + this.clientId;
			url += '&doc_id=' + this.docId;
			url += '&method=' + provider;

			let features = 'popup';
			features += ', left=' + window.screen.width / 4;
			features += ', top=' + window.screen.height / 4;
			features += ', width=' + window.screen.width / 2;
			features += ', height=' + window.screen.height / 2;

			// Step 3: sign the hash.
			this.popup = window.open(url, '_blank', features);
		}

		// Handles the 'sign hash' response
		handleSigned(response: SignedResponse): void {
			if (response.type != 'SUCCESS') {
				app.console.log('failed to sign: ' + response.error);
				return;
			}

			try {
				if (this.popup) {
					this.popup.close();
				}
			} catch (error) {
				app.console.log('failed to close the signing popup: ' + error.message);
				return;
			}

			// Step 4: fetch the signature.
			const url = this.url + '/api/signatures/download-signed-file';
			const body = {
				secret: this.secret,
				client_id: this.clientId,
				doc_id: this.docId,
			};
			const headers = {
				'Content-Type': 'application/json',
			};
			const request = new Request(url, {
				method: 'POST',
				body: JSON.stringify(body),
				headers: headers,
			});
			window.fetch(request).then(
				(response) => {
					this.handleReceiveSignatureBytes(response);
				},
				(error) => {
					app.console.log('failed to fetch the signature: ' + error.message);
				},
			);
		}

		// Handles the 'receive signature' response bytes
		handleReceiveSignatureBytes(response: Response): void {
			response.json().then(
				(json) => {
					this.handleReceiveSignatureJson(json);
				},
				(error) => {
					app.console.log(
						'failed to parse response from signature fetch as JSON: ' +
							error.message,
					);
				},
			);
		}

		// Handles the 'receive signature' response JSON
		handleReceiveSignatureJson(response: ReceiveSignatureResponse): void {
			if (response.status != 'OK') {
				app.console.log(
					'received signature status is not OK: ' + response.status,
				);
				return;
			}

			// Step 5: serialize the signature.
			const args = {
				SignatureTime: {
					type: 'string',
					value: String(this.signatureTime),
				},
				SignatureValue: {
					type: 'string',
					value: response.signed_file_contents,
				},
			};
			app.map.sendUnoCommand('.uno:Signature', args);
		}

		// Turns a list of provider IDs into a list of signature providers
		createProviders(providerIds: Array<string>): Array<cool.SignatureProvider> {
			// Set the only tested provider as preferred.
			const preferred = 'smart-id-signature';
			const index = providerIds.indexOf(preferred);
			if (index != -1) {
				providerIds.splice(index, /*deleteCount=*/ 1);
				providerIds.splice(/*start=*/ 0, /*deleteCount=*/ 0, preferred);
			}

			return providerIds.map((id) => {
				const providerName = ESignature.providerNames[id];
				if (providerName) {
					return { action_type: id, name: providerName };
				}
				app.console.log(
					'failed to find a human-readable name for provider "' + id + '"',
				);
				return { action_type: id, name: id };
			});
		}
	}
}

L.Control.ESignature = cool.ESignature;

L.control.eSignature = function (
	url: string,
	secret: string,
	clientId: string,
) {
	return new L.Control.ESignature(url, secret, clientId);
};
