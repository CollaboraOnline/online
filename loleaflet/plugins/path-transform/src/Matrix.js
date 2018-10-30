/**
 * @class  L.Matrix
 *
 * @param {Number} a
 * @param {Number} b
 * @param {Number} c
 * @param {Number} d
 * @param {Number} e
 * @param {Number} f
 */
L.Matrix = function(a, b, c, d, e, f) {

	/**
	* @type {Array.<Number>}
	*/
	this._matrix = [a, b, c, d, e, f];
};


L.Matrix.prototype = {


	/**
	* @param  {L.Point} point
	* @return {L.Point}
	*/
	transform: function(point) {
		return this._transform(point.clone());
	},


	/**
	* Destructive
	*
	* [ x ] = [ a  b  tx ] [ x ] = [ a * x + b * y + tx ]
	* [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
	*
	* @param  {L.Point} point
	* @return {L.Point}
	*/
	_transform: function(point) {
		var matrix = this._matrix;
		var x = point.x, y = point.y;
		point.x = matrix[0] * x + matrix[1] * y + matrix[4];
		point.y = matrix[2] * x + matrix[3] * y + matrix[5];
		return point;
	},


	/**
	* @param  {L.Point} point
	* @return {L.Point}
	*/
	untransform: function (point) {
		var matrix = this._matrix;
		return new L.Point(
			(point.x / matrix[0] - matrix[4]) / matrix[0],
			(point.y / matrix[2] - matrix[5]) / matrix[2]
		);
	},


	/**
	* @return {L.Matrix}
	*/
	clone: function() {
		var matrix = this._matrix;
		return new L.Matrix(
			matrix[0], matrix[1], matrix[2],
			matrix[3], matrix[4], matrix[5]
		);
	},


	/**
	* @param {L.Point=|Number=} translate
	* @return {L.Matrix|L.Point}
	*/
	translate: function(translate) {
		if (translate === undefined) {
			return new L.Point(this._matrix[4], this._matrix[5]);
		}

		var translateX, translateY;
		if (typeof translate === 'number') {
			translateX = translateY = translate;
		} else {
			translateX = translate.x;
			translateY = translate.y;
		}

		return this._add(1, 0, 0, 1, translateX, translateY);
	},


	/**
	* @param {L.Point=|Number=} scale
	* @return {L.Matrix|L.Point}
	*/
	scale: function(scale, origin) {
		if (scale === undefined) {
			return new L.Point(this._matrix[0], this._matrix[3]);
		}

		var scaleX, scaleY;
		origin = origin || L.point(0, 0);
		if (typeof scale === 'number') {
			scaleX = scaleY = scale;
		} else {
			scaleX = scale.x;
			scaleY = scale.y;
		}

		return this
			._add(scaleX, 0, 0, scaleY, origin.x, origin.y)
			._add(1, 0, 0, 1, -origin.x, -origin.y);
	},


	/**
	* m00  m01  x - m00 * x - m01 * y
	* m10  m11  y - m10 * x - m11 * y
	* @param {Number}   angle
	* @param {L.Point=} origin
	* @return {L.Matrix}
	*/
	rotate: function(angle, origin) {
		var cos = Math.cos(angle);
		var sin = Math.sin(angle);

		origin = origin || new L.Point(0, 0);

		return this
			._add(cos, sin, -sin, cos, origin.x, origin.y)
			._add(1, 0, 0, 1, -origin.x, -origin.y);
	},


	/**
	* Invert rotation
	* @return {L.Matrix}
	*/
	flip: function() {
		this._matrix[1] *= -1;
		this._matrix[2] *= -1;
		return this;
	},


	/**
	* @param {Number|L.Matrix} a
	* @param {Number} b
	* @param {Number} c
	* @param {Number} d
	* @param {Number} e
	* @param {Number} f
	*/
	_add: function(a, b, c, d, e, f) {
		var result = [[], [], []];
		var src = this._matrix;
		var m = [
			[src[0], src[2], src[4]],
			[src[1], src[3], src[5]],
			[     0,      0,     1]
		];
		var other = [
			[a, c, e],
			[b, d, f],
			[0, 0, 1]
		], val;


		if (a && a instanceof L.Matrix) {
			src = a._matrix;
			other = [
				[src[0], src[2], src[4]],
				[src[1], src[3], src[5]],
				[     0,      0,     1]];
		}

		for (var i = 0; i < 3; i++) {
			for (var j = 0; j < 3; j++) {
				val = 0;
				for (var k = 0; k < 3; k++) {
					val += m[i][k] * other[k][j];
				}
				result[i][j] = val;
			}
		}

		this._matrix = [
			result[0][0], result[1][0], result[0][1],
			result[1][1], result[0][2], result[1][2]
		];
		return this;
	}


};


L.matrix = function(a, b, c, d, e, f) {
	return new L.Matrix(a, b, c, d, e, f);
};
