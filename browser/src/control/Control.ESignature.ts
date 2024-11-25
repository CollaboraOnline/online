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

		constructor(url: string, secret: string, clientId: string) {
			this.url = url;
			this.secret = secret;
			this.clientId = clientId;

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
			const docId = response.doc_id;
			console.log(
				'TODO(vmiklos) ESignature::handleSendHashJson: docId is "' +
					docId +
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
) {
	return new L.Control.ESignature(url, secret, clientId);
};
