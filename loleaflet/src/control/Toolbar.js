/* -*- js-indent-level: 8 -*- */
/*
 * Toolbar handler
 */

/* global $ window vex sanitizeUrl brandProductName brandProductURL _ Hammer */
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

		id = id || 'export'; // not any special download, simple export

		if ((id === 'print' && this['wopi'].DisablePrint) ||
			(id === 'export' && this['wopi'].DisableExport)) {
			this.hideBusy();
			return;
		}

		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		if (!window.ThisIsAMobileApp)
			this.showBusy(_('Downloading...'), false);
		this._socket.sendMessage('downloadas ' +
			'name=' + encodeURIComponent(name) + ' ' +
			'id=' + id + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	print: function () {
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			window.postMobileMessage('PRINT');
		} else {
			this.showBusy(_('Downloading...'), false);
			this.downloadAs('print.pdf', 'pdf', null, 'print');
		}
	},

	saveAs: function (url, format, options) {
		if (url === undefined || url == null) {
			return;
		}
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		this.showBusy(_('Saving...'), false);
		this._socket.sendMessage('saveas ' +
			'url=wopi:' + encodeURIComponent(url) + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	renameFile: function (filename) {
		if (!filename) {
			return;
		}
		this.showBusy(_('Renaming...'), false);
		this._socket.sendMessage('renamefile filename=' + encodeURIComponent(filename));
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

	save: function(dontTerminateEdit, dontSaveIfUnmodified, extendedData) {
		var msg = 'save' +
					' dontTerminateEdit=' + (dontTerminateEdit ? 1 : 0) +
					' dontSaveIfUnmodified=' + (dontSaveIfUnmodified ? 1 : 0);

		if (extendedData !== undefined) {
			msg += ' extendedData=' + extendedData;
		}

		this._socket.sendMessage(msg);
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

	insertURL: function (url) {
		this.fire('inserturl', {url: url});
	},

	selectBackground: function (file) {
		this.fire('selectbackground', {file: file});
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

	showHelp: function(id) {
		var w;
		var iw = window.innerWidth;
		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}
		var map = this;
		$.get('loleaflet-help.html', function(data) {
			var productName;
			if (window.ThisIsAMobileApp) {
				productName = window.MobileAppName;
			} else {
				productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'LibreOffice Online';
			}
			vex.open({
				unsafeContent: data,
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				closeAllOnPopState: false,
				buttons: {},
				afterOpen: function() {
					var $vexContent = $(this.contentEl);
					this.contentEl.style.width = w + 'px';
					map.enable(false);
					var i;
					// Display keyboard shortcut or online help
					if (id === 'keyboard-shortcuts') {
						document.getElementById('online-help').style.display='none';
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
					} else /* id === 'online-help' */ {
						document.getElementById('keyboard-shortcuts').style.display='none';
						// Display help according to document opened
						if (map.getDocType() === 'text') {
							var x = document.getElementsByClassName('text');
							for (i = 0; i < x.length; i++) {
								x[i].style.display = 'block';
							}
						}
						else if (map.getDocType() === 'spreadsheet') {
							x = document.getElementsByClassName('spreadsheet');
							for (i = 0; i < x.length; i++) {
								x[i].style.display = 'block';
							}
						}
						else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
							x = document.getElementsByClassName('presentation');
							for (i = 0; i < x.length; i++) {
								x[i].style.display = 'block';
							}
						}
					}

					// Let's translate
					var max;
					var translatableContent = $vexContent.find('h1');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('h2');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('h3');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('h4');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('td');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('p');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}
					translatableContent = $vexContent.find('a'); // TOC
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
					}

					// Substitute %productName in Online Help
					if (id === 'online-help') {
						var productNameContent = $vexContent.find('span.productname');
						for (i = 0, max = productNameContent.length; i < max; i++) {
							productNameContent[i].innerHTML = productNameContent[i].innerHTML.replace(/%productName/g, productName);
						}
					}

					// Special Mac key names
					if (navigator.appVersion.indexOf('Mac') != -1 || navigator.userAgent.indexOf('Mac') != -1) {
						var ctrl = /Ctrl/g;
						var alt = /Alt/g;
						if (String.locale.startsWith('de') || String.locale.startsWith('dsb') || String.locale.startsWith('hsb')) {
							ctrl = /Strg/g;
						}
						if (String.locale.startsWith('lt')) {
							ctrl = /Vald/g;
						}
						if (String.locale.startsWith('sl')) {
							ctrl = /Krmilka/gi;
							alt = /Izmenjalka/gi;
						}
						if (id === 'keyboard-shortcuts') {
							document.getElementById('keyboard-shortcuts').innerHTML = document.getElementById('keyboard-shortcuts').innerHTML.replace(ctrl, '⌘').replace(alt, '⌥');
						}
						if (id === 'online-help') {
							document.getElementById('online-help').innerHTML = document.getElementById('online-help').innerHTML.replace(ctrl, '⌘').replace(alt, '⌥');
						}
					}

					$vexContent.attr('tabindex', -1);
					$vexContent.focus();
					// workaround for https://github.com/HubSpot/vex/issues/43
					$('.vex-overlay').css({ 'pointer-events': 'none'});
				},
				beforeClose: function () {
					map.focus();
					map.enable(true);
				}
			});
		});
	},

	// show the actual welcome dialog with the given data
	_showWelcomeDialogVex: function(data) {
		var w;
		var iw = window.innerWidth;
		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}

		// show the dialog
		var map = this;
		vex.open({
			unsafeContent: data,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			closeAllOnPopState: false,
			buttons: {},
			afterOpen: function() {
				var $vexContent = $(this.contentEl);
				this.contentEl.style.width = w + 'px';
				map.enable(false);

				$vexContent.attr('tabindex', -1);
				$vexContent.focus();
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				map.focus();
				map.enable(true);
			}
		});
	},

	showWelcomeDialog: function(calledFromMenu) {
		console.log('showWelcomeDialog, calledFromMenu: ' + calledFromMenu);
		var welcomeLocation = 'welcome/welcome-' + String.locale + '.html';

		// try to load the welcome message
		var map = this;
		$.get(welcomeLocation)
			.done(function(data) {
				map._showWelcomeDialogVex(data);
				if (!calledFromMenu) {
					var WSDVerCookie = 'WSDWelcomeVersion=' + map._socket.WSDServer.Version;
					// Cookie will not expire for a year, and it will not be sent to other domains
					WSDVerCookie += '; max-age=31536000; SameSite=Strict';
					document.cookie = WSDVerCookie;
				}
			})
			.fail(function() {
				// Welcome dialog disabled in loolwsd.xml or nonexistant for some other reason
				// Let's check back in a day (60 x 60 x 24 = 86400 seconds)
				var welcomeDisabledCookie = 'WSDWelcomeDisabled=true; max-age=86400; SameSite=Strict';
				document.cookie = welcomeDisabledCookie;

				if (calledFromMenu)
					map._showWelcomeDialogVex(_('We are sorry, the information about the latest updates is not available.'));
			});
	},

	getCookie: function(name) {
		var cookies = document.cookie.split(';');
		for (var i = 0; i < cookies.length; i++) {
			var cookie = cookies[i].trim();
			if (cookie.indexOf(name) === 0) {
				return cookie;
			}
		}

		return '';
	},

	shouldWelcome: function() {
		if (!window.enableWelcomeMessage || L.Browser.cypressTest)
			return false;

		var currentVerCookie = this.getCookie('WSDWelcomeVersion');
		var newVerCookie = 'WSDWelcomeVersion=' + this._socket.WSDServer.Version;
		var welcomeDisabledCookie = this.getCookie('WSDWelcomeDisabled');
		var isWelcomeDisabled = welcomeDisabledCookie === 'WSDWelcomeDisabled=true';

		if (currentVerCookie !== newVerCookie && !isWelcomeDisabled) {
			return true;
		}

		return false;
	},

	showLOAboutDialog: function() {
		// Move the div sitting in 'body' as vex-content and make it visible
		var content = $('#about-dialog').clone().css({display: 'block'});
		// fill product-name and product-string
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'LibreOffice Online';
		}
		var productURL = (typeof brandProductURL !== 'undefined') ? brandProductURL : 'https://libreoffice.org';
		content.find('#product-name').text(productName);
		var productString = _('This version of %productName is powered by');
		var productNameWithURL;
		if (!window.ThisIsAMobileApp)
			productNameWithURL = '<a href="' + sanitizeUrl.sanitizeUrl(productURL) +
								 '" target="_blank">' + productName + '</a>';
		else
			productNameWithURL = productName;
		content.find('#product-string').html(productString.replace('%productName', productNameWithURL));

		var w;
		var iw = window.innerWidth;
		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}
		var map = this;
		var handler = function(event) {
			if (event.keyCode === 68) {
				map._docLayer.toggleTileDebugMode();
			}
		};
		vex.open({
			unsafeContent: content[0].outerHTML,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			buttons: {},
			afterOpen: function() {

				var touchGesture = map['touchGesture'];
				if (touchGesture && touchGesture._hammer) {
					touchGesture._hammer.off('tripletap', L.bind(touchGesture._onTripleTap, touchGesture));
				}

				var $vexContent = $(this.contentEl);
				var hammer = new Hammer.Manager($vexContent.get(0));
				hammer.add(new Hammer.Tap({ taps: 3 }));
				hammer.on('tap', function() {
					map._docLayer.toggleTileDebugMode();
				});

				this.contentEl.style.width = w + 'px';

				map.enable(false);
				$(window).bind('keyup.vex', handler);
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				$(window).unbind('keyup.vex', handler);
				var touchGesture = map['touchGesture'];
				if (touchGesture && touchGesture._hammer) {
					touchGesture._hammer.on('tripletap', L.bind(touchGesture._onTripleTap, touchGesture));
				}
				map.enable(true);
				map.focus();
			}
		});
	},

	extractContent: function(html) {
		var parser = new DOMParser;
		return parser.parseFromString(html, 'text/html').documentElement.getElementsByTagName('body')[0].textContent;
	},

	makeURLFromStr: function(str) {
		if (!(str.toLowerCase().startsWith('http://') || str.toLowerCase().startsWith('https://'))) {
			str = 'http://' + str;
		}
		return str;
	},

	showHyperlinkDialog: function() {
		var map = this;
		var text = '';
		var link = '';
		if (this.hyperlinkUnderCursor && this.hyperlinkUnderCursor.text && this.hyperlinkUnderCursor.link) {
			text = this.hyperlinkUnderCursor.text;
			link = this.hyperlinkUnderCursor.link;
		} else if (this._clip && this._clip._selectionType == 'text') {
			text = this.extractContent(this._clip._selectionContent);
		} else if (this._docLayer._selectedTextContent) {
			text = this.extractContent(this._docLayer._selectedTextContent);
		}

		vex.dialog.open({
			contentClassName: 'hyperlink-dialog',
			message: _('Insert hyperlink'),
			input: [
				_('Text') + '<input name="text" type="text" value="' + text + '"/>',
				_('Link') + '<input name="link" type="text" value="' + link + '"/>'
			].join(''),
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
			callback: function(data) {
				if (data && data.link != '') {
					var command = {
						'Hyperlink.Text': {
							type: 'string',
							value: data.text
						},
						'Hyperlink.URL': {
							type: 'string',
							value: map.makeURLFromStr(data.link)
						}
					};
					map.sendUnoCommand('.uno:SetHyperlink', command);
					map.focus();
				}
			}
		});
	}
});
