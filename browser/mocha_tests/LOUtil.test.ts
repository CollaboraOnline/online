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
/// <reference path="../src/core/geometry.ts"/>
/// <reference path="../src/geometry/Point.ts"/>
/// <reference path="../src/geometry/Bounds.ts"/>
/// <reference path="../src/app/Rectangle.ts"/>
/// <reference path="../src/app/LOUtil.ts"/>
/// <reference path="./data/LOUtilTestData.ts"/>

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

	describe('findItemWithAttributeRecursive()', function () {
		it('match at depth 0', function () {
			const expected = LOUtilTestData.tree;
			assert.deepEqual(expected, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'id', 'level0'));
		});

		it('match at depth 1', function () {
			const expected = LOUtilTestData.tree.children[1];
			assert.deepEqual(expected, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'id', 'level1_2'));
		});

		it('match at depth 2', function () {
			const expected = LOUtilTestData.tree.children[0].children[0];
			assert.deepEqual(expected, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'id', 'level2'));
		});
		it('match at depth 3', function () {
			const expected = LOUtilTestData.tree.children[0].children[0].children[1];
			assert.deepEqual(expected, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'id', 'level3'));
		});

		it('no match in empty tree', function () {
			assert.deepEqual(null, LOUtil.findItemWithAttributeRecursive({}, 'id', 'level0'));
		});

		it('no match for value', function () {
			assert.deepEqual(null, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'id', 'level100'));
		});

		it('no match for key', function () {
			assert.deepEqual(null, LOUtil.findItemWithAttributeRecursive(LOUtilTestData.tree, 'somekey', 'level3'));
		});
	});


	describe('findIndexInParentByAttribute()', function () {
		it('empty tree no match', function () {
			assert.equal(-1, LOUtil.findIndexInParentByAttribute({}, 'class', 'xyz'));
		});

		it('non empty tree no match', function () {
			assert.equal(-1, LOUtil.findIndexInParentByAttribute(LOUtilTestData.shortTree, 'class', 'xyz'));
		});

		it('multiple matches; get first', function () {
			assert.equal(2, LOUtil.findIndexInParentByAttribute(LOUtilTestData.shortTree, 'class', 'bac'));
		});

		it('unique match', function () {
			assert.equal(2, LOUtil.findIndexInParentByAttribute(LOUtilTestData.shortTree, 'name', 'BAC'));
		});
	});

	describe('_doRectanglesIntersect()', function () {

		it('rectangle intersects with itself', function () {
			assert.ok(LOUtil._doRectanglesIntersect([10, 20, 100, 200], [10, 20, 100, 200]));
		});

		it('A contains B, there is intersection', function () {
			assert.ok(LOUtil._doRectanglesIntersect([10, 20, 100, 200], [11, 21, 90, 190]));
		});

		it('B contains A, there is intersection', function () {
			assert.ok(LOUtil._doRectanglesIntersect([11, 21, 90, 190], [10, 20, 100, 200]));
		});

		it('A meets B tangentially (vertical)', function () {
			assert.ok(LOUtil._doRectanglesIntersect([10, 20, 100, 200], [109, 20, 10, 200]));
		});

		it('A meets B tangentially (horizontal)', function () {
			assert.ok(LOUtil._doRectanglesIntersect([10, 20, 100, 200], [10, 219, 100, 20]));
		});

		it('A meets B tangentially (single point)', function () {
			assert.ok(LOUtil._doRectanglesIntersect([10, 20, 100, 200], [109, 219, 10, 20]));
		});

		it('disjoint ([x2, y2] of first rectangle is away from the [x1, y1] of the second by a pixel)', function () {
			assert.ok(!LOUtil._doRectanglesIntersect([10, 20, 100, 200], [110, 220, 100, 200]));
		});

		it('disjoint (rectangles very far away)', function () {
			assert.ok(!LOUtil._doRectanglesIntersect([10, 20, 10, 20], [400, 500, 10, 20]));
		});
	});

	describe('_getIntersectionRectangle', function () {

		it('rectangle intersects with itself', function () {
			const expected = [10, 20, 100, 200];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [10, 20, 100, 200]));
		});

		it('A contains B, there is intersection', function () {
			const expected = [11, 21, 90, 190];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [11, 21, 90, 190]));
		});

		it('B contains A, there is intersection', function () {
			const expected = [11, 21, 90, 190];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([11, 21, 90, 190], [10, 20, 100, 200]));
		});

		it('A meets B tangentially (vertical)', function () {
			const expected = [109, 20, 1, 200];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [109, 20, 10, 200]));
		});

		it('A meets B tangentially (horizontal)', function () {
			const expected = [10, 219, 100, 1];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [10, 219, 100, 20]));
		});

		it('A meets B tangentially (single point)', function () {
			const expected = [109, 219, 1, 1];
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [109, 219, 10, 20]));
		});

		it('disjoint ([x2, y2] of first rectangle is away from the [x1, y1] of the second by a pixel)', function () {
			const expected: number[] = null;
			assert.deepEqual(expected, LOUtil._getIntersectionRectangle([10, 20, 100, 200], [110, 220, 100, 200]));
		});

		it('disjoint (rectangles very far away)', function () {
			const expected: number[] = null;
			assert.deepEqual(expected ,LOUtil._getIntersectionRectangle([10, 20, 10, 20], [400, 500, 10, 20]));
		});
	});

});
