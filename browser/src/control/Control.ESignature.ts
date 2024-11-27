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

	export interface HashSendResponse {
		doc_id: string;
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
		// This is the specific provider used by eIDEasy, e.g. 'smart-id-signature'
		method: string;

		// Timestamp of the hash extraction
		signatureTime: number;

		// Identifier of the document on the eIDEasy side
		docId: string;

		// The popup window we opened.
		popup: Window;

		constructor(url: string, secret: string, clientId: string, method: string) {
			this.url = url;
			this.secret = secret;
			this.clientId = clientId;
			this.method = method;

			app.map.on('commandvalues', this.onCommandValues.bind(this));
		}

		insert(): void {
			// Step 1: extract the document hash.
			app.socket.sendMessage('commandvalues command=.uno:Signature');
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
			const url = this.url + '/api/signatures/prepare-files-for-signing';
			const body = {
				secret: this.secret,
				client_id: this.clientId,
				// Create a PKCS#7 binary signature
				container_type: 'cades',
				files: [
					{
						// Actual file name doesn't seem to matter
						fileName: 'document.pdf',
						mimeType: 'application/pdf',
						fileContent: digest,
					},
				],
				// Learn about possible providers
				return_available_methods: true,
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
					this.handleSendHashBytes(response);
				},
				(error) => {
					app.console.log(
						'failed to fetch /api/signatures/prepare-files-for-signing: ' +
							error.message,
					);
				},
			);
		}

		// Handles the 'send hash' response bytes
		handleSendHashBytes(response: Response): void {
			response.json().then(
				(json) => {
					this.handleSendHashJson(json);
				},
				(error) => {
					app.console.log(
						'failed to parse response from /api/signatures/prepare-files-for-signing as JSON: ' +
							error.message,
					);
				},
			);
		}

		// Handles the 'send hash' response JSON
		handleSendHashJson(response: HashSendResponse): void {
			this.docId = response.doc_id;

			let url = this.url + '/single-method-signature';
			url += '?client_id=' + this.clientId;
			url += '&doc_id=' + this.docId;
			url += '&method=' + this.method;

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
				this.popup.close();
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

			console.log(
				'TODO(vmiklos) ESignature::handleReceiveSignatureJson: serialize the signature, it is "' +
					response.signed_file_contents +
					'"',
			);
		}
	}
}

L.Control.ESignature = cool.ESignature;

L.control.eSignature = function (
	url: string,
	secret: string,
	clientId: string,
	method: string,
) {
	return new L.Control.ESignature(url, secret, clientId, method);
};
