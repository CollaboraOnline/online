/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.StatusBar
 */

/* global $ w2ui _ _UNO */
L.Control.StatusBar = L.Control.extend({

	initialize: function () {
	},

	onAdd: function (map) {
		this.map = map;
		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('commandvalues', this.onCommandValues, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
		map.on('contextchange', this.onContextChange, this);
		this.create();

		$(window).resize(function() {
			if ($(window).width() !== map.getSize().x) {
				var statusbar = w2ui['actionbar'];
				statusbar.resize();
			}
		});
	},

	hideTooltip: function(toolbar, id) {
		if (toolbar.touchStarted) {
			setTimeout(function() {
				toolbar.tooltipHide(id, {});
			}, 5000);
			toolbar.touchStarted = false;
		}
	},

	updateToolbarItem: function(toolbar, id, html) {
		var item = toolbar.get(id);
		if (item) {
			item.html = html;
		}
	},

	localizeStateTableCell: function(text) {
		var stateArray = text.split(';');
		var stateArrayLength = stateArray.length;
		var localizedText = '';
		for (var i = 0; i < stateArrayLength; i++) {
			var labelValuePair = stateArray[i].split(':');
			localizedText += _(labelValuePair[0].trim()) + ':' + labelValuePair[1];
			if (stateArrayLength > 1 && i < stateArrayLength - 1) {
				localizedText += '; ';
			}
		}
		return localizedText;
	},

	toLocalePattern: function(pattern, regex, text, sub1, sub2) {
		var matches = new RegExp(regex, 'g').exec(text);
		if (matches) {
			text = pattern.toLocaleString().replace(sub1, parseInt(matches[1].replace(/,/g,'')).toLocaleString(String.locale)).replace(sub2, parseInt(matches[2].replace(/,/g,'')).toLocaleString(String.locale));
		}
		return text;
	},

	_updateToolbarsVisibility: function(context) {
		window.updateVisibilityForToolbar(w2ui['actionbar'], context);
	},

	onContextChange: function(event) {
		this._updateToolbarsVisibility(event.context);
	},

	onClick: function(e, id, item, subItem) {
		if ('actionbar' in w2ui && w2ui['actionbar'].get(id) !== null) {
			var toolbar = w2ui['actionbar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		var docLayer = this.map._docLayer;

		if (item.uno) {
			if (item.unosheet && this.map.getDocType() === 'spreadsheet') {
				this.map.toggleCommandState(item.unosheet);
			}
			else {
				this.map.toggleCommandState(window.getUNOCommand(item.uno));
			}
		}
		else if (id === 'zoomin' && this.map.getZoom() < this.map.getMaxZoom()) {
			this.map.zoomIn(1, null, true /* animate? */);
		}
		else if (id === 'zoomout' && this.map.getZoom() > this.map.getMinZoom()) {
			this.map.zoomOut(1, null, true /* animate? */);
		}
		else if (item.scale) {
			this.map.setZoom(item.scale, null, true /* animate? */);
		}
		else if (id === 'zoomreset') {
			this.map.setZoom(this.map.options.zoom);
		}
		else if (id === 'prev' || id === 'next') {
			if (docLayer._docType === 'text') {
				this.map.goToPage(id);
			}
			else {
				this.map.setPart(id);
			}
		}
		else if (id === 'searchprev') {
			this.map.search(L.DomUtil.get('search-input').value, true);
		}
		else if (id === 'searchnext') {
			this.map.search(L.DomUtil.get('search-input').value);
		}
		else if (id === 'cancelsearch') {
			this._cancelSearch();
		}
		else if (id.startsWith('StateTableCellMenu') && subItem) {
			e.done(function () {
				var menu = w2ui['actionbar'].get('StateTableCellMenu');
				if (subItem.id === '1') { // 'None' was clicked, remove all other options
					menu.selected = ['1'];
				}
				else { // Something else was clicked, remove the 'None' option from the array
					var index = menu.selected.indexOf('1');
					if (index > -1) {
						menu.selected.splice(index, 1);
					}
				}
				var value = 0;
				for (var it = 0; it < menu.selected.length; it++) {
					value = +value + parseInt(menu.selected[it]);
				}
				var command = {
					'StatusBarFunc': {
						type: 'unsigned short',
						value: value
					}
				};
				this.map.sendUnoCommand('.uno:StatusBarFunc', command);
			}.bind(this));
		}
		else if (id === 'userlist') {
			this.map.fire('openuserlist');
		}
		else if (id === 'signstatus') {
			this.map.sendUnoCommand('.uno:Signature');
		}
	},

	create: function() {
		var toolbar = $('#toolbar-down');
		var that = this;

		if (!window.mode.isMobile()) {
			toolbar.w2toolbar({
				name: 'actionbar',
				items: [
					{type: 'html',  id: 'search',
						html: '<div style="padding: 3px 5px 4px 10px;" class="loleaflet-font">' +
					'<label for="search-input" class="visuallyhidden" aria-hidden="false">Search:</label>' +
					'<input size="15" id="search-input" placeholder="' + _('Search') + '"' +
					'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>' +
					'</div>'
					},
					{type: 'button',  id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
					{type: 'button',  id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
					{type: 'button',  id: 'cancelsearch', img: 'cancel', hint: _('Cancel the search'), hidden: true},
					{type: 'html',  id: 'left'},
					{type: 'html',  id: 'right'},
					{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: L.control.createUserListWidget()},
					{type: 'break', id: 'userlistbreak', hidden: true, mobile: false },
					{type: 'button',  id: 'prev', img: 'prev', hint: _UNO('.uno:PageUp', 'text')},
					{type: 'button',  id: 'next', img: 'next', hint: _UNO('.uno:PageDown', 'text')},
					{type: 'break', id: 'prevnextbreak'},
				].concat(window.mode.isTablet() ? [] : [
					{type: 'button',  id: 'zoomreset', img: 'zoomreset', hint: _('Reset zoom')},
					{type: 'button',  id: 'zoomout', img: 'zoomout', hint: _UNO('.uno:ZoomMinus')},
					{type: 'menu-radio', id: 'zoom', text: '100',
						selected: 'zoom100',
						mobile: false,
						items: [
							{ id: 'zoom20', text: '20', scale: 1},
							{ id: 'zoom25', text: '25', scale: 2},
							{ id: 'zoom30', text: '30', scale: 3},
							{ id: 'zoom35', text: '35', scale: 4},
							{ id: 'zoom40', text: '40', scale: 5},
							{ id: 'zoom50', text: '50', scale: 6},
							{ id: 'zoom60', text: '60', scale: 7},
							{ id: 'zoom70', text: '70', scale: 8},
							{ id: 'zoom85', text: '85', scale: 9},
							{ id: 'zoom100', text: '100', scale: 10},
							{ id: 'zoom120', text: '120', scale: 11},
							{ id: 'zoom150', text: '150', scale: 12},
							{ id: 'zoom175', text: '175', scale: 13},
							{ id: 'zoom200', text: '200', scale: 14},
							{ id: 'zoom235', text: '235', scale: 15},
							{ id: 'zoom280', text: '280', scale: 16},
							{ id: 'zoom335', text: '335', scale: 17},
							{ id: 'zoom400', text: '400', scale: 18},
						]
					},
					{type: 'button',  id: 'zoomin', img: 'zoomin', hint: _UNO('.uno:ZoomPlus')}
				]),
				onClick: function (e) {
					that.hideTooltip(this, e.target);
					that.onClick(e, e.target, e.item, e.subItem);
				},
				onRefresh: function() {
					$('#tb_actionbar_item_userlist .w2ui-tb-caption').addClass('loleaflet-font');
					window.setupSearchInput();
				}
			});
			this.map.uiManager.enableTooltip(toolbar);
		}

		toolbar.bind('touchstart', function() {
			w2ui['actionbar'].touchStarted = true;
		});

		this.map.on('zoomend', function () {
			var zoomPercent = 100;
			var zoomSelected = null;
			switch (that.map.getZoom()) {
			case 1:  zoomPercent =  20; zoomSelected = 'zoom20'; break;  // 0.2102
			case 2:  zoomPercent =  25; zoomSelected = 'zoom25'; break;  // 0.2500
			case 3:  zoomPercent =  30; zoomSelected = 'zoom30'; break;  // 0.2973
			case 4:  zoomPercent =  35; zoomSelected = 'zoom35'; break;  // 0.3535
			case 5:  zoomPercent =  40; zoomSelected = 'zoom40'; break;  // 0.4204
			case 6:  zoomPercent =  50; zoomSelected = 'zoom50'; break;  // 0.5
			case 7:  zoomPercent =  60; zoomSelected = 'zoom60'; break;  // 0.5946
			case 8:  zoomPercent =  70; zoomSelected = 'zoom70'; break;  // 0.7071
			case 9:  zoomPercent =  85; zoomSelected = 'zoom85'; break;  // 0.8409
			case 10: zoomPercent = 100; zoomSelected = 'zoom100'; break; // 1
			case 11: zoomPercent = 120; zoomSelected = 'zoom120'; break; // 1.1892
			// Why do we call this 150% even if it is actually closer to 140%
			case 12: zoomPercent = 150; zoomSelected = 'zoom150'; break; // 1.4142
			case 13: zoomPercent = 170; zoomSelected = 'zoom170'; break; // 1.6818
			case 14: zoomPercent = 200; zoomSelected = 'zoom200'; break; // 2
			case 15: zoomPercent = 235; zoomSelected = 'zoom235'; break; // 2.3784
			case 16: zoomPercent = 280; zoomSelected = 'zoom280'; break; // 2.8284
			case 17: zoomPercent = 335; zoomSelected = 'zoom335'; break; // 3.3636
			case 18: zoomPercent = 400; zoomSelected = 'zoom400'; break; // 4
			default:
				var zoomRatio = that.map.getZoomScale(that.map.getZoom(), that.map.options.zoom);
				zoomPercent = Math.round(zoomRatio * 100);
				break;
			}
			w2ui['actionbar'].set('zoom', {text: zoomPercent, selected: zoomSelected});
		});
	},

	onDocLayerInit: function () {
		var statusbar = w2ui['actionbar'];
		var docType = this.map.getDocType();
		var isReadOnly = this.map.isPermissionReadOnly();

		switch (docType) {
		case 'spreadsheet':
			if (statusbar)
				statusbar.remove('prev', 'next', 'prevnextbreak');

			if (!window.mode.isMobile()) {
				statusbar.insert('left', [
					{type: 'break', id: 'break1'},
					{
						type: 'html', id: 'StatusDocPos',
						html: '<div id="StatusDocPos" class="loleaflet-font" title="' + _('Number of Sheets') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break2'},
					{
						type: 'html', id: 'RowColSelCount',
						html: '<div id="RowColSelCount" class="loleaflet-font" title="' + _('Selected range of cells') + '" style="padding: 5px 5px;line-height:0;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break3', tablet: false},
					{
						type: 'html', id: 'InsertMode', mobile: false, tablet: false,
						html: '<div id="InsertMode" class="loleaflet-font insert-mode-true" title="' + _('Entering text mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break4', tablet: false},
					{type: 'menu-radio', id: 'LanguageStatus',
						mobile: false
					},
					{type: 'break', id: 'break5', tablet: false},
					{
						type: 'html', id: 'StatusSelectionMode', mobile: false, tablet: false,
						html: '<div id="StatusSelectionMode" class="loleaflet-font" title="' + _('Selection Mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break8', mobile: false, tablet: false},
					{
						type: 'html', id: 'StateTableCell', mobile: false, tablet: false,
						html: '<div id="StateTableCell" class="loleaflet-font" title="' + _('Choice of functions') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{
						type: 'menu-check', id: 'StateTableCellMenu', caption: '', selected: ['2', '512'], items: [
							{id: '2', text: _('Average')},
							{id: '8', text: _('CountA')},
							{id: '4', text: _('Count')},
							{id: '16', text: _('Maximum')},
							{id: '32', text: _('Minimum')},
							{id: '512', text: _('Sum')},
							{id: '8192', text: _('Selection count')},
							{id: '1', text: _('None')}
						], tablet: false
					},
					{type: 'break', id: 'break9', mobile: false},
					{
						type: 'html', id: 'PermissionMode', mobile: false, tablet: false,
						html: '<div id="PermissionMode" class="loleaflet-font ' +
						(isReadOnly
							? ' status-readonly-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Read-only') + ' </div>'
							: ' status-edit-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Edit') + ' </div>')
					}
				]);
			}
			break;

		case 'text':
			if (!window.mode.isMobile()) {
				statusbar.insert('left', [
					{type: 'break', id: 'break1'},
					{
						type: 'html', id: 'StatePageNumber',
						html: '<div id="StatePageNumber" class="loleaflet-font" title="' + _('Number of Pages') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break2'},
					{
						type: 'html', id: 'StateWordCount', mobile: false, tablet: false,
						html: '<div id="StateWordCount" class="loleaflet-font" title="' + _('Word Counter') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break5', mobile: false, tablet: false},
					{
						type: 'html', id: 'InsertMode', mobile: false, tablet: false,
						html: '<div id="InsertMode" class="loleaflet-font insert-mode-true" title="' + _('Entering text mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break6', mobile: false, tablet: false},
					{
						type: 'html', id: 'StatusSelectionMode', mobile: false, tablet: false,
						html: '<div id="StatusSelectionMode" class="loleaflet-font" title="' + _('Selection Mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break7', mobile: false, tablet: false},
					{type: 'menu-radio', id: 'LanguageStatus',
						mobile: false
					},
					{type: 'break', id: 'break8', mobile: false},
					{
						type: 'html', id: 'PermissionMode', mobile: false, tablet: false,
						html: '<div id="PermissionMode" class="loleaflet-font ' +
						(isReadOnly
							? ' status-readonly-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Read-only') + ' </div>'
							: ' status-edit-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Edit') + ' </div>')
					}
				]);
			}
			break;

		case 'presentation':
			if (!window.mode.isMobile()) {
				statusbar.insert('left', [
					{type: 'break', id: 'break1'},
					{
						type: 'html', id: 'PageStatus',
						html: '<div id="PageStatus" class="loleaflet-font" title="' + _('Number of Slides') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break2', mobile: false, tablet: false},
					{type: 'menu-radio', id: 'LanguageStatus',
						mobile: false
					},
					{type: 'break', id: 'break8', mobile: false},
					{
						type: 'html', id: 'PermissionMode', mobile: false, tablet: false,
						html: '<div id="PermissionMode" class="loleaflet-font ' +
						(isReadOnly
							? ' status-readonly-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Read-only') + ' </div>'
							: ' status-edit-mode" title="' + _('Permission Mode') + '" style="padding: 5px 5px;"> ' + _('Edit') + ' </div>')
					}
				]);
			}

		// FALLTHROUGH intended
		case 'drawing':
			if (statusbar)
				statusbar.show('prev', 'next');
			break;
		}

		this.map.fire('updateuserlistcount');

		this._updateToolbarsVisibility();

		if (statusbar)
			statusbar.refresh();

		var showStatusbar = this.map.uiManager.getSavedStateOrDefault('ShowStatusbar');
		if (showStatusbar)
			$('#toolbar-down').show();
		else
			this.map.uiManager.hideStatusBar(true);
	},

	_cancelSearch: function() {
		var toolbar = window.mode.isMobile() ? w2ui['searchbar'] : w2ui['actionbar'];
		var searchInput = L.DomUtil.get('search-input');
		this.map.resetSelection();
		toolbar.hide('cancelsearch');
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		searchInput.value = '';
		if (window.mode.isMobile()) {
			searchInput.focus();
			// odd, but on mobile we need to invoke it twice
			toolbar.hide('cancelsearch');
		}

		this.map._onGotFocus();
	},

	onCommandStateChanged: function(e) {
		var statusbar = w2ui['actionbar'];
		var commandName = e.commandName;
		var state = e.state;

		if (!commandName)
			return;

		if (commandName === '.uno:StatusDocPos') {
			state = this.toLocalePattern('Sheet %1 of %2', 'Sheet (\\d+) of (\\d+)', state, '%1', '%2');
			this.updateToolbarItem(statusbar, 'StatusDocPos', $('#StatusDocPos').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
		}
		else if (commandName === '.uno:LanguageStatus') {
			var code = state;
			var language = _(state);
			var split = code.split(';');
			if (split.length > 1) {
				language = _(split[0]);
				code = split[1];
			}
			w2ui['actionbar'].set('LanguageStatus', {text: language, selected: language});
		}
		else if (commandName === '.uno:RowColSelCount') {
			state = this.toLocalePattern('$1 rows, $2 columns selected', '(\\d+) rows, (\\d+) columns selected', state, '$1', '$2');
			state = this.toLocalePattern('$1 of $2 records found', '(\\d+) of (\\d+) records found', state, '$1', '$2');
			this.updateToolbarItem(statusbar, 'RowColSelCount', $('#RowColSelCount').html(state ? state : '<span class="ToolbarStatusInactive">&nbsp;' + _('Select multiple cells') + '&nbsp;</span>').parent().html());
		}
		else if (commandName === '.uno:InsertMode') {
			this.updateToolbarItem(statusbar, 'InsertMode', $('#InsertMode').html(state ? L.Styles.insertMode[state].toLocaleString() : '<span class="ToolbarStatusInactive">&nbsp;' + _('Insert mode: inactive') + '&nbsp;</span>').parent().html());

			$('#InsertMode').removeClass();
			$('#InsertMode').addClass('loleaflet-font insert-mode-' + state);

			if (!state && this.map.hyperlinkPopup) {
				this.map.hyperlinkUnderCursor = null;
				this.map.closePopup(this.map.hyperlinkPopup);
				this.map.hyperlinkPopup = null;
			}
		}
		else if (commandName === '.uno:StatusSelectionMode' ||
				commandName === '.uno:SelectionMode') {
			this.updateToolbarItem(statusbar, 'StatusSelectionMode', $('#StatusSelectionMode').html(state ? L.Styles.selectionMode[state].toLocaleString() : '<span class="ToolbarStatusInactive">&nbsp;' + _('Selection mode: inactive') + '&nbsp;</span>').parent().html());
		}
		else if (commandName == '.uno:StateTableCell') {
			this.updateToolbarItem(statusbar, 'StateTableCell', $('#StateTableCell').html(state ? this.localizeStateTableCell(state) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
		}
		else if (commandName === '.uno:StatusBarFunc') {
			var item = statusbar.get('StateTableCellMenu');
			if (item) {
				item.selected = [];
				// Check 'None' even when state is 0
				if (state === '0') {
					state = 1;
				}
				for (var it = 0; it < item.items.length; it++) {
					if (item.items[it].id & state) {
						item.selected.push(item.items[it].id);
					}
				}
			}
		}
		else if (commandName === '.uno:StatePageNumber') {
			state = this.toLocalePattern('Page %1 of %2', 'Page (\\d+) of (\\d+)', state, '%1', '%2');
			this.updateToolbarItem(statusbar, 'StatePageNumber', $('#StatePageNumber').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
		}
		else if (commandName === '.uno:StateWordCount') {
			state = this.toLocalePattern('%1 words, %2 characters', '([\\d,]+) words, ([\\d,]+) characters', state, '%1', '%2');
			this.updateToolbarItem(statusbar, 'StateWordCount', $('#StateWordCount').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
		}
		else if (commandName === '.uno:PageStatus') {
			state = this.toLocalePattern('Slide %1 of %2', 'Slide (\\d+) of (\\d+)', state, '%1', '%2');
			this.updateToolbarItem(statusbar, 'PageStatus', $('#PageStatus').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
		}
	},

	onCommandValues: function(e) {
		if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
			var translated, neutral;
			var constLang = '.uno:LanguageStatus?Language:string=';
			var constDefault = 'Default_RESET_LANGUAGES';
			var constNone = 'Default_LANGUAGE_NONE';
			var resetLang = _('Reset to Default Language');
			var noneLang = _('None (Do not check spelling)');
			var languages = [];
			e.commandValues.forEach(function (language) {
				languages.push({ translated: _(language.split(';')[0]), neutral: language });
			});
			languages.sort(function (a, b) {
				return a.translated < b.translated ? -1 : a.translated > b.translated ? 1 : 0;
			});

			var toolbaritems = [];
			toolbaritems.push({ text: noneLang,
			 id: 'nonelanguage',
			 uno: constLang + constNone });


			for (var lang in languages) {
				translated = languages[lang].translated;
				neutral = languages[lang].neutral;
				var splitNeutral = neutral.split(';');
				toolbaritems.push({ id: neutral, text: translated, uno: constLang + encodeURIComponent('Default_' + splitNeutral[0]) });
			}

			toolbaritems.push({ id: 'reset', text: resetLang, uno: constLang + constDefault });

			w2ui['actionbar'].set('LanguageStatus', {items: toolbaritems});
		}
	},
});

L.control.statusBar = function () {
	return new L.Control.StatusBar();
};
