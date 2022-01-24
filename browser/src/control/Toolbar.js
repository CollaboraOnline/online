/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Toolbar handler
 */

/* global app $ window vex sanitizeUrl brandProductName brandProductURL _ Hammer */
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
		if (this.isPermissionEdit()) {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			app.socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.isPermissionEdit()) {
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
		if (this.isPermissionEdit()) {
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
		if (this.isPermissionEdit()) {
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

	sendUnoCommand: function (command, json) {
		// To exercise the Trace Event functionality, uncomment this
		// app.socket.emitInstantTraceEvent('cool-unocommand:' + command);

		var isAllowedInReadOnly = false;
		var allowedCommands = ['.uno:Save', '.uno:WordCountDialog', '.uno:EditAnnotation',
			'.uno:InsertAnnotation', '.uno:DeleteAnnotation', '.uno:Signature',
			'.uno:ShowResolvedAnnotations'];

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
		if (this.dialog.hasOpenedDialog())
			this.dialog.blinkOpenDialog();
		else if (this.isPermissionEdit() || isAllowedInReadOnly) {
			if (!this.messageNeedsToBeRedirected(command))
				app.socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this.isPermissionEdit()) {
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

	_doVexOpenHelpFile: function(data, id, map) {
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition';
		}
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
		vex.open({
			unsafeContent: data,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: false,
			closeAllOnPopState: false,
			contentClassName: 'vex-content vex-selectable',
			buttons: {},
			afterOpen: function() {
				var $vexContent = $(this.contentEl);
				this.contentEl.style.width = w + 'px';
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
							imgList[p].src = window.makeWsUrl('/cool/dist'+ imgSrc);
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
				translatableContent = $vexContent.find('p');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('button'); // TOC
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}

				//translatable screenshots
				var supportedLanguage = ['fr', 'it', 'de', 'es', 'pt-BR'];
				var currentLanguage = String.locale;
				if (supportedLanguage.indexOf(currentLanguage) >= 0) {
					translatableContent = $($vexContent.find('.screenshot')).find('img');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].src = translatableContent[i].src.replace('/en/', '/'+currentLanguage+'/');
					}
				}

				// Substitute %productName in Online Help and replace special Mac key names
				if (id === 'online-help') {
					var productNameContent = $vexContent.find('span.productname');
					for (i = 0, max = productNameContent.length; i < max; i++) {
						productNameContent[i].innerHTML = productNameContent[i].innerHTML.replace(/%productName/g, productName);
					}
					document.getElementById('online-help').innerHTML = L.Util.replaceCtrlAltInMac(document.getElementById('online-help').innerHTML);
				}
				if (id === 'keyboard-shortcuts') {
					document.getElementById('keyboard-shortcuts').innerHTML = L.Util.replaceCtrlAltInMac(document.getElementById('keyboard-shortcuts').innerHTML);
				}

				$vexContent.attr('tabindex', -1);
				$vexContent.focus();
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				map.focus();
			}
		});
	},

	showHelp: function(id) {
		var map = this;
		if (window.ThisIsAMobileApp) {
			map._doVexOpenHelpFile(window.HelpFile, id, map);
			return;
		}
		var helpLocation = 'cool-help.html';
		if (window.socketProxy)
			helpLocation = window.makeWsUrl('/cool/dist/' + helpLocation);
		$.get(helpLocation, function(data) {
			map._doVexOpenHelpFile(data, id, map);
		});
	},

	/** Add various content instead of the variables in the Welcome dialog */
	_replaceVars: function(text) {
		return text
			.replace(/%coolVersion/g, app.socket.WSDServer.Version)
			.replace(/%coolAppsURL/g, 'https://www.collaboraoffice.com/solutions/collabora-office-android-ios/')
			.replace(/%coolReleaseNotesURL/g, 'https://www.collaboraoffice.com/code-21-11-release-notes/')
			.replace(/%coolSdkURL/g, 'https://sdk.collaboraonline.com/')
			.replace(/%coolStepByStepURL/g, 'https://collaboraonline.github.io/post/build-code/')
			.replace(/%coolTranslationsURL/g, 'https://collaboraonline.github.io/post/translate/')
			.replace(/%coolBugreportURL/g, 'https://collaboraonline.github.io/post/filebugs/');
	},

	// show the actual welcome dialog with the given data
	_showWelcomeDialogVex: function(data, calledFromMenu) {
		var w;
		var iw = window.innerWidth;
		var hasDismissBtn = window.enableWelcomeMessageButton;
		var btnText = _('I understand the risks');

		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}

		if (!hasDismissBtn && window.mode.isMobile()) {
			var ih = window.innerHeight;
			var h = ih / 2;
			if (iw < 768) {
				h = ih - 170; // Hopefully enough padding to avoid extra scroll-bar on mobile,
			}
			var containerDiv = '<div style="max-height:' + h + 'px;overflow-y:auto;">';
			containerDiv += data;
			containerDiv += '</div>';
			data = containerDiv;
			btnText = _('Dismiss');
			hasDismissBtn = true;
		}

		// show the dialog
		var map = this;
		vex.dialog.open({
			unsafeMessage: data,
			showCloseButton: !hasDismissBtn,
			escapeButtonCloses: false,
			overlayClosesOnClick: false,
			className: !window.mode.isMobile() ? 'vex-theme-plain' : 'vex-theme-plain vex-welcome-mobile',
			closeAllOnPopState: false,
			focusFirstInput: false, // Needed to avoid auto-scroll to the bottom
			buttons: !hasDismissBtn ? {} : [
				$.extend({}, vex.dialog.buttons.YES, { text: btnText }),
			],
			afterOpen: function() {
				$('#welcome-slide1-heading-1').text(map._replaceVars(_('Explore the new %coolVersion')));
				$('#welcome-slide1-heading-2').text(_('Collabora Online Development Edition'));
				$('#welcome-slide1-content').html(map._replaceVars(_('Enjoy the latest developments in online productivity, free for you to use, to explore and to use with others in the browser. <a href="%coolAppsURL" target="_blank">Apps</a> are also available for Android and iOS. %coolVersion introduces important improvements, in the areas of usability, visual presentation and performance.')));

				$('#welcome-slide2-heading-1').text(map._replaceVars(_('Discover all the changes')));
				$('#welcome-slide2-heading-2').text(_('Collabora Online Development Edition'));
				$('#welcome-slide2-content').html(map._replaceVars(_('Check the <a href="%coolReleaseNotesURL" target="_blank">release notes</a> and learn all about the latest milestone in performance particularly for larger groups working on documents, new native sidebar, new re-worked avatar list, asynchronous saving, faster spell checking and more.')));

				$('#welcome-slide3-heading-1').text(_('Integrate Collabora Online into your webapp'));
				$('#welcome-slide3-heading-2').text(_('Or get involved in the development'));
				$('#welcome-slide3-content').html(map._replaceVars(_('Learn more about integrating into your web application in the <a href="%coolSdkURL" target="_blank">Collabora Online SDK</a>. Or head over to the <a href="%coolStepByStepURL" target="_blank">step-by-step instructions</a> and build CODE from scratch. You can also help out with <a href="%coolTranslationsURL" target="_blank">translations</a> or by <a href="%coolBugreportURL" target="_blank">filing a bug report</a> with all the essential steps on how to reproduce it.')));

				$('#welcome-button-next-1').text(_('Next').replace('~', ''));
				$('#welcome-button-next-2').text(_('Next').replace('~', ''));
				$('#welcome-button-close').text(_('Close').replace('~', ''));

				$('#view-supported-versions').text(_('Learn more about the enterprise-ready versions'));

				var $vexContent = $(this.contentEl);
				this.contentEl.style.width = w + 'px';

				$vexContent.attr('tabindex', -1);
				// Work-around to avoid the ugly all-bold dialog message on mobile
				if (window.mode.isMobile()) {
					var dlgMsg = document.getElementsByClassName('vex-dialog-message')[0];
					dlgMsg.setAttribute('class', 'vex-content');
				}
				$vexContent.focus();
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				if (!calledFromMenu) {
					localStorage.setItem('WSDWelcomeVersion', app.socket.WSDServer.Version);
				}
				map.focus();
			}
		});
	},

	showWelcomeDialog: function(calledFromMenu) {
		window.app.console.log('showWelcomeDialog, calledFromMenu: ' + calledFromMenu);
		var welcomeLocation = 'welcome/welcome.html';
		if (window.socketProxy)
			welcomeLocation = window.makeWsUrl('/cool/dist/' + welcomeLocation);

		var map = this;

		// if the user doesn't accept cookies, or we get several triggers,
		// ensure we only ever do this once.
		if (!calledFromMenu && map._alreadyShownWelcomeDialog)
			return;
		map._alreadyShownWelcomeDialog = true;

		// try to load the welcome message
		$.get(welcomeLocation)
			.done(function(data) {
				map._showWelcomeDialogVex(data, calledFromMenu);
			})
			.fail(function() {
				var currentDate = new Date();
				localStorage.setItem('WSDWelcomeDisabled', 'true');
				localStorage.setItem('WSDWelcomeDisabledDate', currentDate.toDateString());

				if (calledFromMenu)
					map._showWelcomeDialogVex(_('We are sorry, the information about the latest updates is not available.'));
			});
	},

	shouldWelcome: function() {
		if (!window.isLocalStorageAllowed || !window.enableWelcomeMessage)
			return false;

		var storedVersion = localStorage.getItem('WSDWelcomeVersion');
		var currentVersion = app.socket.WSDServer.Version;
		var welcomeDisabledCookie = localStorage.getItem('WSDWelcomeDisabled');
		var welcomeDisabledDate = localStorage.getItem('WSDWelcomeDisabledDate');
		var isWelcomeDisabled = false;

		if (welcomeDisabledCookie && welcomeDisabledDate) {
			// Check if we are stil in the same day
			var currentDate = new Date();
			if (welcomeDisabledDate === currentDate.toDateString())
				isWelcomeDisabled = true;
			else {
				//Values expired. Clear the local values
				localStorage.removeItem('WSDWelcomeDisabled');
				localStorage.removeItem('WSDWelcomeDisabledDate');
			}
		}

		if ((!storedVersion || storedVersion !== currentVersion) && !isWelcomeDisabled) {
			return true;
		}

		return false;
	},

	showLOAboutDialog: function() {

		// Just as a test to exercise the Async Trace Event functionality, uncomment this
		// line and the asyncTraceEvent.finish() below.
		// var asyncTraceEvent = app.socket.createAsyncTraceEvent('cool-showLOAboutDialog');

		// Move the div sitting in 'body' as vex-content and make it visible
		var content = $('#about-dialog').clone().css({display: 'block'});
		// fill product-name and product-string
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition';
		}
		var productURL = (typeof brandProductURL !== 'undefined') ? brandProductURL : 'https://collaboraonline.github.io/';
		content.find('#product-name').text(productName).addClass('product-' + productName.split(/[ ()]+/).join('-').toLowerCase());
		var productString = _('This version of %productName is powered by');
		var productNameWithURL;
		if (!window.ThisIsAMobileApp)
			productNameWithURL = '<a href="' + sanitizeUrl.sanitizeUrl(productURL) +
								 '" target="_blank">' + productName + '</a>';
		else
			productNameWithURL = productName;
		content.find('#product-string').html(productString.replace('%productName', productNameWithURL));

		if (window.socketProxy)
			content.find('#slow-proxy').text(_('"Slow Proxy"'));

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
			if (event.key === 'd') {
				map._docLayer.toggleTileDebugMode();
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

				var logLevelInformation = newLogLevel;
				if (newLogLevel === 'default')
					logLevelInformation = 'default (from coolwsd.xml)';
				else if (newLogLevel === 'verbose')
					logLevelInformation = 'most verbose (from coolwsd.xml)';
				else if (newLogLevel === 'terse')
					logLevelInformation = 'least verbose (from coolwsd.xml)';
				else
					logLevelInformation = newLogLevel;

				$(app.ExpertlyTrickForLOAbout.contentEl).find('#log-level-state').html('Log level: ' + logLevelInformation);
			}
		};
		vex.open({
			unsafeContent: content[0].outerHTML,
			showCloseButton: true,
			closeClassName: 'vex-close-m',
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

				// FIXME: When we remove vex this needs to be cleaned up.

				// It is hard to access the value of "this" in this afterOpen
				// function in the handler function. Use a global variable until
				// somebody figures out a better way.
				app.ExpertlyTrickForLOAbout = this;
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
				map.focus();

				// Unset the global variable, see comment above.
				app.ExpertlyTrickForLOAbout = undefined;
				// asyncTraceEvent.finish();
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
			if (map['stateChangeHandler'].getItemValue('.uno:Copy') === 'enabled') {
				text = this.extractContent(this._clip._selectionContent);
			}
		} else if (this._docLayer._selectedTextContent) {
			text = this.extractContent(this._docLayer._selectedTextContent);
		}

		vex.dialog.open({
			contentClassName: 'hyperlink-dialog vex-has-inputs',
			message: _('Insert hyperlink'),
			overlayClosesOnClick: false,
			input: [
				_('Text') + '<textarea name="text" id="hyperlink-text-box" style="resize: none" type="text"></textarea>',
				_('Link') + '<input name="link" id="hyperlink-link-box" type="text" value="' + link + '"/>'
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
				else {
					map.focus();
				}
			},
			afterOpen: function() {
				setTimeout(function() {
					var textBox = document.getElementById('hyperlink-text-box');
					textBox.textContent = text ? text.trim() : '';
					if (textBox.textContent.trim() !== '') {
						document.getElementById('hyperlink-link-box').focus();
					}
					else {
						textBox.focus();
					}
				}, 0);
			}
		});
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
	openSaveAs: function () {
		var map = this;
		map.fire('postMessage', {msgId: 'UI_SaveAs'});
	},
});
