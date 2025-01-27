/// <reference path="./refs/globals.ts"/>
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
});
