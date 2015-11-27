/*
 * Toolbar handler
 */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: [
		'.uno:StyleApply',
		'.uno:CharFontName'
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

	downloadAs: function (name, format, options, id) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}
		id = id || -1; // not a special download
		L.Socket.sendMessage('downloadas ' +
			'name=' + name + ' ' +
			'id=' + id + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	print: function () {
		this.downloadAs('print.pdf', 'pdf', null, 'print');
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

	applyStyle: function (style, familyName) {
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

	sendUnoCommand: function (command, json) {
		if (this._docLayer._permission === 'edit') {
			L.Socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			if (!unoState.startsWith('.uno:')) {
				unoState = '.uno:' + unoState;
			}
			this.sendUnoCommand(unoState);
		}
	},

	insertFile: function (file) {
		this.fire('insertfile', {file: file});
	},

	cellEnterString: function (string) {
		var command = {
			'StringName': {
				type: 'string',
				value: string
			}
		};
		L.Socket.sendMessage('uno .uno:EnterString ' + JSON.stringify(command));
	},

	renderFont: function (fontName) {
		L.Socket.sendMessage('renderfont font=' + window.encodeURIComponent(fontName));
	}
});
