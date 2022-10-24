/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.UserList
 */

/* global $ w2ui _ */
L.Control.UserList = L.Control.extend({
	options: {
		userLimitHeader: 6,
		userPopupTimeout: null,
		userJoinedPopupMessage: '<div>' + _('%user has joined') + '</div>',
		userLeftPopupMessage: '<div>' + _('%user has left') + '</div>',
		nUsers: undefined,
		oneUser: undefined,
		noUser: undefined,
		listUser: []
	},

	initialize: function () {
	},

	onAdd: function (map) {
		this.map = map;

		map.on('addview', this.onAddView, this);
		map.on('removeview', this.onRemoveView, this);
		map.on('deselectuser', this.deselectUser, this);
		map.on('openuserlist', this.onOpenUserList, this);

		if (window.mode.isMobile() || window.mode.isTablet()) {
			this.options.nUsers = '%n';
			this.options.oneUser = '1';
			this.options.noUser = '0';
		} else {
			this.options.nUsers = _('%n users');
			this.options.oneUser = _('1 user');
			this.options.noUser = _('0 users');
		}

		map.on('updateEditorName', function(e) {
			$('#currently-msg').show();
			$('#current-editor').text(e.username);
		});


		this.registerHeaderAvatarEvents();
	},

	escapeHtml: function(input) {
		return $('<div>').text(input).html();
	},

	selectUser: function(viewId) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}

		$('#user-' + viewId).addClass('selected-user');
		L.DomUtil.addClass(document.querySelector('#userListPopover .user-list-item[data-view-id="' + viewId + '"]'), 'selected-user');
	},

	followUser: function(viewId) {
		$('#userListPopover').hide();
		var docLayer = this.map._docLayer;
		this.map._goToViewId(viewId);

		if (viewId === docLayer._viewId) {
			this.map._setFollowing(false, null);
			w2ui['actionbar'].uncheck('userlist');
			return;
		} else if (docLayer._followThis !== -1) {
			this.map._setFollowing(false, null);
		}

		docLayer._followThis = viewId;
		docLayer._followUser = true;
		docLayer._followEditor = false;

		this.selectUser(viewId);
	},

	onUseritemClicked: function(e) { // eslint-disable-line no-unused-vars
		var viewId = parseInt(e.currentTarget.id.replace('user-', ''));

		if (viewId === this.map._docLayer._viewId) {
			w2ui['actionbar'].uncheck('userlist');
			return;
		}

		w2ui['actionbar'].uncheck('userlist');
	},

	getUserItem: function(viewId, userName, extraInfo, color) {
		var content = L.DomUtil.create('tr', 'useritem');
		content.id = 'user-' + viewId;
		$(document).on('click', '#' + content.id, this.onUseritemClicked.bind(this));

		var iconTd = L.DomUtil.create('td', 'usercolor', content);
		var nameTd = L.DomUtil.create('td', 'username cool-font', content);

		iconTd.appendChild(L.control.createAvatar(viewId, userName, extraInfo, color));
		nameTd.textContent = userName;

		return content;
	},

	registerHeaderAvatarEvents: function() {
		var outsideClickListener = function(e) {
			$('.main-nav.hasnotebookbar').css('overflow', 'scroll hidden');
			var selector = '#userListPopover';
			var $target = $(e.target);
			if (!$target.closest(selector).length && $(selector).is(':visible')) {
				$(selector).hide();
			}
			document.removeEventListener('click', outsideClickListener);
		};

		document.getElementById('userListSummary').addEventListener('click', function(e) {
			e.stopPropagation();
			$('.main-nav.hasnotebookbar').css('overflow', 'visible');
			$('#userListPopover').show();
			document.addEventListener('click', outsideClickListener);
		});
	},

	hideUserList: function() {
		return window.ThisIsAMobileApp ||
		(this.map['wopi'].HideUserList !== null && this.map['wopi'].HideUserList !== undefined &&
			($.inArray('true', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isMobile() && $.inArray('mobile', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isTablet() && $.inArray('tablet', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isDesktop() && $.inArray('desktop', this.map['wopi'].HideUserList) >= 0));
	},

	renderHeaderAvatars: function() {
		if (!window.mode.isDesktop() || this.hideUserList() || this.options.listUser.length === 1) {
			return;
		}

		var that = this;

		var headerUserList = this.options.listUser.slice(-this.options.userLimitHeader);

		// Remove users that should no longer be in the header
		Array.from(document.querySelectorAll('#userListSummary [data-view-id]')).map(function(element) {
			return element.getAttribute('data-view-id');
		}).filter(function(viewId) {
			return headerUserList.map(function(user) {
				return user.viewId;
			}).indexOf(viewId) === -1;
		}).forEach(function(viewId) {
			L.DomUtil.remove(document.querySelector('#userListSummary [data-view-id="' + viewId + '"]'));
		});

		// Summary rendering
		headerUserList.forEach(function (user) {
			if (!document.querySelector('#userListSummary [data-view-id="' + user.viewId + '"]')) {
				document.getElementById('userListSummary').appendChild(L.control.createAvatar(user.viewId, user.userName, user.extraInfo, user.color));
			}
		});

		// Popover rendering
		this.options.listUser.forEach(function (user) {
			if (document.querySelector('#userListPopover .user-list-item[data-view-id="' + user.viewId + '"]')) {
				return;
			}

			var userLabel = L.DomUtil.create('div', 'user-list-item--name');
			userLabel.innerText = user.userName;

			var userFollowingLabel = L.DomUtil.create('div', 'user-list-item--following-label');
			userFollowingLabel.innerText = _('Following');
			var userLabelContainer = L.DomUtil.create('div', 'user-list-item--name-container');
			userLabelContainer.appendChild(userLabel);
			userLabelContainer.appendChild(userFollowingLabel);

			var listItem = L.DomUtil.create('div', 'user-list-item');
			listItem.setAttribute('data-view-id', user.viewId);
			listItem.setAttribute('role', 'button');
			listItem.appendChild(L.control.createAvatar(user.viewId, user.userName, user.extraInfo, user.color));
			listItem.appendChild(userLabelContainer);
			listItem.addEventListener('click', function () {
				that.followUser(user.viewId);
			}, false);

			var popoverList = document.getElementById('userListPopover');
			popoverList.insertBefore(listItem, popoverList.lastChild);
		});

		if (!document.getElementById('follow-editor')) {
			var followEditorWrapper = L.DomUtil.create('div', '');
			followEditorWrapper.id = 'follow-editor';
			var followEditorCheckbox = L.DomUtil.create('input', 'follow-editor-checkbox', followEditorWrapper);
			followEditorCheckbox.id = 'follow-editor-checkbox';
			followEditorCheckbox.setAttribute('type', 'checkbox');
			followEditorCheckbox.onchange = function(event) {
				window.editorUpdate(event);
			};
			var followEditorCheckboxLabel = L.DomUtil.create('label', 'follow-editor-label', followEditorWrapper);
			followEditorCheckboxLabel.innerText = _('Always follow the editor');
			followEditorCheckboxLabel.setAttribute('for', 'follow-editor-checkbox');

			document.getElementById('userListPopover').appendChild(followEditorWrapper);
		}

		document.getElementById('follow-editor-checkbox').checked = that.map._docLayer._followEditor;
	},

	removeUserFromHeaderAvatars: function(viewId) {
		var index = null;
		this.options.listUser.forEach(function(item, idx) {
			if (item.viewId == viewId) {
				index = idx;
			}
		});

		L.DomUtil.remove(document.querySelector('#userListSummary [data-view-id="' + viewId + '"]'));
		L.DomUtil.remove(document.querySelector('#userListPopover .user-list-item[data-view-id="' + viewId + '"]'));
		this.options.listUser.splice(index, 1);
		this.renderHeaderAvatars();
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

		if (!this.hideUserList() && count > 1 && !window.mode.isDesktop()) {
			actionbar.show('userlist');
			actionbar.show('userlistbreak');
		} else {
			actionbar.hide('userlist');
			actionbar.hide('userlistbreak');
		}
	},

	deselectUser: function(e) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}

		$('#user-' + e.viewId).removeClass('selected-user');
		L.DomUtil.removeClass(document.querySelector('#userListPopover .user-list-item[data-view-id="' + e.viewId + '"]'), 'selected-user');
	},

	onOpenUserList: function() {
		var that = this;
		setTimeout(function () {
			var cBox = $('#follow-checkbox')[0];
			var docLayer = that.map._docLayer;
			var editorId = docLayer._editorId;
			var viewId = docLayer._followThis;
			var followUser = docLayer._followUser;

			if (cBox)
				cBox.checked = docLayer._followEditor;

			if (docLayer.editorId !== -1 && that.map._viewInfo[editorId])
				$('#current-editor').text(that.map._viewInfo[editorId].username);
			else
				$('#currently-msg').hide();

			if (followUser)
				that.selectUser(viewId);
		}, 100);
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
					class: 'cool-font',
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

		this.options.listUser.push({viewId: e.viewId, userName: username, extraInfo: e.extraInfo, color: color});
		this.renderHeaderAvatars();
	},

	onRemoveView: function(e) {
		var that = this;
		var username = this.escapeHtml(e.username);
		$('#tb_actionbar_item_userlist')
			.w2overlay({
				class: 'cool-font',
				html: this.options.userLeftPopupMessage.replace('%user', username),
				style: 'padding: 5px'
			});
		clearTimeout(this.options.userPopupTimeout);
		this.options.userPopupTimeout = setTimeout(function() {
			$('#tb_actionbar_item_userlist').w2overlay('');
			clearTimeout(that.options.userPopupTimeout);
			that.options.userPopupTimeout = null;
		}, 3000);

		if (e.viewId === this.map._docLayer._followThis) {
			this.map._docLayer._followThis = -1;
			this.map._docLayer._followUser = false;
		}

		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem !== null) {
			userlistItem.html = $(userlistItem.html).find('#user-' + e.viewId).remove().end()[0].outerHTML;
			this.updateUserListCount();
			this.removeUserFromHeaderAvatars(e.viewId);
		}
	},
});

L.control.userList = function () {
	return new L.Control.UserList();
};

L.control.createUserListWidget = function () {
	return '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
		'<hr><table class="cool-font" id="editor-btn">' +
		'<tr>' +
		'<td><label id="follow-container"><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"><span class="checkmark"></span></label></td>' +
		'<td>' + _('Always follow the editor') + '</td>' +
		'</tr>' +
		'</table>' +
		'<p id="currently-msg">' + _('Current') + ' - <b><span id="current-editor"></span></b></p>' +
		'</div>';
};

L.control.createAvatar = function (viewId, userName, extraInfo, color) {
	var img;
	if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
		img = L.DomUtil.create('img', 'avatar-img');
		img.src = extraInfo.avatar;
		var altImg = L.LOUtil.getImageURL('user.svg');
		img.setAttribute('onerror', 'this.onerror=null;this.src=\'' + altImg + '\';');
		$(img).css({'border-color': color});
	} else {
		img = L.DomUtil.create('div', 'user-info');
		$(img).css({'border-color': color, 'background-color': '#eee', 'background-image': 'url("' + L.LOUtil.getImageURL('user.svg') + '")'});
	}
	img.setAttribute('data-view-id', viewId);
	return img;
};
