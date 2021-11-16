/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.UserList
 */

/* global $ w2ui _ */
L.Control.UserList = L.Control.extend({
	options: {
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
	},

	onUseritemClicked: function(e) { // eslint-disable-line no-unused-vars
		var docLayer = this.map._docLayer;
		var viewId = parseInt(e.currentTarget.id.replace('user-', ''));

		this.map._goToViewId(viewId);

		if (viewId === this.map._docLayer._viewId) {
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

		w2ui['actionbar'].uncheck('userlist');
	},

	getUserItem: function(viewId, userName, extraInfo, color) {
		var content = L.DomUtil.create('tr', 'useritem');
		content.id = 'user-' + viewId;
		$(document).on('click', '#' + content.id, this.onUseritemClicked.bind(this));

		var iconTd = L.DomUtil.create('td', 'usercolor', content);
		var nameTd = L.DomUtil.create('td', 'username cool-font', content);
		this.options.listUser.push({viewId: viewId, userName: userName, extraInfo: extraInfo, color: color});

		if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
			this.options.listUser.push({viewId: viewId, userName: userName, extraInfo: extraInfo, color: color});
			var img = L.DomUtil.create('img', 'avatar-img', iconTd);
			img.src = extraInfo.avatar;
			var altImg = L.LOUtil.getImageURL('user.svg');
			img.setAttribute('onerror', 'this.onerror=null;this.src=\'' + altImg + '\';');
			$(img).css({'border-color': color});
		} else {
			img = L.DomUtil.create('div', 'user-info', iconTd);
			$(img).css({'background-color': color});
		}

		nameTd.textContent = userName;

		return content;
	},

	findShowUser: function(id) {
		var total = 0;
		this.options.listUser.slice(-3).forEach(function(user) {
			if (user.viewId == id) {
				total += 1;
			}
		});

		return total > 0;
	},

	renderUserAvatars: function() {
		var self = this;

		this.options.listUser.forEach(function(user) {
			if (!self.findShowUser(user.viewId)) {
				$('#user-top-' + user.viewId).remove();
			}
		});

		this.options.listUser.slice(-3).forEach(function (user) {
			if (!$('#user-top-' + user.viewId).length) {
				$('#userListSummary').append('<p id="user-top-' + user.viewId + '" class="user-top" style="background-image:url(\'https://localhost:9980/loleaflet/81bf78491/images/lc_ellipse_branding.svg\');border-color:' + user.color + ';"></p>');
			}
		});
		this.options.listUser.forEach(function (user) {	
			var avatarElement = '<div class="user-item-wrapper" id="user-'+ user.viewId + '"><p class="user-item" style="background-image:url(\'https://localhost:9980/loleaflet/81bf78491/images/lc_ellipse_branding.svg\');border-color:' + user.color + '"></p><span> ' 
			+ user.userName +'</span></div>';
			if (!$('#user-' + user.viewId).length) {
				$('#userListPopover').prepend(avatarElement);
			}
		});

		self.renderFollowMainUserOption();
	},

	renderFollowMainUserOption: function() {
		if ($('#follow-editor').length == 0) {
			$('#userListPopover').append('<div id="follow-editor"><input type="checkbox" class="follow-editor-checkbox" name="alwaysFollow" onclick="editorUpdate(event)"/>' + _('Follow current editor') + '</div>');
		}
	},

	removeUserFromList: function(viewId) {
		var index = null;
		this.options.listUser.forEach(function(item, idx) {
			if (item.viewId == viewId) {
				index = idx;
			}
		});
		$('#user-top-' + viewId).remove();
		$('#user-' + viewId).remove();
		this.options.listUser.splice(index, 1);
		this.renderUserAvatars();
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

	deselectUser: function(e) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}

		$('#user-' + e.viewId).removeClass('selected-user');
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
			this.renderUserAvatars();
		}
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
			this.removeUserFromList(e.viewId);
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
