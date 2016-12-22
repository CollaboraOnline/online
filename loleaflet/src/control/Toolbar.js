/*
 * Toolbar handler
 */

/* global $ window vex brandProductName */
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
		if (this._docLayer) {
			return this._docLayer._toolbarCommandValues[command];
		}

		return undefined;
	},

	downloadAs: function (name, format, options, id) {
		if (this._fatal) {
			return;
		}

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

	save: function(dontTerminateEdit, dontSaveIfUnmodified) {
		var args = {
			DontTerminateEdit: {
				type: 'boolean',
				value: !!dontTerminateEdit
			},
			DontSaveIfUnmodified: {
				type: 'boolean',
				value: !!dontSaveIfUnmodified
			}
		};
		this.sendUnoCommand('.uno:Save', args);
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
		$.get('/loleaflet/dist/loleaflet-help.html', function(data) {
			vex.open({
				content: data,
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				contentCSS: {width: w + 'px'},
				buttons: {},
				afterOpen: function($vexContent) {
					// Display help according to document opened
					if (map.getDocType() === 'text') {
						document.getElementById('text-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'spreadsheet') {
						document.getElementById('spreadsheet-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
						document.getElementById('presentation-shortcuts').style.display='block';
					}

					// Lets transalte
					var i, max;
					var translatableContent = $vexContent.find('h1');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}
					translatableContent = $vexContent.find('h2');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}
					translatableContent = $vexContent.find('td');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}

					$('.vex-content').attr('tabindex', -1);
					$('.vex-content').focus();
					// workaround for https://github.com/HubSpot/vex/issues/43
					$('.vex-overlay').css({ 'pointer-events': 'none'});
					$('.vex').click(function() {
						vex.close($vexContent.data().vex.id);
					});
					$('.vex-content').click(function(e) {
						e.stopPropagation();
					});
				},
				beforeClose: function () {
					map.focus();
				}
			});
		});
	},

	showLOAboutDialog: function() {
		// Move the div sitting in 'body' as vex-content and make it visible
		var content = $('#about-dialog').clone().css({display: 'block'});
		// fill product-name and product-string
		var productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'LibreOffice Online';
		content.find('#product-name').text(productName);
		var productString = _('This version of %productName is powered by');
		content.find('#product-string').text(productString.replace('%productName', productName));
		var w = window.innerWidth / 2;
		vex.open({
			content: content,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			contentCSS: { width: w + 'px'},
			buttons: {},
			afterOpen: function($vexContent) {
				map.enable(false);
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
				$('.vex').click(function() {
					vex.close($vexContent.data().vex.id);
				});
				$('.vex-content').click(function(e) {
					e.stopPropagation();
				});
			},
			beforeClose: function () {
				map.enable(true);
			}
		});
	}
});
