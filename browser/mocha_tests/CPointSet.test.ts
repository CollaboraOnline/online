/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/geometry/Point.ts" />
/// <reference path="../src/geometry/Bounds.ts" />
/// <reference path="../src/layer/vector/CPointSet.ts" />
/// <reference path="../src/core/geometry.ts" />

var assert = require('assert');

describe('CPointSet empty() tests', function () {

	describe('new CPointSet()', function () {
		it('should be empty', function () {
			assert.ok((new CPointSet()).empty());
		});
	});

	describe('CPointSet constructed from Points', function () {
		it('should be not be empty', function () {
			var pointArray: Array<cool.Point> = [new cool.Point(10, 40), new cool.Point(50, 100)];
			assert.ok(!CPointSet.fromPointArray(pointArray).empty());
		});
	});

	describe('CPointSet constructed from array of CPointSets', function () {
		it('should be not be empty', function () {
			var pointArray: Array<cool.Point> = [new cool.Point(10, 40), new cool.Point(50, 100)];
			var pSet1 = CPointSet.fromPointArray(pointArray);
			pointArray = [new cool.Point(100, 400), new cool.Point(500, 1000)];
			var pSet2 = CPointSet.fromPointArray(pointArray);
			var pSetArray = [pSet1, pSet2];
			assert.ok(!CPointSet.fromSetArray(pSetArray).empty());
		});
	});

	describe('After setting an empty Point array to a non-empty CPointSet', function () {
		it('the CPointSet should be empty', function () {
			var pointArray: Array<cool.Point> = [new cool.Point(10, 40), new cool.Point(50, 100)];
			var pSet = CPointSet.fromPointArray(pointArray);
			pSet.setPointArray([]);
			assert.ok(pSet.empty());
		});
	});

});

