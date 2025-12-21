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

var assert = require('assert');
var jsdom = require('jsdom');


describe('DomUtil', function() {

	const docstr = `
	<html>
	<head>
	<style>
	#parent {
		font-family: "Roboto", sans-serif;
	}
	#one {
		background-color: red;
		font-family: "Libre Baskerville", serif;
		color: auto;
	}
	#two {
		font-family: auto;
	}
	</style>
	</head>
	<body>
		<div id="parent">
			<div id="one"></div>
			<div id="two"></div>
		</div>
	</body>
	</html>
	`;
	const dom = new jsdom.JSDOM(docstr);
	const window = dom.window;
	const doc = window.document;

	describe('get()', function () {

		it('element present', function() {
			assert.ok(DomUtilBase.get('one', doc) instanceof window.HTMLDivElement);
		});

		it('element absent', function() {
			assert.strictEqual(null, DomUtilBase.get('ten', doc));
		});

		it('null id', function() {
			assert.strictEqual(null, DomUtilBase.get(null, doc));
		});
	});

	describe('getStyle()', function () {
		const one = DomUtilBase.get('one', doc)
		const two = DomUtilBase.get('two', doc)

		it('style auto', function() {
			assert.strictEqual('', DomUtilBase.getStyle(one, 'color', doc));
		});

		it('style non-auto', function() {
			assert.strictEqual('red', DomUtilBase.getStyle(one, 'background-color', doc));
		});

		it('style non-auto multi word value', function() {
			assert.strictEqual('"Libre Baskerville", serif', DomUtilBase.getStyle(one, 'font-family', doc));
		});

		// NOTE: jsdom does not implement cascading of styles?
		it('style inherited', function() {
			assert.strictEqual(null, DomUtilBase.getStyle(two, 'font-family', doc));
		});

	});
});
