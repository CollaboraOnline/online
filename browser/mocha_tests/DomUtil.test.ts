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

	class DOMStore {

		public dom: any;

		constructor(docString: string) {
			this.dom = new jsdom.JSDOM(docString);
		}

		get window() {
			return this.dom.window;
		}

		get document() {
			return this.dom.window.document;
		}
	}

	describe('get()', function () {
		const store = new DOMStore(docstr);

		it('element present', function() {
			assert.ok(DomUtilBase.get('one', store.document) instanceof store.window.HTMLDivElement);
		});

		it('element absent', function() {
			assert.strictEqual(null, DomUtilBase.get('ten', store.document));
		});

		it('null id', function() {
			assert.strictEqual(null, DomUtilBase.get(null, store.document));
		});
	});

	describe('getStyle()', function () {
		const store = new DOMStore(docstr);
		const one = DomUtilBase.get('one', store.document);
		const two = DomUtilBase.get('two', store.document);

		it('style auto', function() {
			assert.strictEqual('', DomUtilBase.getStyle(one, 'color', store.document));
		});

		it('style non-auto', function() {
			assert.strictEqual('red', DomUtilBase.getStyle(one, 'background-color', store.document));
		});

		it('style non-auto multi word value', function() {
			assert.strictEqual('"Libre Baskerville", serif', DomUtilBase.getStyle(one, 'font-family', store.document));
		});

		// NOTE: jsdom does not implement cascading of styles?
		it('style inherited', function() {
			assert.strictEqual(null, DomUtilBase.getStyle(two, 'font-family', store.document));
		});

	});

	describe('setStyle()', function () {
		const store = new DOMStore(docstr);
		const one = DomUtilBase.get('one', store.document);
		const two = DomUtilBase.get('two', store.document);

		it('auto to green', function() {
			DomUtilBase.setStyle(one, 'color', 'green');
			assert.strictEqual('green', DomUtilBase.getStyle(one, 'color', store.document));
		});

		it('non-auto to purple', function() {
			DomUtilBase.setStyle(one, 'background-color', 'purple');
			assert.strictEqual('purple', DomUtilBase.getStyle(one, 'background-color', store.document));
		});

		it('unset to green', function() {
			DomUtilBase.setStyle(two, 'color', 'green');
			assert.strictEqual('green', DomUtilBase.getStyle(two, 'color', store.document));
		});
	});

	describe('create()', function () {
		const store = new DOMStore(docstr);
		const one = DomUtilBase.get('one', store.document);

		it('parentless', function() {
			const el = DomUtilBase.create('p', 'cool-caption', undefined, store.document);
			assert.strictEqual('cool-caption', el.className);
			assert.strictEqual(null, el.parentElement);
		});

		it('with parent', function() {
			const el = DomUtilBase.create('p', 'cool-caption', one, store.document);
			assert.strictEqual('cool-caption', el.className);
			assert.strictEqual(one, el.parentElement);
			assert.strictEqual(1, one.childElementCount);
		});
	});

	describe('createWithId()', function () {
		const store = new DOMStore(docstr);
		const one = DomUtilBase.get('one', store.document);

		it('parentless', function() {
			const el = DomUtilBase.createWithId('p', 'cool-caption', undefined, store.document);
			assert.strictEqual('cool-caption', el.id);
			assert.strictEqual(null, el.parentElement);
			const result = DomUtilBase.get('cool-caption', store.document);
			assert.strictEqual(null, result);
		});

		it('with parent', function() {
			const el = DomUtilBase.createWithId('p', 'cool-caption', one, store.document);
			assert.strictEqual('cool-caption', el.id);
			assert.strictEqual(one, el.parentElement);
			assert.strictEqual(1, one.childElementCount);
			const result = DomUtilBase.get('cool-caption', store.document);
			assert.strictEqual(el, result);
		});
	});

	describe('remove()', function () {
		const store = new DOMStore(docstr);
		const one = DomUtilBase.get('one', store.document);

		it('null element', function() {
			assert.doesNotThrow(() => {
				DomUtilBase.remove();
			}, 'remove() should never throw');
		});

		it('parentless', function() {
			const el = DomUtilBase.createWithId('p', 'cool-caption', undefined, store.document);
			assert.doesNotThrow(() => {
				DomUtilBase.remove(el);
			}, 'remove() should never throw');
			assert.strictEqual('cool-caption', el.id);
			assert.strictEqual(null, el.parentElement);
			const result = DomUtilBase.get('cool-caption', store.document);
			assert.strictEqual(null, result);
		});

		it('with parent', function() {
			const el = DomUtilBase.createWithId('p', 'cool-caption', one, store.document);
			assert.doesNotThrow(() => {
				DomUtilBase.remove(el);
			}, 'remove() should never throw');
			assert.strictEqual('cool-caption', el.id);
			assert.strictEqual(null, el.parentElement);
			assert.strictEqual(0, one.childElementCount);
			const result = DomUtilBase.get('cool-caption', store.document);
			assert.strictEqual(null, result);
		});
	});
});
