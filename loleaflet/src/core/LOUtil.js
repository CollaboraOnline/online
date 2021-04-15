/* -*- js-indent-level: 8 -*- */
/*
 * L.LOUtil contains various LO related utility functions used throughout the code
 */

L.LOUtil = {
	// Based on core.git's colordata.hxx: COL_AUTHOR1_DARK...COL_AUTHOR9_DARK
	// consisting of arrays of RGB values
	// Maybe move the color logic to separate file when it becomes complex
	darkColors: [
		[198, 146, 0],
		[6,  70, 162],
		[87, 157,  28],
		[105,  43, 157],
		[197,   0,  11],
		[0, 128, 128],
		[140, 132,  0],
		[53,  85, 107],
		[209, 118,   0]
	],

	startSpinner: function (spinnerCanvas, spinnerSpeed) {
		var spinnerInterval;
		spinnerCanvas.width = 50;
		spinnerCanvas.height = 50;

		var context = spinnerCanvas.getContext('2d');
		context.lineWidth = 8;
		context.strokeStyle = 'grey';
		var x = spinnerCanvas.width / 2;
		var y = spinnerCanvas.height / 2;
		var radius = y - context.lineWidth / 2;
		spinnerInterval = setInterval(function() {
			context.clearRect(0, 0, x * 2, y * 2);
			// Move to center
			context.translate(x, y);
			context.rotate(spinnerSpeed * Math.PI / 180);
			context.translate(-x, -y);
			context.beginPath();
			context.arc(x, y, radius, 0, Math.PI * 1.3);
			context.stroke();
		}, 30);

		return spinnerInterval;
	},

	getViewIdColor: function(viewId) {
		var color = this.darkColors[(viewId + 1) % this.darkColors.length];
		return (color[2] | (color[1] << 8) | (color[0] << 16));
	},

	rgbToHex: function(color) {
		return '#' + ('000000' + color.toString(16)).slice(-6);
	},

	stringToBounds: function(bounds) {
		var numbers = bounds.match(/\d+/g);
		var topLeft = L.point(parseInt(numbers[0]), parseInt(numbers[1]));
		var bottomRight = topLeft.add(L.point(parseInt(numbers[2]), parseInt(numbers[3])));
		return L.bounds(topLeft, bottomRight);
	},

	stringToRectangles: function(strRect) {
		var matches = strRect.match(/\d+/g);
		var rectangles = [];
		if (matches !== null) {
			for (var itMatch = 0; itMatch < matches.length; itMatch += 4) {
				var topLeft = L.point(parseInt(matches[itMatch]), parseInt(matches[itMatch + 1]));
				var size = L.point(parseInt(matches[itMatch + 2]), parseInt(matches[itMatch + 3]));
				var topRight = topLeft.add(L.point(size.x, 0));
				var bottomLeft = topLeft.add(L.point(0, size.y));
				var bottomRight = topLeft.add(size);
				rectangles.push([bottomLeft, bottomRight, topLeft, topRight]);
			}
		}
		return rectangles;
	},

	/// unwind things to get a good absolute URL
	getURL: function(path) {
		if (path === '')
			return '';
		if (window.host === '' && window.serviceRoot === '')
			return path; // mobile

		var realHost = window.host.replace(/^ws/i, 'http');
		var url = realHost + window.serviceRoot + '/loleaflet/' + window.versionPath;
		if (path.substr(0,1) !== '/')
			url += '/';
		url += path;
		return url;
	},

	getImageURL: function(imgName) {
		return this.getURL('images/' + imgName);
	},

	/// oldFileName = Example.odt, suffix = new
	/// returns: Example_new.odt
	generateNewFileName: function(oldFileName, suffix) {
		var idx = oldFileName.lastIndexOf('.');
		return oldFileName.substring(0, idx) + suffix + oldFileName.substring(idx);
	},

	commandWithoutIcon: [
		'InsertPageHeader',
		'InsertPageFooter',
		'None'
	],

	existsIconForCommand: function(command, docType) {
		var commandName = command.startsWith('.uno:') ? command.substring('.uno:'.length) : command;
		var res = !this.commandWithoutIcon.find(function (el) {
			return el.startsWith(commandName);
		});
		if (commandName.indexOf('?')!== -1) {
			if (commandName.indexOf('SpellCheckIgnore') !== -1 || commandName.indexOf('SpellCheckIgnoreAll') !== -1)
				return true;

			if ((docType === 'spreadsheet' || docType === 'presentation') &&
				commandName.indexOf('LanguageStatus') !== -1)
				return true;

			if (commandName === 'LanguageStatus?Language:string=Current_LANGUAGE_NONE' ||
				commandName === 'LanguageStatus?Language:string=Current_RESET_LANGUAGES' ||
				commandName === 'LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE' ||
				commandName === 'LanguageStatus?Language:string=Paragraph_RESET_LANGUAGES')
				return true;

			return false;
		}
		return res;
	},

	/// Searching in JSON trees for data with a given field
	findItemWithAttributeRecursive: function(node, idName, idValue) {
		var found = null;
		if (node[idName] === idValue)
			return node;
		if (node.children)
		{
			for (var i = 0; !found && i < node.children.length; i++)
				found = L.LOUtil.findItemWithAttributeRecursive(node.children[i], idName, idValue);
		}
		return found;
	},

	/// Searching in JSON trees for an identifier and return the index in parent
	findIndexInParentByAttribute: function(node, idName, idValue) {
		if (node.children)
		{
			for (var i = 0; i < node.children.length; i++)
				if (node.children[i][idName] === idValue)
					return i;
		}
		return -1;
	},

	/// Create a rectangle object which is working with core pixels.
	/// x1 and y1 should always <= x2 and y2. In other words width >= 0 && height >= 0 must be provided.
	/// This class doesn't check for above conditions. There is a isValid function for use when needed.
	/// One can always use built-in function to set the variables. If so, all the properties will be up to date.
	/// width, height, x1, y1, x2 and y2 should be treated like private variables.
	createRectangle: function (x, y, width, height) {
		var result = {};
		result.px = {};

		// Native values. User for calculations.
		result.x1 = x;
		result.y1 = y;
		result.width = width;
		result.height = height;
		result.x2 = result.x1 + width;
		result.y2 = result.y1 + height;
		result.area = width * height;

		// Rounded values. Use for drawings.
		result.px.x1 = Math.round(result.x1);
		result.px.y1 = Math.round(result.y1);
		result.px.width = Math.round(result.width);
		result.px.height = Math.round(result.height);
		result.px.x2 = result.px.x1 + result.px.width;
		result.px.y2 = result.px.y1 + result.px.height;
		result.px.area = result.px.width * result.px.height;

		result.isValid = function () {
			if (result.x1 <= result.x2 && result.y1 <= result.y2)
				return true;
			else
				return false;
		};

		result.clone = function () {
			return L.LOUtil.createRectangle(result.x1, result.y1, result.width, result.height);
		};

		result.containsPoint = function (x, y) {
			if (x >= result.x1 && x <= result.x2) {
				if (y >= result.y1 && y <= result.y2)
					return true;
				else
					return false;
			}
			else
				return false;
		};

		result.containsPixel = function (px, py) {
			if (px >= result.px.x1 && px <= result.px.x2) {
				if (py >= result.px.y1 && py <= result.px.y2)
					return true;
				else
					return false;
			}
			else
				return false;
		};

		result.containsXOrdinate = function (ox) {
			if (ox >= result.x1 && ox <= result.x2)
				return true;
			else
				return false;
		};

		result.containsYOrdinate = function (oy) {
			if (oy >= result.y1 && oy <= result.y2)
				return true;
			else
				return false;
		};

		result.containsPixelOrdinateX = function (ox) {
			if (ox >= result.px.x1 && ox <= result.px.x2)
				return true;
			else
				return false;
		};

		result.containsPixelOrdinateY = function (oy) {
			if (oy >= result.px.y1 && oy <= result.px.y2)
				return true;
			else
				return false;
		};

		result.calculatePx = function () {
			result.px.x1 = Math.round(result.x1);
			result.px.x2 = Math.round(result.x2);
			result.px.y1 = Math.round(result.y1);
			result.px.y2 = Math.round(result.y2);

			result.px.width = result.px.x2 - result.px.x1;
			result.px.height = result.px.y2 - result.px.y1;
			result.px.area = result.px.width * result.px.height;
		};

		result.setX1 = function (x1) {
			result.x1 = x1;
			result.width = result.x2 - result.x1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setX2 = function (x2) {
			result.x2 = x2;
			result.width = result.x2 - result.x1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setY1 = function (y1) {
			result.y1 = y1;
			result.height = result.y2 - result.y1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setY2 = function (y2) {
			result.y2 = y2;
			result.height = result.y2 - result.y1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setWidth = function (width) {
			result.x2 = result.x1 + width;
			result.width = result.x2 - result.x1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setHeight = function (height) {
			result.y2 = result.y1 + height;
			result.height = result.y2 - result.y1;
			result.area = result.width * result.height;

			result.calculatePx();
		};

		result.setArea = function (area, preserveHeight) {
			if (!preserveHeight) {
				var height = area / result.width;
				result.setHeight(height);
			}
			else {
				var width = area / result.height;
				result.setWidth(width);
			}
		};

		result.moveBy = function (x, y) {
			result.x1 += x;
			result.x2 += x;
			result.y1 += y;
			result.y2 += y;

			result.calculatePx();
		};

		result.moveTo = function (x, y) {
			result.x1 = x;
			result.x2 = result.x1 + result.width;
			result.y1 = y;
			result.y2 = result.y1 + result.height;

			result.calculatePx();
		};

		result.getX1 = function () {
			return result.x1;
		};

		result.getX2 = function () {
			return result.x2;
		};

		result.getY1 = function () {
			return result.y1;
		};

		result.getY2 = function () {
			return result.y2;
		};

		result.getWidth = function () {
			return result.width;
		};

		result.getHeight = function () {
			return result.height;
		};

		result.getArea = function () {
			return result.area;
		};

		result.getCenter = function () {
			return [(result.x2 + result.x1) / 2, (result.y2 + result.y1) / 2];
		};

		result.getPxX1 = function () {
			return result.px.x1;
		};

		result.getPxX2 = function () {
			return result.px.x2;
		};

		result.getPxY1 = function () {
			return result.px.y1;
		};

		result.getPxY2 = function () {
			return result.px.y2;
		};

		result.getPxWidth = function () {
			return result.px.width;
		};

		result.getPxHeight = function () {
			return result.px.height;
		};

		result.getPxArea = function () {
			return result.px.area;
		};

		result.getPxCenter = function () {
			return [Math.round((result.px.x2 + result.px.x1) / 2), Math.round((result.px.y2 + result.px.y1) / 2)];
		};

		return result;
	}
};
