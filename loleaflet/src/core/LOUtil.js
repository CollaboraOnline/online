/* -*- js-indent-level: 8 -*- */
/* global getParameterByName */
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

	stringToPoint: function(point) {
		var numbers = point.match(/\d+/g);
		return L.point(parseInt(numbers[0]), parseInt(numbers[1]));
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
	}
};

L.Params = {
	/// Shows close button if non-zero value provided
	closeButtonEnabled: getParameterByName('closebutton'),

	/// Shows revision history file menu option
	revHistoryEnabled: getParameterByName('revisionhistory'),
};
