/// <reference path="./refs/globals.ts"/>
/// <reference path="./helper/util.ts"/>
/// <reference path="../src/core/Rectangle.ts"/>

var assert = require('assert').strict;

interface ExpectedRectangle {
	x1?: number,
	x2?: number,
	width?: number,

	y1?: number,
	y2?: number,
	height?: number,

	area?: number,

	eps: number,
}

function assertRectangle(actual: cool.Rectangle, expected: ExpectedRectangle) {

	// x-coordinate

	if (expected.x1 !== undefined)
		assertFloat(actual.x1, expected.x1, expected.eps, 'Wrong x1');
	if (expected.x2 !== undefined)
		assertFloat(actual.x2, expected.x2, expected.eps, 'Wrong x2');
	if (expected.width !== undefined)
		assertFloat(actual.width, expected.width, expected.eps, 'Wrong width');

	// y-coordinate

	if (expected.y1 !== undefined)
		assertFloat(actual.y1, expected.y1, expected.eps, 'Wrong y1');
	if (expected.y2 !== undefined)
		assertFloat(actual.y2, expected.y2, expected.eps, 'Wrong y2');
	if (expected.height !== undefined)
		assertFloat(actual.height, expected.height, expected.eps, 'Wrong height');

	// area

	if (expected.area !== undefined)
		assertFloat(actual.area, expected.area, expected.eps, 'Wrong area');
}

const x1 = 3.4;
const y1 = 6.3;
const width = 2.3;
const height = 8.2;

const eps = 0.01;

describe('construction test', function () {
	it('construct', function () {
		const rect = new cool.Rectangle(x1, y1, width, height);
		assertRectangle(rect, {
			x1: x1,
			x2: x1 + width,
			width: width,

			y1: y1,
			y2: y1 + height,
			height: height,


			area: width * height,
			eps: eps,
		});
	});
});

describe('coordinate API tests', function () {

	const coords = ['x', 'y'];
	coords.forEach(function (coord: string) {
		const isX = coord === 'x';
		const isY = !isX;

		describe(coord + '-coordinate API tests', function () {

			it(isX ? 'setX1' : 'setY1', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const newC1 = 1.3;
				const newSize = (isX ? width + x1: height + y1) - newC1;

				isX ? rect.x1 = newC1 : rect.y1 = newC1;

				const newX1 = isX ? newC1 : x1;
				const newY1 = isY ? newC1 : y1;
				const newWidth = isX ? newSize : width;
				const newHeight = isY ? newSize : height;


				assertRectangle(rect, {
					x1: newX1,
					x2: x1 + width,
					width: newWidth,

					y1: newY1,
					y2: y1 + height,
					height: newHeight,

					area: newWidth * newHeight,
					eps: eps,
				});
			});


			it(isX ? 'setX2' : 'setY2', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const newC2 = 10.3;
				const newSize = newC2 - (isX ? x1 : y1);

				isX ? rect.x2 = newC2 : rect.y2 = newC2;

				const newX2 = isX ? newC2 : (x1 + width);
				const newY2 = isY ? newC2 : (y1 + height);
				const newWidth = isX ? newSize : width;
				const newHeight = isY ? newSize : height;

				assertRectangle(rect, {
					x1: x1,
					x2: newX2,
					width: newWidth,

					y1: y1,
					y2: newY2,
					height: newHeight,

					area: newWidth * newHeight,
					eps: eps,
				});
			});


			it(isX ? 'setWidth' : 'setHeight', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const newSize = 1.4;
				const newC2 = (isX ? x1 : y1) + newSize;

				isX ? rect.width = newSize : rect.height = newSize;

				const newX2 = isX ? newC2 : (x1 + width);
				const newY2 = isY ? newC2 : (y1 + height);
				const newWidth = isX ? newSize : width;
				const newHeight = isY ? newSize : height;

				assertRectangle(rect, {
					x1: x1,
					x2: newX2,
					width: newWidth,

					y1: y1,
					y2: newY2,
					height: newHeight,

					area: newWidth * newHeight,
					eps: eps,
				});
			});


			it('setArea (Preserve ' + (isX ? 'height' : 'width') + ')', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const newArea = 20.4;
				const newWidth = isX ? (newArea / height) : width;
				const newHeight = isY ? (newArea / width) : height;
				const newX2 = isX ? (x1 + newWidth) : (x1 + width);
				const newY2 = isY ? (y1 + newHeight) : (y1 + height);

				rect.setArea(newArea, isX /* preserveHeight */);

				assertRectangle(rect, {
					x1: x1,
					x2: newX2,
					width: newWidth,

					y1: y1,
					y2: newY2,
					height: newHeight,

					area: newWidth * newHeight,
					eps: eps,
				});
			});


			it('moveBy', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const dc = 1.3;
				const newX1 = isX ? (x1 + dc) : x1;
				const newX2 = isX ? (x1 + width + dc) : (x1 + width);
				const newY1 = isY ? (y1 + dc) : y1;
				const newY2 = isY ? (y1 + height + dc) : (y1 + height);
				isX ? rect.moveBy(dc, 0) : rect.moveBy(0, dc);

				assertRectangle(rect, {
					x1: newX1,
					x2: newX2,
					width: width,

					y1: newY1,
					y2: newY2,
					height: height,

					area: width * height,
					eps: eps,
				});
			});


			it('moveTo', function () {
				const rect = new cool.Rectangle(x1, y1, width, height);
				const newC1 = 50.3;

				const newX1 = isX ? newC1 : x1;
				const newX2 = newX1 + width;

				const newY1 = isY ? newC1 : y1;
				const newY2 = newY1 + height;

				isX ? rect.moveTo(newC1, y1) : rect.moveTo(x1, newC1);

				assertRectangle(rect, {
					x1: newX1,
					x2: newX2,
					width: width,

					y1: newY1,
					y2: newY2,
					height: height,

					area: width * height,
					eps: eps,
				});
			});



		}); // describe(coord + '-coordinate API tests'

	}); // coords.forEach

}); // root describe