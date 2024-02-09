import assert from 'assert';
import { Bounds } from '../src/geometry/Bounds';
import { Point } from '../src/geometry/Point';

describe('Bounds parse() tests', function () {

	describe('Bounds.parse() call with an empty string argument', function () {
		it('should return undefined', function () {
			assert.equal(Bounds.parse(''), undefined);
		});
	});

	describe('Bounds.parse() call with an string argument with 3 numbers', function () {
		it('should return undefined', function () {
			assert.equal(Bounds.parse('10 20 30'), undefined);
		});
	});

	describe('Bounds.parse() call with an string argument with 4 numbers', function () {
		var bounds = Bounds.parse('10 20 30 40');
		it('should return a valid Bounds', function () {
			assert.ok(bounds instanceof Bounds);
			assert.ok(bounds.isValid());
		});

		it('and the Bounds should be correct in position and size', function () {
			assert.ok(bounds.equals(new Bounds(new Point(10, 20), new Point(40, 60))));
		});
	});

	describe('Bounds constructor call', function () {
		it('correctness check with PointConstructable[] argument', function () {
			var bounds = new Bounds(
				[
					[10, 20],
					{ x: 5, y: 50 },
					[1, 2],
					{ x: -1, y: 7 },
				]);
			var expected = new Bounds(new Point(-1, 2), new Point(10, 50));
			assert.deepEqual(bounds, expected);
		});
	});
});
