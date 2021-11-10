/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/geometry/Point.ts" />
/// <reference path="../src/geometry/Bounds.ts" />

var assert = require('assert').strict;

describe('Bounds parse() tests', function () {

	describe('Bounds.parse() call with an empty string argument', function () {
		it('should return undefined', function () {
			assert.equal(cool.Bounds.parse(''), undefined);
		});
	});

	describe('Bounds.parse() call with an string argument with 3 numbers', function () {
		it('should return undefined', function () {
			assert.equal(cool.Bounds.parse('10 20 30'), undefined);
		});
	});

	describe('Bounds.parse() call with an string argument with 4 numbers', function () {
		var bounds = cool.Bounds.parse('10 20 30 40');
		it('should return a valid Bounds', function () {
			assert.ok(bounds instanceof cool.Bounds);
			assert.ok(bounds.isValid());
		});

		it('and the Bounds should be correct in position and size', function () {
			assert.ok(bounds.equals(new cool.Bounds(new cool.Point(10, 20), new cool.Point(40, 60))));
		});
	});

	describe('Bounds constructor call', function () {
		it('correctness check with PointConstructable[] argument', function () {
			var bounds = new cool.Bounds(
				[
					[10, 20],
					{ x: 5, y: 50 },
					[1, 2],
					{ x: -1, y: 7 },
				]);
			var expected = new cool.Bounds(new cool.Point(-1, 2), new cool.Point(10, 50));
			assert.deepEqual(expected, bounds);
		});
	});
});
