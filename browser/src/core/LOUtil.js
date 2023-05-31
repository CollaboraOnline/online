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

	// https://stackoverflow.com/a/32726412
	onRemoveHTMLElement: function(element, onDetachCallback) {
		var observer = new MutationObserver(function () {
			function isDetached(el) {
				return !el.closest('html');
			}

			if (isDetached(element)) {
				onDetachCallback();
				observer.disconnect();
			}
		});

		observer.observe(document, {
			 childList: true,
			 subtree: true
		});
	},

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
			return path; // mobile app

		var url = window.makeHttpUrl('/browser/' + window.versionPath);
		if (path.substr(0,1) !== '/')
			url += '/';
		url += path;
		return url;
	},
	setImage: function(img, name, doctype) {
		img.src = this.getImageURL(name, doctype);
		this.checkIfImageExists(img);
	},
	getImageURL: function(imgName, docType) {
		var defaultImageURL = this.getURL('images/' + imgName);
		if (window.isLocalStorageAllowed) {
			var state = localStorage.getItem('UIDefaults_' + docType + '_darkTheme');
			if ((state && (/true/).test(state.toLowerCase())) || (state === null &&  window.uiDefaults['darkTheme'])) {
				return this.getURL('images/dark/' + imgName);
			}
		}
		return defaultImageURL;
	},
	checkIfImageExists : function(imageElement) {
		imageElement.addEventListener('error', function() {
			if (imageElement.src && imageElement.src.includes('images/branding/dark')) {
				imageElement.src = imageElement.src.replace('images/branding/dark', 'images/dark');
				return;
			}
			if (imageElement.src && (imageElement.src.includes('images/dark')|| imageElement.src.includes('images/branding'))) {
				imageElement.src = imageElement.src.replace('images/dark', 'images');
				imageElement.src = imageElement.src.replace('images/branding', 'images');
				return;
			}
			imageElement.style.display = 'none';
			});
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

	_doRectanglesIntersect: function (rectangle1, rectangle2) { // Format: (x, y, w, h).
		// Don't use equality in comparison, that's not an intersection.
		if (Math.abs((rectangle1[0] + rectangle1[2] * 0.5) - (rectangle2[0] + rectangle2[2] * 0.5)) < rectangle1[2] + rectangle2[2]) {
			if (Math.abs((rectangle1[1] + rectangle1[3] * 0.5) - (rectangle2[1] + rectangle2[3] * 0.5)) < rectangle1[3] + rectangle2[3])
				return true;
			else
				return false;
		}
		else
			return false;
	},

	// Returns the intersecting area of 2 rectangles. Rectangle format: (x, y, w, h). Return format is the same or null.
	_getIntersectionRectangle: function (rectangle1, rectangle2) {
		if (this._doRectanglesIntersect(rectangle1, rectangle2)) {
			var x = (rectangle1[0] > rectangle2[0] ? rectangle1[0]: rectangle2[0]);
			var y = (rectangle1[1] > rectangle2[1] ? rectangle1[1]: rectangle2[1]);
			var w = (rectangle1[0] + rectangle1[2] < rectangle2[0] + rectangle2[2] ? rectangle1[0] + rectangle1[2] - x: rectangle2[0] + rectangle2[2] - x);
			var h = (rectangle1[1] + rectangle1[3] < rectangle2[1] + rectangle2[3] ? rectangle1[1] + rectangle1[3] - y: rectangle2[1] + rectangle2[3] - y);

			return [x, y, w, h];
		}
		else
			return null;
	},

	getFileExtension: function (map) {
		var filename = map['wopi'].BaseFileName;
		return filename.substring(filename.lastIndexOf('.') + 1);
	},

	isFileODF: function (map) {
		var ext = this.getFileExtension(map);
		return ext === 'odt' || ext === 'ods' || ext === 'odp' || ext == 'odg';
	}
};
