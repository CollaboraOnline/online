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
			assertFloat(Util.formatNum(5.35333333, 1), 5.3, 1e-5, '');
		});

		it('decimal with 4 decimal places no-round', function () {
			assertFloat(Util.formatNum(5.30335333, 4), 5.3034, 1e-5, '');
		});
	});
});
