/// <reference path="./refs/globals.ts"/>
/// <reference path="./helper/util.ts"/>
/// <reference path="../src/core/geometry.ts"/>
/// <reference path="../src/geometry/Point.ts"/>
/// <reference path="../src/geometry/Bounds.ts"/>
/// <reference path="../src/app/LOUtil.ts"/>

var assert = require('assert').strict;

describe('LOUtil static class members', function () {

	describe('stringToBounds()', function () {
		it('parse from string with separaters and whitespaces', function () {
			const bounds = LOUtil.stringToBounds('1, 2, \n3,    \t4 ');
			const expected = cool.Bounds.toBounds([[1, 2], [4, 6]])
			assert.deepEqual(expected, bounds);
		});

		it('parse from string with more than 4 numbers', function () {
			const bounds = LOUtil.stringToBounds('1, 2, 3, 4, 5 ');
			const expected = cool.Bounds.toBounds([[1, 2], [4, 6]])
			assert.deepEqual(expected, bounds);
		});
	});

	describe('stringToRectangles()', function () {

		it('parse one rectangle from string with separaters and whitespaces', function () {
			const rectangles = LOUtil.stringToRectangles('1, 2, \n3,    \t4 ');
			const bottomLeft = cool.Point.toPoint(1, 6);
			const bottomRight = cool.Point.toPoint(4, 6);
			const topLeft = cool.Point.toPoint(1, 2);
			const topRight = cool.Point.toPoint(4, 2);
			const expected = [[bottomLeft, bottomRight, topLeft, topRight],]
			assert.deepEqual(expected, rectangles);
		});

		it('parse two rectangles from string with separaters and whitespaces', function () {
			const rectangles = LOUtil.stringToRectangles('1, 2, \n3,    \t4 ; 101, 202, \t3, \n4; ');
			const bottomLeft = cool.Point.toPoint(1, 6);
			const bottomRight = cool.Point.toPoint(4, 6);
			const topLeft = cool.Point.toPoint(1, 2);
			const topRight = cool.Point.toPoint(4, 2);
			const offset = cool.Point.toPoint(100, 200);
			const first = [bottomLeft, bottomRight, topLeft, topRight];
			const second: cool.Point[] = [];
			for (let idx = 0; idx < 4; ++idx) {
				second.push(first[idx].add(offset));
			}
			const expected = [first, second];
			assert.deepEqual(expected, rectangles);
		});
	});
});
