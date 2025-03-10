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

/// <reference path="./refs/globals.ts"/>
/// <reference path="./helper/util.ts"/>
/// <reference path="../src/app/Util.ts"/>

var assert = require('assert');

describe('Util static members tests', function () {

	describe('stamp()', function () {
		const obj1 = { _leaflet_id: -1 };
		const obj2 = { _leaflet_id: -1 };
		let obj1Id = Util.stamp(obj1);
		let obj2Id = Util.stamp(obj2);
		it('first: id must be > 0', function() {
			assert.ok(obj1Id > 0);
		});

		it('second: id must be > 0', function() {
			assert.ok(obj2Id > 0);
		});

		it('first objects id must be less than id of second object', function() {
			assert.ok(obj1Id < obj2Id);
		});

		it('first: id must not change', function () {
			assert.equal(obj1Id, Util.stamp(obj1));
		});

		it('second: id must not change', function () {
			assert.equal(obj2Id, Util.stamp(obj2));
		});

	});

	describe('formatNum()', function() {
		it('integer with no decimal places', function () {
			assertFloat(Util.formatNum(5, 0), 5, 1e-5, '');
		});

		it('integer with 4 decimal places', function () {
			assertFloat(Util.formatNum(5, 4), 5, 1e-5, '');
		});

		it('decimal with 1 decimal places no-round', function () {
			assertFloat(Util.formatNum(5.30333333, 1), 5.3, 1e-5, '');
		});

		it('decimal with 4 decimal places no-round', function () {
			assertFloat(Util.formatNum(5.30333333, 4), 5.3033, 1e-5, '');
		});

		it('decimal with 1 decimal places round', function () {
			assertFloat(Util.formatNum(5.35333333, 1), 5.4, 1e-5, '');
		});

		it('decimal with 4 decimal places round', function () {
			assertFloat(Util.formatNum(5.30335333, 4), 5.3034, 1e-5, '');
		});
	});

	describe('trimStart()', function () {
		it('whole string is prefix', function () {
			assert.strictEqual(Util.trimStart('ABC', 'ABC'), '');
		});

		it('whole string shorter than prefix', function () {
			assert.strictEqual(Util.trimStart('ABC', 'ABCD'), 'ABC');
		});

		it('No prefix', function () {
			assert.strictEqual(Util.trimStart('XYZ', 'ABCD'), 'XYZ');
		});

		it('Multi prefix', function () {
			assert.strictEqual(Util.trimStart('ABCDABCDXYZ', 'ABCD'), 'ABCDXYZ');
		});
	});

	describe('trimEnd()', function () {
		it('whole string is suffix', function () {
			assert.strictEqual(Util.trimEnd('ABC', 'ABC'), '');
		});

		it('whole string shorter than suffix', function () {
			assert.strictEqual(Util.trimEnd('ABC', 'ABCD'), 'ABC');
		});

		it('No suffix', function () {
			assert.strictEqual(Util.trimEnd('XYZ', 'ABCD'), 'XYZ');
		});

		it('Multi suffix', function () {
			assert.strictEqual(Util.trimEnd('XYZABCDABCD', 'ABCD'), 'XYZABCD');
		});
	});

	describe('trim()', function () {
		it('trim() with no prefix or suffix argument', function () {
			assert.strictEqual(Util.trim('\t  \tCONTENT \t\t \t'), 'CONTENT');
		});

		it('whole string is prefix', function () {
			assert.strictEqual(Util.trim('ABC', 'ABC'), '');
		});

		it('whole string shorter than prefix', function () {
			assert.strictEqual(Util.trim('ABC', 'ABCD'), 'ABC');
		});

		it('whole string is suffix', function () {
			assert.strictEqual(Util.trim('ABC', ' ', 'ABC'), '');
		});

		it('whole string shorter than suffix', function () {
			assert.strictEqual(Util.trim('ABC', '', 'ABCD'), 'ABC');
		});

		it('No prefix', function () {
			assert.strictEqual(Util.trim('XYZ', 'ABCD'), 'XYZ');
		});

		it('No suffix', function () {
			assert.strictEqual(Util.trim('XYZ', '', 'ABCD'), 'XYZ');
		});

		it('Multi prefix and suffix', function () {
			assert.strictEqual(Util.trim('ABCDABCDXYZABCDABCD', 'ABCD', 'ABCD'), 'ABCDXYZABCD');
		});

		it('Overlapping prefix and suffix', function () {
			assert.strictEqual(Util.trim('ABCDAB', 'ABCD', 'CDAB'), 'AB');
		});
	});

	describe('splitWords()', function () {
		it('split empty string', function () {
			assert.deepEqual(Util.splitWords(''), ['']);
		});

		it('split string with white spaces', function () {
			assert.deepEqual(Util.splitWords('  \t  \t\t  '), ['']);
		});

		it('split string with single word', function () {
			assert.deepEqual(Util.splitWords('ABC'), ['ABC']);
		});

		it('split string with single word surrounded by multi white-spaces', function () {
			assert.deepEqual(Util.splitWords(' \t \t   \t\t  ABC\t \t\t   \t'), ['ABC']);
		});

		it('split string with two words', function () {
			assert.deepEqual(Util.splitWords(' \t \t   \t\t  ABC\t \t\t   \tXYZ    \t\t   \t'), ['ABC', 'XYZ']);
		});
	});

	describe('round()', function() {
		it('integer with no decimal places', function () {
			assertFloat(Util.round(5), 5, 1e-5, '');
		});

		it('integer with 4 decimal places', function () {
			assertFloat(Util.round(5, 1e-4), 5, 1e-5, '');
		});

		it('decimal with 1 decimal places no-round', function () {
			assertFloat(Util.round(5.30333333, 0.1), 5.3, 1e-5, '');
		});

		it('decimal with 4 decimal places no-round', function () {
			assertFloat(Util.round(5.30333333, 0.0001), 5.3033, 1e-5, '');
		});

		it('decimal with 1 decimal places round', function () {
			assertFloat(Util.round(5.35333333, 0.1), 5.4, 1e-5, '');
		});

		it('decimal with 4 decimal places round', function () {
			assertFloat(Util.round(5.30335333, 0.0001), 5.3034, 1e-5, '');
		});
	});

	describe('template()', function () {
		it('empty string', function () {
			assert.strictEqual(Util.template('', {}), '');
		});

		it('no substitutions', function () {
			assert.strictEqual(Util.template('cool apps', {'cool': 32}), 'cool apps');
		});

		it('one key one substitution', function () {
			assert.strictEqual(Util.template('cool {  app  } abcd', {'cool': 32, 'app': 'calc'}), 'cool calc abcd');
		});

		it('one key two substitutions', function () {
			assert.strictEqual(Util.template('A {app   } cool {   app} abcd', {'cool': 32, 'app': 'calc'}), 'A calc cool calc abcd');
		});

		it('two keys multiple substitutions', function () {
			assert.strictEqual(Util.template('A) {  app1}, B) {app2 }, C) { app2}, D) { app1 } ', {'cool': 32, 'app': 'calc', 'app1': 'draw', 'app2': 'impress'}), 'A) draw, B) impress, C) impress, D) draw ');
		});

		it('key function', function () {
			assert.strictEqual(Util.template('{fkey }, { key }', {
				'key': '1234',
				'fkey': function(data: any) {
					return data['key'] + '_999';
				},
			}), '1234_999, 1234');
		});
	});

});
