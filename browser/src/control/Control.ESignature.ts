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

	/**
	 * Provides electronic signing with document hashes for PDF files.
	 */
	export class ESignature {
		constructor() {
			app.map.on('commandvalues', this.onCommandValues);
		}

		insert(): void {
			// Step 1: extract the document hash.
			app.socket.sendMessage('commandvalues command=.uno:Signature');
		}

		onCommandValues(event: CommandValuesResponse): void {
			if (event.commandName != '.uno:Signature') {
				return;
			}

			const signatureResponse = event.commandValues;
			console.log(
				'TODO(vmiklos) ESignature::onCommandValues: signature time is ' +
					signatureResponse.signatureTime +
					', digest is "' +
					signatureResponse.digest +
					'"',
			);
		}
	}
}

L.Control.ESignature = cool.ESignature;

L.control.eSignature = function () {
	return new L.Control.ESignature();
};
