/*
 * Toolbar handler
 */

/* global $ window */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: [
		'.uno:StyleApply',
		'.uno:CharFontName'
	],

	_modalDialogOptions: {
		overlayClose:true,
		opacity: 80,
		overlayCss: {
			backgroundColor : '#000'
		},
		containerCss: {
			overflow : 'hidden',
			backgroundColor : '#fff',
			padding : '20px',
			border : '2px solid #000'
		}
	},

	applyFont: function (fontName) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			this._socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:FontHeight {' +
				'"FontHeight.Height": ' +
				'{"type": "float", "value": "' + fontSize + '"}}';
			this._socket.sendMessage(msg);
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

		this.showBusy(_('Downloading...'), false);
		this._socket.sendMessage('downloadas ' +
			'name=' + name + ' ' +
			'id=' + id + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	print: function () {
		this.showBusy(_('Downloading...'), false);
		this.downloadAs('print.pdf', 'pdf', null, 'print');
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		this.showBusy(_('Saving...'), false);
		// TakeOwnership: we are performing a 'real' save-as, the document
		// is just getting a new place, ie. it will get the
		// '.uno:ModifiedStatus' upon completion.
		this._socket.sendMessage('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=TakeOwnership,' + options);
	},

	applyStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this._permission === 'edit') {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			this._socket.sendMessage(msg);
		}
	},

	applyLayout: function (layout) {
		if (!layout) {
			this.fire('error', {cmd: 'setLayout', kind: 'incorrectparam'});
			return;
		}
		if (this._permission === 'edit') {
			var msg = 'uno .uno:AssignLayout {' +
					'"WhatPage":{"type":"unsigned short", "value": "' + this.getCurrentPartNumber() + '"},' +
					'"WhatLayout":{"type":"unsigned short", "value": "' + layout + '"}' +
					'}';
			this._socket.sendMessage(msg);
		}
	},

	sendUnoCommand: function (command, json) {
		if (this._permission === 'edit') {
			this._socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this._permission === 'edit') {
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
			},
			'DontCommit': {
				type: 'boolean',
				value: true
			}
		};

		this.sendUnoCommand('.uno:EnterString ', command);
	},

	renderFont: function (fontName) {
		this._socket.sendMessage('renderfont font=' + window.encodeURIComponent(fontName));
	},

	showLOKeyboardHelp: function() {
		var w = window.innerWidth / 2;
		var h = window.innerHeight / 2;
		$.modal('<iframe src="/loleaflet/dist/loleaflet-help.html" width="' + w + '" height="' + h + '" style="border:0">',
		        this._modalDialogOptions);
	},

	showLOAboutDialog: function() {
		$('#about-dialog').modal(this._modalDialogOptions);
	}
});
