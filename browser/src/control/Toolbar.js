/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Toolbar handler
 */

/* global app $ window sanitizeUrl brandProductName brandProductURL _ */
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

	onFontSelect: function(e) {
		var font = e.target.value;
		this.applyFont(font);
		this.focus();
	},

	_getCurrentFontName: function() {
		return this['stateChangeHandler'].getItemValue('.uno:CharFontName');
	},

	createFontSelector: function(nodeSelector) {
		var that = this;

		var fontcombobox = $(nodeSelector);
		if (!fontcombobox.hasClass('select2')) {
			fontcombobox.select2({
				placeholder: _('Font')
			});
		}

		var createSelector = function() {
			var commandValues = that.getToolbarCommandValues('.uno:CharFontName');

			var data = []; // reset data in order to avoid that the font select box is populated with styles, too.
			// Old browsers like IE11 et al don't like Object.keys with
			// empty arguments
			if (typeof commandValues === 'object') {
				data = data.concat(Object.keys(commandValues));
			}
			fontcombobox.empty();
			for (var i = 0; i < data.length; ++i) {
				if (!data[i]) continue;
				var option = document.createElement('option');
				option.text = data[i];
				option.value = data[i];
				fontcombobox.append(option);
			}
			fontcombobox.on('select2:select', that.onFontSelect.bind(that));

			fontcombobox.val(that._getCurrentFontName()).trigger('change');
		};

		createSelector();

		var onCommandStateChanged = function(e) {
			var commandName = e.commandName;

			if (commandName !== '.uno:CharFontName')
				return;

			var state = e.state;
			var found = false;
			fontcombobox.children('option').each(function () {
				var value = this.value;
				if (value.toLowerCase() === state.toLowerCase()) {
					found = true;
					return;
				}
			});

			if (!found && state) {
				fontcombobox
					.append($('<option></option>')
						.text(state));
			}

			fontcombobox.val(state).trigger('change');
		};

		var onFontListChanged = function(e) {
			if (e.commandName === '.uno:CharFontName')
				createSelector();
		};

		this.off('commandstatechanged', onCommandStateChanged);
		this.on('commandstatechanged', onCommandStateChanged);
		this.off('updatetoolbarcommandvalues', onFontListChanged);
		this.on('updatetoolbarcommandvalues', onFontListChanged);
	},

	onFontSizeSelect: function(e) {
		this.applyFontSize(e.target.value);
		this.focus();
	},

	createFontSizeSelector: function(nodeSelector) {
		var data = [6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20,
			22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];

		var fontsizecombobox = $(nodeSelector);
		if (!fontsizecombobox.hasClass('select2')) {
			fontsizecombobox.select2({
				dropdownAutoWidth: true,
				width: 'auto',
				placeholder: _('Font Size'),
				//Allow manually entered font size.
				createTag: function(query) {
					return {
						id: query.term,
						text: query.term,
						tag: true
					};
				},
				tags: true,
				sorter: function(data) { return data.sort(function(a, b) {
					return parseFloat(a.text) - parseFloat(b.text);
				});}
			});
		}

		fontsizecombobox.empty();
		for (var i = 0; i < data.length; ++i) {
			var option = document.createElement('option');
			option.text = data[i];
			option.value = data[i];
			fontsizecombobox.append(option);
		}
		fontsizecombobox.off('select2:select', this.onFontSizeSelect.bind(this)).on('select2:select', this.onFontSizeSelect.bind(this));

		var onCommandStateChanged = function(e) {
			var commandName = e.commandName;

			if (commandName !== '.uno:FontHeight')
				return;

			var state = e.state;
			var found = false;

			if (state === '0') {
				state = '';
			}

			fontsizecombobox.children('option').each(function (i, e) {
				if ($(e).text() === state) {
					found = true;
				}
			});

			if (!found) {
				// we need to add the size
				fontsizecombobox
					.append($('<option>')
						.text(state).val(state));
			}

			fontsizecombobox.val(state).trigger('change');
		};

		this.off('commandstatechanged', onCommandStateChanged);
		this.on('commandstatechanged', onCommandStateChanged);
	},

	applyFont: function (fontName) {
		if (!fontName)
			return;
		if (this.isEditMode()) {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			app.socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.isEditMode()) {
			var msg = 'uno .uno:FontHeight {' +
				'"FontHeight.Height": ' +
				'{"type": "float", "value": "' + fontSize + '"}}';
			app.socket.sendMessage(msg);
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

		// printing: don't export form fields, irrelevant, and can be buggy
		// comments are irrelevant, too
		if (id === 'print' && format === 'pdf' && options === '')
			options = '{\"ExportFormFields\":{\"type\":\"boolean\",\"value\":\"false\"},' +
						'\"ExportNotes\":{\"type\":\"boolean\",\"value\":\"false\"}}';

		// download: don't export comments into PDF by default
		if (id == 'export' && format === 'pdf' && options === '')
			options = '{\"ExportNotes\":{\"type\":\"boolean\",\"value\":\"false\"}}';

		if (!window.ThisIsAMobileApp)
			this.showBusy(_('Downloading...'), false);

		app.socket.sendMessage('downloadas ' +
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
		app.socket.sendMessage('saveas ' +
			'url=wopi:' + encodeURIComponent(url) + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	exportAs: function (url) {
		if (url === undefined || url == null) {
			return;
		}

		app.socket.sendMessage('exportas url=wopi:' + encodeURIComponent(url));
	},

	renameFile: function (filename) {
		if (!filename) {
			return;
		}
		this.showBusy(_('Renaming...'), false);
		app.socket.sendMessage('renamefile filename=' + encodeURIComponent(filename));
	},

	applyStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this.isEditMode()) {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			app.socket.sendMessage(msg);
		}
	},

	applyLayout: function (layout) {
		if (!layout) {
			this.fire('error', {cmd: 'setLayout', kind: 'incorrectparam'});
			return;
		}
		if (this.isEditMode()) {
			var msg = 'uno .uno:AssignLayout {' +
					'"WhatPage":{"type":"unsigned short", "value": "' + this.getCurrentPartNumber() + '"},' +
					'"WhatLayout":{"type":"unsigned short", "value": "' + layout + '"}' +
					'}';
			app.socket.sendMessage(msg);
		}
	},

	save: function(dontTerminateEdit, dontSaveIfUnmodified, extendedData) {
		var msg = 'save' +
					' dontTerminateEdit=' + (dontTerminateEdit ? 1 : 0) +
					' dontSaveIfUnmodified=' + (dontSaveIfUnmodified ? 1 : 0);

		if (extendedData !== undefined) {
			msg += ' extendedData=' + extendedData;
		}

		app.socket.sendMessage(msg);
	},

	messageNeedsToBeRedirected: function(command) {
		if (command === '.uno:EditHyperlink') {
			var that = this;
			setTimeout(function () { that.showHyperlinkDialog(); }, 500);
			return true;
		}
		else {
			return false;
		}
	},

	sendUnoCommand: function (command, json, force) {
		if ((command.startsWith('.uno:Sidebar') && !command.startsWith('.uno:SidebarShow')) ||
			command.startsWith('.uno:SlideChangeWindow') || command.startsWith('.uno:CustomAnimation') ||
			command.startsWith('.uno:MasterSlidesPanel') || command.startsWith('.uno:ModifyPage') ||
			command.startsWith('.uno:Navigator')) {

			// sidebar control is present only in desktop/tablet case
			if (this.sidebar) {
				if (this.sidebar.isVisible()) {
					this.sidebar.setupTargetDeck(command);
				} else {
					// we don't know which deck was active last, show first then switch if needed
					app.socket.sendMessage('uno .uno:SidebarShow');

					this.sidebar.setupTargetDeck(command);
					return;
				}
			}
		}

		// To exercise the Trace Event functionality, uncomment this
		// app.socket.emitInstantTraceEvent('cool-unocommand:' + command);

		var isAllowedInReadOnly = false;
		var allowedCommands = ['.uno:Save', '.uno:WordCountDialog',
			'.uno:Signature', '.uno:ShowResolvedAnnotations',
			'.uno:ToolbarMode?Mode:string=notebookbar_online.ui', '.uno:ToolbarMode?Mode:string=Default'];
		if (this.isPermissionEditForComments()) {
			allowedCommands.push('.uno:InsertAnnotation','.uno:DeleteCommentThread', '.uno:DeleteAnnotation', '.uno:DeleteNote',
				'.uno:DeleteComment', '.uno:ReplyComment', '.uno:ReplyToAnnotation', '.uno:ResolveComment',
				'.uno:ResolveCommentThread', '.uno:ResolveComment', '.uno:EditAnnotation', '.uno:ExportToEPUB', '.uno:ExportToPDF');
		}

		for (var i in allowedCommands) {
			if (allowedCommands[i] === command) {
				isAllowedInReadOnly = true;
				break;
			}
		}
		if (command.startsWith('.uno:SpellOnline')) {
			var map = this;
			var val = map['stateChangeHandler'].getItemValue('.uno:SpellOnline');

			// proceed if the toggle button is pressed
			if (val && (json === undefined || json === null)) {
				 // because it is toggle, state has to be the opposite
				var state = !(val === 'true');
				if (window.isLocalStorageAllowed)
					window.localStorage.setItem('SpellOnline', state);
			}
		}

		if (this.uiManager.isUIBlocked())
			return;
		if ((this.dialog.hasOpenedDialog() || (this.jsdialog && this.jsdialog.hasDialogOpened()))
			&& !command.startsWith('.uno:ToolbarMode') && !force) {
			console.debug('Cannot execute: ' + command + ' when dialog is opened.');
			this.dialog.blinkOpenDialog();
		} else if (this.isEditMode() || isAllowedInReadOnly) {
			if (!this.messageNeedsToBeRedirected(command))
				app.socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this.isEditMode()) {
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

	onHelpOpen: function(id, map, productName) {
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
			else if (map.getDocType() === 'presentation') {
				document.getElementById('presentation-shortcuts').style.display='block';
			}
			else if (map.getDocType() === 'drawing') {
				document.getElementById('drawing-shortcuts').style.display='block';
			}
		} else /* id === 'online-help' */ {
			document.getElementById('keyboard-shortcuts').style.display='none';
			if (window.socketProxy) {
				var helpdiv = document.getElementById('online-help');
				var imgList = helpdiv.querySelectorAll('img');
				for (var p = 0; p < imgList.length; p++) {
					var imgSrc = imgList[p].src;
					imgSrc = imgSrc.substring(imgSrc.indexOf('/images'));
					imgList[p].src = window.makeWsUrl('/browser/dist'+ imgSrc);
				}
			}
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

		var contentElement = document.getElementById(id);

		// Let's translate
		var max;
		var translatableContent = contentElement.querySelectorAll('h1');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}
		translatableContent = contentElement.querySelectorAll('h2');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}
		translatableContent = contentElement.querySelectorAll('h3');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}
		translatableContent = contentElement.querySelectorAll('h4');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}
		translatableContent = contentElement.querySelectorAll('td');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			var orig = translatableContent[i].innerHTML;
			var trans = translatableContent[i].innerHTML.toLocaleString();
			// Try harder to get translation of keyboard shortcuts (html2po trims starting <kbd> and ending </kbd>)
			if (orig === trans && orig.indexOf('kbd') != -1) {
				var trimmedOrig = orig.replace(/^(<kbd>)/,'').replace(/(<\/kbd>$)/,'');
				var trimmedTrans = trimmedOrig.toLocaleString();
				if (trimmedOrig !== trimmedTrans) {
					trans = '<kbd>' + trimmedTrans + '</kbd>';
				}
			}
			translatableContent[i].innerHTML = trans;
		}
		translatableContent = contentElement.querySelectorAll('p');
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}
		translatableContent = contentElement.querySelectorAll('button'); // TOC
		for (i = 0, max = translatableContent.length; i < max; i++) {
			translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
		}

		//translatable screenshots
		var supportedLanguage = ['fr', 'it', 'de', 'es', 'pt-BR'];
		var currentLanguage = String.locale;
		if (supportedLanguage.indexOf(currentLanguage) >= 0) {
			translatableContent = $(contentElement.querySelectorAll('.screenshot')).querySelectorAll('img');
			for (i = 0, max = translatableContent.length; i < max; i++) {
				translatableContent[i].src = translatableContent[i].src.replace('/en/', '/'+currentLanguage+'/');
			}
		}

		// Substitute %productName in Online Help and replace special Mac key names
		if (id === 'online-help') {
			var productNameContent = contentElement.querySelectorAll('span.productname');
			for (i = 0, max = productNameContent.length; i < max; i++) {
				productNameContent[i].innerHTML = productNameContent[i].innerHTML.replace(/%productName/g, productName);
			}
			document.getElementById('online-help').innerHTML = L.Util.replaceCtrlAltInMac(document.getElementById('online-help').innerHTML);
		}
		if (id === 'keyboard-shortcuts') {
			document.getElementById('keyboard-shortcuts').innerHTML = L.Util.replaceCtrlAltInMac(document.getElementById('keyboard-shortcuts').innerHTML);
		}
	},

	_doOpenHelpFile: function(data, id, map) {
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition (unbranded)';
		}

		map.uiManager.showYesNoButton(id + '-box', productName, '', _('OK'), null, null, null, true);
		var box = document.getElementById(id + '-box');
		var innerDiv = L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.innerHTML = data;

		this.onHelpOpen(id, map, productName);
	},

	showHelp: function(id) {
		var map = this;
		if (window.ThisIsAMobileApp) {
			map._doOpenHelpFile(window.HelpFile, id, map);
			return;
		}
		var helpLocation = 'cool-help.html';
		if (window.socketProxy)
			helpLocation = window.makeWsUrl('/browser/dist/' + helpLocation);
		$.get(helpLocation, function(data) {
			map._doOpenHelpFile(data, id, map);
		});
	},

	aboutDialogKeyHandler: function(event) {
		if (event.key === 'd') {
			this._docLayer.toggleTileDebugMode();
		} else if (event.key === 'l') {
			// L toggges the Online logging level between the default (whatever
			// is set in coolwsd.xml or on the coolwsd command line) and the
			// most verbose a client is allowed to set (which also can be set in
			// coolwsd.xml or on the coolwsd command line).
			//
			// In a typical developer "make run" setup, the default is "trace"
			// so there is nothing more verbose. But presumably it is different
			// in production setups.

			app.socket.threadLocalLoggingLevelToggle = !app.socket.threadLocalLoggingLevelToggle;

			var newLogLevel = (app.socket.threadLocalLoggingLevelToggle ? 'verbose' : 'default');

			app.socket.sendMessage('loggingleveloverride ' + newLogLevel);

			var logLevelInformation;
			if (newLogLevel === 'default')
				logLevelInformation = 'default (from coolwsd.xml)';
			else if (newLogLevel === 'verbose')
				logLevelInformation = 'most verbose (from coolwsd.xml)';
			else if (newLogLevel === 'terse')
				logLevelInformation = 'least verbose (from coolwsd.xml)';
			else
				logLevelInformation = newLogLevel;

			console.debug('Log level: ' + logLevelInformation);
		}
	},

	aboutDialogClickHandler: function(event) {
		if (event.detail === 3)
			this._docLayer.toggleTileDebugMode();
	},

	showLOAboutDialog: function() {
		// Just as a test to exercise the Async Trace Event functionality, uncomment this
		// line and the asyncTraceEvent.finish() below.
		// var asyncTraceEvent = app.socket.createAsyncTraceEvent('cool-showLOAboutDialog');

		var aboutDialogId = 'about-dialog';
		// Move the div sitting in 'body' as content and make it visible
		var content = document.getElementById(aboutDialogId).cloneNode(true);
		content.style.display = 'block';

		// fill product-name and product-string
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition (unbranded)';
		}
		var productURL = (typeof brandProductURL !== 'undefined') ? brandProductURL : 'https://collaboraonline.github.io/';

		content.querySelector('#product-name').innerText = productName;
		content.classList.add('product-' + productName.split(/[ ()]+/).join('-').toLowerCase());

		var productString = _('This version of %productName is powered by');
		var productNameWithURL;
		if (!window.ThisIsAMobileApp)
			productNameWithURL = '<a href="' + sanitizeUrl(productURL) +
								 '" target="_blank">' + productName + '</a>';
		else
			productNameWithURL = productName;

		if (content.querySelector('#product-string'))
			content.querySelector('#product-string').innerText = productString.replace('%productName', productNameWithURL);

		if (window.socketProxy)
			content.querySelector('#slow-proxy').innerText = _('"Slow Proxy"');

		var map = this;

		map.uiManager.showYesNoButton(aboutDialogId + '-box', productName, '', _('OK'), null, null, null, true);
		var box = document.getElementById(aboutDialogId + '-box');
		var innerDiv = L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.innerHTML = content.outerHTML;

		var form = document.getElementById('modal-dialog-about-dialog-box');
		form.addEventListener('click', this.aboutDialogClickHandler.bind(this));
		form.addEventListener('keyup', this.aboutDialogKeyHandler.bind(this));
		form.querySelector('#coolwsd-version').querySelector('a').focus();
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

	_createAndRunHyperlinkDialog: function(defaultText, defaultLink) {
		var map = this;
		var id = 'hyperlink';
		var title = _('Insert hyperlink');

		var dialogId = 'modal-dialog-' + id;
		var json = map.uiManager._modalDialogJSON(id, title, true, [
			{
				id: 'hyperlink-text-box-label',
				type: 'fixedtext',
				text: _('Text'),
				labelFor: 'hyperlink-text-box'
			},
			{
				id: 'hyperlink-text-box',
				type: 'multilineedit',
				text: defaultText,
				labelledBy: 'hyperlink-text-box-label'
			},
			{
				id: 'hyperlink-link-box-label',
				type: 'fixedtext',
				text: _('Link'),
				labelFor: 'hyperlink-link-box'
			},
			{
				id: 'hyperlink-link-box',
				type: 'edit',
				text: defaultLink,
				labelledBy: 'hyperlink-link-box-label'
			},
			{
				type: 'buttonbox',
				enabled: true,
				children: [
					{
						id: 'response-cancel',
						type: 'pushbutton',
						text: _('Cancel'),
					},
					{
						id: 'response-ok',
						type: 'pushbutton',
						text: _('OK'),
						'has_default': true,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		], 'hyperlink-link-box');

		map.uiManager.showModal(json, [
			{id: 'response-ok', func: function() {
				var text = document.getElementById('hyperlink-text-box');
				var link = document.getElementById('hyperlink-link-box');

				if (link.value != '') {
					if (!text.value || text.value === '')
						text.value = link.value;

					var command = {
						'Hyperlink.Text': {
							type: 'string',
							value: text.value
						},
						'Hyperlink.URL': {
							type: 'string',
							value: map.makeURLFromStr(link.value)
						}
					};
					map.sendUnoCommand('.uno:SetHyperlink', command, true);
				}

				map.uiManager.closeModal(dialogId);
			}}
		]);
	},

	getTextForLink: function() {
		var map = this;
		var text = '';
		if (this.hyperlinkUnderCursor && this.hyperlinkUnderCursor.text) {
			text = this.hyperlinkUnderCursor.text;
		} else if (this._clip && this._clip._selectionType == 'text') {
			if (map['stateChangeHandler'].getItemValue('.uno:Copy') === 'enabled') {
				text = this.extractContent(this._clip._selectionContent);
			}
		} else if (this._docLayer._selectedTextContent) {
			text = this.extractContent(this._docLayer._selectedTextContent);
		}
		return text;
	},

	showHyperlinkDialog: function() {
		var text = this.getTextForLink();
		var link = '';
		if (this.hyperlinkUnderCursor && this.hyperlinkUnderCursor.link)
			link = this.hyperlinkUnderCursor.link;

		this._createAndRunHyperlinkDialog(text ? text.trim() : '', link);
	},

	openRevisionHistory: function () {
		var map = this;
		// if we are being loaded inside an iframe, ask
		// our host to show revision history mode
		map.fire('postMessage', {msgId: 'rev-history', args: {Deprecated: true}});
		map.fire('postMessage', {msgId: 'UI_FileVersions'});
	},
	openShare: function () {
		var map = this;
		map.fire('postMessage', {msgId: 'UI_Share'});
	},
	openSaveAs: function (format) {
		var map = this;
		map.fire('postMessage', {msgId: 'UI_SaveAs', args: {format: format}});
	},

	formulabarBlur: function() {
		if (!this.uiManager.isAnyDialogOpen())
			this.focus();
	},

	formulabarFocus: function() {
		this.formulabar.focus();
	},

	formulabarSetDirty: function() {
		if (this.formulabar)
			this.formulabar.dirty = true;
	},

	// map.dispatch() will be used to call some actions so we can share the code
	dispatch: function(action) {
		// Don't allow to execute new actions while any dialog is visible.
		// It prevents launching multiple instances of the same dialog.
		if (this.dialog.hasOpenedDialog() || (this.jsdialog && this.jsdialog.hasDialogOpened())) {
			this.dialog.blinkOpenDialog();
			console.debug('Cannot dispatch: ' + action + ' when dialog is opened.');
			return;
		}

		if (action.indexOf('saveas-') === 0) {
			var format = action.substring('saveas-'.length);
			this.openSaveAs(format);
			return;
		} else if (action.indexOf('downloadas-') === 0) {
			var format = action.substring('downloadas-'.length);
			var fileName = this['wopi'].BaseFileName;
			fileName = fileName.substr(0, fileName.lastIndexOf('.'));
			fileName = fileName === '' ? 'document' : fileName;
			this.downloadAs(fileName + '.' + format, format);
			return;
		} if (action.indexOf('exportas-') === 0) {
			var format = action.substring('exportas-'.length);
			this.openSaveAs(format);
			return;
		}

		switch (action) {
		case 'acceptformula':
			{
				if (window.mode.isMobile()) {
					this.focus();
					this._docLayer.postKeyboardEvent('input',
						this.keyboard.keyCodes.enter,
						this.keyboard._toUNOKeyCode(this.keyboard.keyCodes.enter));
				} else {
					this.sendUnoCommand('.uno:AcceptFormula');
				}

				this.onFormulaBarBlur();
				this.formulabarBlur();
				this.formulabarSetDirty();
			}
			break;
		case 'cancelformula':
			{
				this.sendUnoCommand('.uno:Cancel');
				this.onFormulaBarBlur();
				this.formulabarBlur();
				this.formulabarSetDirty();
			}
			break;
		case 'startformula':
			{
				this.sendUnoCommand('.uno:StartFormula');
				this.onFormulaBarFocus();
				this.formulabarFocus();
				this.formulabarSetDirty();
			}
			break;
		case 'functiondialog':
			{
				if (window.mode.isMobile() && this._functionWizardData) {
					this._docLayer._closeMobileWizard();
					this._docLayer._openMobileWizard(this._functionWizardData);
					this.formulabarSetDirty();
				} else {
					this.sendUnoCommand('.uno:FunctionDialog');
				}
			}
			break;
		case 'remotelink':
			this.fire('postMessage', { msgId: 'UI_PickLink' });
			break;
		case 'zoteroaddeditcitation':
			{
				this.zotero.handleItemList();
			}
			break;
		case 'zoterosetdocprefs':
			{
				this.zotero.handleStyleList();
			}
			break;
		case 'zoteroaddeditbibliography':
			{
				this.zotero.insertBibliography();
			}
			break;
		case 'zoteroaddnote':
			{
				this.zotero.handleInsertNote();
			}
			break;
		case 'zoterorefresh':
			{
				this.zotero.refreshCitationsAndBib();
			}
			break;
		case 'zoterounlink':
			{
				this.zotero.unlinkCitations();
			}
			break;
		case 'exportpdf':
			{
				this.sendUnoCommand('.uno:ExportToPDF', {
					'SynchronMode': {
						'type': 'boolean',
						'value': false
					}
				});
			}
			break;
		case 'exportepub':
			{
				this.sendUnoCommand('.uno:ExportToEPUB', {
					'SynchronMode': {
						'type': 'boolean',
						'value': false
					}
				});
			}
			break;
		case 'deletepage':
			{
				var map = this;
				var msg;
				if (map.getDocType() === 'presentation') {
					msg = _('Are you sure you want to delete this slide?');
				}
				else { /* drawing */
					msg = _('Are you sure you want to delete this page?');
				}
				map.uiManager.showInfoModal('deleteslide-modal', _('Delete'),
					msg, '', _('OK'), function () { map.deletePage(); }, true);
			}
			break;
		case 'hyperlinkdialog':
			this.showHyperlinkDialog();
			break;
		case 'rev-history':
			this.openRevisionHistory();
			break;
		case 'shareas':
			this.openShare();
			break;
		case 'presentation':
			this.fire('fullscreen');
			break;
		case 'charmapcontrol':
			this.sendUnoCommand('.uno:InsertSymbol');
			break;
		case 'closetablet':
			this.uiManager.enterReadonlyOrClose();
			break;
		case 'showresolvedannotations':
			var items = this['stateChangeHandler'];
			var val = items.getItemValue('.uno:ShowResolvedAnnotations');
			val = (val === 'true' || val === true);
			this.showResolvedComments(!val);
			break;
		case 'toggledarktheme':
			this.uiManager.toggleDarkMode();
			break;
		default:
			console.error('unknown dispatch: "' + action + '"');
		}
	},
});
