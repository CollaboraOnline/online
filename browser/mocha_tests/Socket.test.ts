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

describe('Socket', function() {
	describe('getParameterByName()', function () {
		const main = 'https://sub.main.org';
		const path = 'path/to/resource';
		const fragment = 'store';
		const params: Map<string, string> = new Map([
			['token_abc', 'aqk002'],
			['rotate.xyz', 'pqr_123'],
			['rotate(xyz)', 'pqr_123'],
		]);

		const createURL = (): URL => {
			let urlStr = `${main}/${path}#${fragment}`;
			let first = true;
			for (const [name, value] of params) {
				let sep = '&';
				if (first) {
					sep = '?';
					first = false;
				}
				urlStr += `${sep}${name}=${value}`;
			}
			return new URL(urlStr);
		};

		const url = createURL();

		it('no regex chars, has a match', function() {
			const actual = Socket.getParameterByName(url.href, 'token_abc')
			nodeassert.strictEqual(actual, params.get('token_abc'));
		});

		it('no regex chars, no match', function() {
			const actual = Socket.getParameterByName(url.href, 'token_abcd')
			nodeassert.strictEqual(actual, '');
		});

		it('one regex char, has a match', function() {
			const actual = Socket.getParameterByName(url.href, 'rotate.xyz')
			nodeassert.strictEqual(actual, params.get('rotate.xyz'));
		});

		it('one regex char, no match', function() {
			const actual = Socket.getParameterByName(url.href, 'rotate$xyz')
			nodeassert.strictEqual(actual, '');
		});

		it('two regex chars, has a match', function() {
			const actual = Socket.getParameterByName(url.href, 'rotate(xyz)')
			nodeassert.strictEqual(actual, params.get('rotate(xyz)'));
		});

	});
});
