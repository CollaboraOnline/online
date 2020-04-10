/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.StatusBar
 */

/* global $ w2ui w2utils _ _UNO */
L.Control.StatusBar = L.Control.extend({
	options: {
		userPopupTimeout: null,
		userJoinedPopupMessage: '<div>' + _('%user has joined') + '</div>',
		userLeftPopupMessage: '<div>' + _('%user has left') + '</div>',
		nUsers: undefined,
		oneUser: undefined,
		noUser: undefined
	},

	initialize: function () {
	},

	onAdd: function (map) {
		this.map = map;

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('addview', this.onAddView, this);
		map.on('removeview', this.onRemoveView, this);
		map.on('commandvalues', this.onCommandValues, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
		map.on('deselectuser', this.deselectUser, this);

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
			text = pattern.toLocaleString().replace(sub1, parseInt(matches[1].replace(',','')).toLocaleString(String.locale)).replace(sub2, parseInt(matches[2].replace(',','')).toLocaleString(String.locale));
		}
		return text;
	},

	escapeHtml: function(input) {
		return $('<div>').text(input).html();
	},

	getUserItem: function(viewId, userName, extraInfo, color) {
		var html = '<tr class="useritem" id="user-' + viewId + '" onclick="onUseritemClicked(event)">' +
				 '<td class=usercolor>';
		if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
			html += '<img class="avatar-img" src="' + extraInfo.avatar + '" style="border-color: ' + color  + ';" />';
		} else {
			html += '<div class="user-info" style="background-color: ' + color  + ';" />';
		}
	
		// TODO: Add mail and other links as sub-menu.
		html += '</td>' +
				 '<td class="username loleaflet-font" >' + userName + '</td>' +
			'</tr>';
	
		return html;
	},

	_updateVisibilityForToolbar: function(toolbar) {
		if (!toolbar)
			return;
	
		var toShow = [];
		var toHide = [];
	
		toolbar.items.forEach(function(item) {
			if (window.ThisIsTheiOSApp && window.mode.isTablet() && item.iosapptablet === false) {
				toHide.push(item.id);
			}
			else if (((window.mode.isMobile() && item.mobile === false) || (window.mode.isTablet() && item.tablet === false) || (window.mode.isDesktop() && item.desktop === false) || (!window.ThisIsAMobileApp && item.mobilebrowser === false)) && !item.hidden) {
				toHide.push(item.id);
			}
			else if (((window.mode.isMobile() && item.mobile === true) || (window.mode.isTablet() && item.tablet === true) || (window.mode.isDesktop() && item.desktop === true) || (window.ThisIsAMobileApp && item.mobilebrowser === true)) && item.hidden) {
				toShow.push(item.id);
			}
		});
	
		console.log('explicitly hiding: ' + toHide);
		console.log('explicitly showing: ' + toShow);
	
		toHide.forEach(function(item) { toolbar.hide(item); });
		toShow.forEach(function(item) { toolbar.show(item); });
	},

	_updateToolbarsVisibility: function() {
		this._updateVisibilityForToolbar(w2ui['actionbar']);
	},

	updateUserListCount: function() {
		var actionbar = w2ui.actionbar;
		var userlistItem = actionbar && actionbar.get('userlist');
		if (userlistItem == null) {
			return;
		}
	
		var count = $(userlistItem.html).find('#userlist_table tbody tr').length;
		if (count > 1) {
			userlistItem.text = this.options.nUsers.replace('%n', count);
		} else if (count === 1) {
			userlistItem.text = this.options.oneUser;
		} else {
			userlistItem.text = this.options.noUser;
		}
	
		w2ui['actionbar'].refresh();
	
		var hideUserList =
			window.ThisIsAMobileApp ||
			(this.map['wopi'].HideUserList !== null && this.map['wopi'].HideUserList !== undefined &&
				($.inArray('true', this.map['wopi'].HideUserList) >= 0) ||
				(window.mode.isMobile() && $.inArray('mobile', this.map['wopi'].HideUserList) >= 0) ||
				(window.mode.isTablet() && $.inArray('tablet', this.map['wopi'].HideUserList) >= 0) ||
				(window.mode.isDesktop() && $.inArray('desktop', this.map['wopi'].HideUserList) >= 0));
	
		if (!hideUserList && count > 1) {
			actionbar.show('userlist');
			actionbar.show('userlistbreak');
		} else {
			actionbar.hide('userlist');
			actionbar.hide('userlistbreak');
		}
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

		if (id === 'zoomin' && this.map.getZoom() < this.map.getMaxZoom()) {
			this.map.zoomIn(1);
		}
		else if (id === 'zoomout' && this.map.getZoom() > this.map.getMinZoom()) {
			this.map.zoomOut(1);
		}
		else if (item.scale) {
			this.map.setZoom(item.scale);
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
			});
		}
	},

	create: function() {
		var toolbar = $('#toolbar-down');
		var that = this;

		if (!window.mode.isMobile()) {
			toolbar.w2toolbar({
				name: 'actionbar',
				tooltip: 'top',
				items: [
					{type: 'html',  id: 'search',
					html: '<div style="padding: 3px 5px 3px 10px;" class="loleaflet-font">' +
					'<input size="15" id="search-input" placeholder="' + _('Search') + '"' +
					'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>' +
					'</div>'
					},
					{type: 'button',  id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
					{type: 'button',  id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
					{type: 'button',  id: 'cancelsearch', img: 'cancel', hint: _('Cancel the search'), hidden: true},
					{type: 'html',  id: 'left'},
					{type: 'html',  id: 'right'},
					{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
						'<hr><table class="loleaflet-font" id="editor-btn">' +
						'<tr>' +
						'<td><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"></td>' +
						'<td>' + _('Always follow the editor') + '</td>' +
						'</tr>' +
						'</table>' +
						'<p id="currently-msg">' + _('Current') + ' - <b><span id="current-editor"></span></b></p>' +
						'</div>'
					},
					{type: 'break', id: 'userlistbreak', hidden: true, mobile: false },
					{type: 'button',  id: 'prev', img: 'prev', hint: _UNO('.uno:PageUp', 'text')},
					{type: 'button',  id: 'next', img: 'next', hint: _UNO('.uno:PageDown', 'text')},
					{type: 'break', id: 'prevnextbreak'},
					{type: 'button',  id: 'zoomreset', img: 'zoomreset', hint: _('Reset zoom')},
					{type: 'button',  id: 'zoomout', img: 'zoomout', hint: _UNO('.uno:ZoomMinus')},
					{type: 'menu-radio', id: 'zoom', text: '100',
						selected: 'zoom100',
						mobile: false,
						items: [
							{ id: 'zoom50', text: '50', scale: 6},
							{ id: 'zoom60', text: '60', scale: 7},
							{ id: 'zoom70', text: '70', scale: 8},
							{ id: 'zoom85', text: '85', scale: 9},
							{ id: 'zoom100', text: '100', scale: 10},
							{ id: 'zoom120', text: '120', scale: 11},
							{ id: 'zoom150', text: '150', scale: 12},
							{ id: 'zoom175', text: '175', scale: 13},
							{ id: 'zoom200', text: '200', scale: 14}
						]
					},
					{type: 'button',  id: 'zoomin', img: 'zoomin', hint: _UNO('.uno:ZoomPlus')}
				],
				onClick: function (e) {
					that.hideTooltip(this, e.target);
					if (e.item.id === 'userlist') {
						setTimeout(function() {
							var cBox = $('#follow-checkbox')[0];
							var docLayer = that.map._docLayer;
							var editorId = docLayer._editorId;

							if (cBox)
								cBox.checked = docLayer._followEditor;

							if (docLayer.editorId !== -1 && that.map._viewInfo[editorId])
								$('#current-editor').text(that.map._viewInfo[editorId].username);
							else
								$('#currently-msg').hide();
						}, 100);
						return;
					}
					that.onClick(e, e.target, e.item, e.subItem);
				},
				onRefresh: function() {
					$('#tb_actionbar_item_userlist .w2ui-tb-caption').addClass('loleaflet-font');
					window.setupSearchInput();
				}
			});
		}

		toolbar.bind('touchstart', function() {
			w2ui['actionbar'].touchStarted = true;
		});

		this.map.on('search', function (e) {
			var searchInput = L.DomUtil.get('search-input');
			var toolbar = w2ui['actionbar'];
			if (e.count === 0) {
				toolbar.disable('searchprev');
				toolbar.disable('searchnext');
				toolbar.hide('cancelsearch');
				L.DomUtil.addClass(searchInput, 'search-not-found');
				$('#findthis').addClass('search-not-found');
				that.map.resetSelection();
				setTimeout(function () {
					$('#findthis').removeClass('search-not-found');
					L.DomUtil.removeClass(searchInput, 'search-not-found');
				}, 500);
			}
		});

		if (!window.mode.isMobile()) {	
			this.map.on('showbusy', function(e) {
				w2utils.lock(w2ui['actionbar'].box, e.label, true);
			});
	
			this.map.on('hidebusy', function() {
				// If locked, unlock
				if (w2ui['actionbar'].box.firstChild.className === 'w2ui-lock') {
					w2utils.unlock(w2ui['actionbar'].box);
				}
			});
		}

		this.map.on('zoomend', function () {
			var zoomPercent = 100;
			var zoomSelected = null;
			switch (that.map.getZoom()) {
			case 6:  zoomPercent =  50; zoomSelected = 'zoom50'; break;
			case 7:  zoomPercent =  60; zoomSelected = 'zoom60'; break;
			case 8:  zoomPercent =  70; zoomSelected = 'zoom70'; break;
			case 9:  zoomPercent =  85; zoomSelected = 'zoom85'; break;
			case 10: zoomPercent = 100; zoomSelected = 'zoom100'; break;
			case 11: zoomPercent = 120; zoomSelected = 'zoom120'; break;
			case 12: zoomPercent = 150; zoomSelected = 'zoom150'; break;
			case 13: zoomPercent = 175; zoomSelected = 'zoom175'; break;
			case 14: zoomPercent = 200; zoomSelected = 'zoom200'; break;
			default:
				var zoomRatio = that.map.getZoomScale(that.map.getZoom(), that.map.options.zoom);
				zoomPercent = Math.round(zoomRatio * 100) + '%';
				break;
			}
			w2ui['actionbar'].set('zoom', {text: zoomPercent, selected: zoomSelected});
		});
	},

	onDocLayerInit: function () {
		var statusbar = w2ui['actionbar'];
		var docType = this.map.getDocType();

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
						html: '<div id="RowColSelCount" class="loleaflet-font" title="' + _('Selected range of cells') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
					},
					{type: 'break', id: 'break3', tablet: false},
					{
						type: 'html', id: 'InsertMode', mobile: false, tablet: false,
						html: '<div id="InsertMode" class="loleaflet-font" title="' + _('Entering text mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
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
					{type: 'break', id: 'break9', mobile: false}
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
						html: '<div id="InsertMode" class="loleaflet-font" title="' + _('Entering text mode') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
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
					{type: 'break', id: 'break8', mobile: false}
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
					{type: 'break', id: 'break8', mobile: false}
				]);
			}
		
		// FALLTHROUGH intended
		case 'drawing':
			if (statusbar)
				statusbar.show('prev', 'next');
			break;
		}

		if (window.mode.isMobile() || window.mode.isTablet()) {
			this.options.nUsers = '%n';
			this.options.oneUser = '1';
			this.options.noUser = '0';
		} else {
			this.options.nUsers = _('%n users');
			this.options.oneUser = _('1 user');
			this.options.noUser = _('0 users');
		}

		this.updateUserListCount();

		this._updateToolbarsVisibility();

		if (statusbar)
			statusbar.refresh();
	},

	onAddView: function(e) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		var username = this.escapeHtml(e.username);
		var showPopup = false;
	
		if (userlistItem !== null)
			showPopup = $(userlistItem.html).find('#userlist_table tbody tr').length > 0;
	
		if (showPopup) {
			$('#tb_actionbar_item_userlist')
				.w2overlay({
					class: 'loleaflet-font',
					html: this.options.userJoinedPopupMessage.replace('%user', username),
					style: 'padding: 5px'
				});
			clearTimeout(this.options.userPopupTimeout);
			var that = this;
			this.options.userPopupTimeout = setTimeout(function() {
				$('#tb_actionbar_item_userlist').w2overlay('');
				clearTimeout(that.options.userPopupTimeout);
				that.options.userPopupTimeout = null;
			}, 3000);
		}
	
		var color = L.LOUtil.rgbToHex(this.map.getViewColor(e.viewId));
		if (e.viewId === this.map._docLayer._viewId) {
			username = _('You');
			color = '#000';
		}
	
		// Mention readonly sessions in userlist
		if (e.readonly) {
			username += ' (' +  _('Readonly') + ')';
		}
	
		if (userlistItem !== null) {
			var newhtml = $(userlistItem.html).find('#userlist_table tbody').append(this.getUserItem(e.viewId, username, e.extraInfo, color)).parent().parent()[0].outerHTML;
			userlistItem.html = newhtml;
			this.updateUserListCount();
		}
	},

	onRemoveView: function(e) {
		$('#tb_actionbar_item_userlist')
			.w2overlay({
				class: 'loleaflet-font',
				html: this.options.userLeftPopupMessage.replace('%user', e.username),
				style: 'padding: 5px'
			});
		clearTimeout(this.options.userPopupTimeout);
		this.options.userPopupTimeout = setTimeout(function() {
			$('#tb_actionbar_item_userlist').w2overlay('');
			clearTimeout(this.options.userPopupTimeout);
			this.options.userPopupTimeout = null;
		}, 3000);
	
		if (e.viewId === this.map._docLayer._followThis) {
			this.map._docLayer._followThis = -1;
			this.map._docLayer._followUser = false;
		}
	
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem !== null) {
			userlistItem.html = $(userlistItem.html).find('#user-' + e.viewId).remove().end()[0].outerHTML;
			this.updateUserListCount();
		}
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
			this.updateToolbarItem(statusbar, 'RowColSelCount', $('#RowColSelCount').html(state ? state : '<span class="ToolbarStatusInactive">&nbsp;Select multiple cells&nbsp;</span>').parent().html());
		}
		else if (commandName === '.uno:InsertMode') {
			this.updateToolbarItem(statusbar, 'InsertMode', $('#InsertMode').html(state ? L.Styles.insertMode[state].toLocaleString() : '<span class="ToolbarStatusInactive">&nbsp;Insert mode: inactive&nbsp;</span>').parent().html());
	
			if (!state && this.map.hyperlinkPopup) {
				this.map.hyperlinkUnderCursor = null;
				this.map.closePopup(this.map.hyperlinkPopup);
				this.map.hyperlinkPopup = null;
			}
		}
		else if (commandName === '.uno:StatusSelectionMode' ||
				commandName === '.uno:SelectionMode') {
			this.updateToolbarItem(statusbar, 'StatusSelectionMode', $('#StatusSelectionMode').html(state ? L.Styles.selectionMode[state].toLocaleString() : '<span class="ToolbarStatusInactive">&nbsp;Selection mode: inactive&nbsp;</span>').parent().html());
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
				languages.push({ translated: _(language), neutral: language });
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
				var splitTranslated = translated.split(';');
				var splitNeutral = neutral.split(';');
				toolbaritems.push({ id: neutral, text: splitTranslated[0], uno: constLang + encodeURIComponent('Default_' + splitNeutral[0]) });
			}
	
			toolbaritems.push({ id: 'reset', text: resetLang, uno: constLang + constDefault });
	
			w2ui['actionbar'].set('LanguageStatus', {items: toolbaritems});
		}
	},

	deselectUser: function(e) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}
	
		userlistItem.html = $(userlistItem.html).find('#user-' + e.viewId).removeClass('selected-user').parent().parent().parent()[0].outerHTML;
	},
});

L.control.statusBar = function () {
	return new L.Control.StatusBar();
};
