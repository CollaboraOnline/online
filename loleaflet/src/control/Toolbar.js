/*
 * Toolbar handler
 */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: [
		'.uno:CharFontName',
		'.uno:StyleApply'
	],

	applyFont: function (fontName) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			L.Socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:FontHeight {' +
				'"FontHeight.Height": ' +
				'{"type": "float", "value": "' + fontSize + '"}}';
			L.Socket.sendMessage(msg);
		}
	},

	getToolbarCommandValues: function (command) {
		return this._docLayer._toolbarCommandValues[command];
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}
		L.Socket.sendMessage('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	setStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this._docLayer._permission === 'edit') {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			L.Socket.sendMessage(msg);
		}
	},

	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			L.Socket.sendMessage('uno .uno:' + unoState);
		}
	}
});
