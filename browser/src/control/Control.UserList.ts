/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * L.Control.UserList
 */

interface UserExtraInfo {
	avatar: string;
}

interface User {
	userName: string;
	viewId: number;
	extraInfo: UserExtraInfo;
	color: string;
}

interface UserEvent {
	username: string;
	extraInfo: UserExtraInfo;
	color: string;
	viewId: number;
	readonly: boolean;
}

class UserList extends L.Control {
	options: {
		userLimitHeader: number;
		userPopupTimeout: null | ReturnType<typeof setTimeout>;
		userJoinedPopupMessage: string;
		userLeftPopupMessage: string;
		nUsers?: string;
		oneUser?: string;
		noUser?: string;
		listUser?: User[];
	} = {
		userLimitHeader: 6,
		userPopupTimeout: null,
		userJoinedPopupMessage: '<div>' + _('%user has joined') + '</div>',
		userLeftPopupMessage: '<div>' + _('%user has left') + '</div>',
		nUsers: undefined,
		oneUser: undefined,
		noUser: undefined,
		listUser: [],
	};

	onAdd(map: ReturnType<typeof L.map>) {
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

		map.on('updateEditorName', function (e: UserEvent) {
			$('#currently-msg').show();
			$('#current-editor').text(e.username);
		});

		this.registerHeaderAvatarEvents();
	}

	escapeHtml(input: string) {
		return $('<div>').text(input).html();
	}

	selectUser(viewId: number) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}

		$('#user-' + viewId).addClass('selected-user');
		L.DomUtil.addClass(
			document.querySelector(
				'#userListPopover .user-list-item[data-view-id="' + viewId + '"]',
			),
			'selected-user',
		);
	}

	followUser(viewId: number) {
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
	}

	onUseritemClicked(e: MouseEvent | TouchEvent) {
		var viewId = parseInt(
			(e.currentTarget as HTMLElement).id.replace('user-', ''),
		);

		if (viewId === this.map._docLayer._viewId) {
			w2ui['actionbar'].uncheck('userlist');
			return;
		}

		w2ui['actionbar'].uncheck('userlist');
	}

	createAvatar(
		viewId: number,
		_userName: string,
		extraInfo: UserExtraInfo,
		color: string,
	) {
		var img;
		if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
			img = L.DomUtil.create('img', 'avatar-img');
			img.src = extraInfo.avatar;
			var altImg = L.LOUtil.getImageURL(
				'user.svg',
				this.map._docLayer._docType,
			);
			img.setAttribute(
				'onerror',
				"this.onerror=null;this.src='" + altImg + "';",
			);
			$(img).css({ 'border-color': color });
		} else {
			img = L.DomUtil.create('div', 'user-info');
			$(img).css({
				'border-color': color,
				'background-color': '#eee',
				'background-image':
					'url("' +
					L.LOUtil.getImageURL('user.svg', this.map._docLayer._docType) +
					'")',
			});
		}
		img.setAttribute('data-view-id', viewId);
		L.LOUtil.checkIfImageExists(img);
		return img;
	}

	getUserItem(
		viewId: number,
		userName: string,
		extraInfo: UserExtraInfo,
		color: string,
	) {
		var content = L.DomUtil.create('tr', 'useritem');
		content.id = 'user-' + viewId;
		$(document).on(
			'click',
			'#' + content.id,
			this.onUseritemClicked.bind(this),
		);

		var iconTd = L.DomUtil.create('td', 'usercolor', content);
		var nameTd = L.DomUtil.create('td', 'username cool-font', content);

		iconTd.appendChild(this.createAvatar(viewId, userName, extraInfo, color));
		nameTd.textContent = userName;

		return content;
	}

	registerHeaderAvatarEvents() {
		var outsideClickListener = function (e: MouseEvent) {
			$('.main-nav.hasnotebookbar').css('overflow', 'scroll hidden');
			var selector = '#userListPopover';
			var $target = $(e.target);
			if (!$target.closest(selector).length && $(selector).is(':visible')) {
				$(selector).hide();
			}
			document.removeEventListener('click', outsideClickListener);
		};

		document
			.getElementById('userListSummary')
			.addEventListener('click', function (e) {
				e.stopPropagation();
				$('.main-nav.hasnotebookbar').css('overflow', 'visible');
				var selector = '#userListPopover';
				if ($(selector).is(':hidden')) {
					$(selector).show();
				} else {
					outsideClickListener(e);
				}
				document.addEventListener('click', outsideClickListener);
			});
	}

	hideUserList() {
		return (
			(window as any) /* TODO: remove cast after gh#8221 */.ThisIsAMobileApp ||
			(this.map['wopi'].HideUserList !== null &&
				this.map['wopi'].HideUserList !== undefined &&
				$.inArray('true', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isMobile() &&
				$.inArray('mobile', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isTablet() &&
				$.inArray('tablet', this.map['wopi'].HideUserList) >= 0) ||
			(window.mode.isDesktop() &&
				$.inArray('desktop', this.map['wopi'].HideUserList) >= 0)
		);
	}

	renderHeaderAvatars() {
		if (
			window.mode.isMobile() ||
			this.hideUserList() ||
			this.options.listUser.length === 1
		) {
			document.getElementById('userListSummary').removeAttribute('accesskey');
			return;
		}

		var headerUserList = this.options.listUser.slice(
			-this.options.userLimitHeader,
		);
		document.getElementById('userListSummary').setAttribute('accesskey', 'UP');

		// Remove users that should no longer be in the header
		Array.from(document.querySelectorAll('#userListSummary [data-view-id]'))
			.map(function (element) {
				return element.getAttribute('data-view-id');
			})
			.filter(function (viewId) {
				return (
					headerUserList
						.map(function (user: User) {
							return user.viewId;
						})
						.indexOf(parseInt(viewId)) === -1
				);
			})
			.forEach(function (viewId) {
				L.DomUtil.remove(
					document.querySelector(
						'#userListSummary [data-view-id="' + viewId + '"]',
					),
				);
			});

		// Summary rendering
		headerUserList.forEach(
			function (user: User) {
				if (
					!document.querySelector(
						'#userListSummary [data-view-id="' + user.viewId + '"]',
					)
				) {
					document
						.getElementById('userListSummary')
						.appendChild(
							this.createAvatar(
								user.viewId,
								user.userName,
								user.extraInfo,
								user.color,
							),
						);
				}
			}.bind(this),
		);

		// Popover rendering
		this.options.listUser.forEach(
			function (user: User) {
				if (
					document.querySelector(
						'#userListPopover .user-list-item[data-view-id="' +
							user.viewId +
							'"]',
					)
				) {
					return;
				}

				var userLabel = L.DomUtil.create('div', 'user-list-item--name');
				userLabel.innerText = user.userName;

				var userFollowingLabel = L.DomUtil.create(
					'div',
					'user-list-item--following-label',
				);
				userFollowingLabel.innerText = _('Following');
				var userLabelContainer = L.DomUtil.create(
					'div',
					'user-list-item--name-container',
				);
				userLabelContainer.appendChild(userLabel);
				userLabelContainer.appendChild(userFollowingLabel);

				var listItem = L.DomUtil.create('div', 'user-list-item');
				listItem.setAttribute('data-view-id', user.viewId);
				listItem.setAttribute('role', 'button');
				listItem.appendChild(
					this.createAvatar(
						user.viewId,
						user.userName,
						user.extraInfo,
						user.color,
					),
				);
				listItem.appendChild(userLabelContainer);
				listItem.addEventListener(
					'click',
					function () {
						this.followUser(user.viewId);
					}.bind(this),
					false,
				);

				var popoverList = document.getElementById('userListPopover');
				popoverList.insertBefore(listItem, popoverList.lastChild);
			}.bind(this),
		);

		if (!document.getElementById('follow-editor')) {
			var followEditorWrapper = L.DomUtil.create('div', '');
			followEditorWrapper.id = 'follow-editor';
			var followEditorCheckbox = L.DomUtil.create(
				'input',
				'follow-editor-checkbox',
				followEditorWrapper,
			);
			followEditorCheckbox.id = 'follow-editor-checkbox';
			followEditorCheckbox.setAttribute('type', 'checkbox');
			followEditorCheckbox.onchange = function (event: Event) {
				(window as any) /* TODO: remove cast after gh#8221 */
					.editorUpdate(event);
			};
			var followEditorCheckboxLabel = L.DomUtil.create(
				'label',
				'follow-editor-label',
				followEditorWrapper,
			);
			followEditorCheckboxLabel.innerText = _('Always follow the editor');
			followEditorCheckboxLabel.setAttribute('for', 'follow-editor-checkbox');

			document
				.getElementById('userListPopover')
				.appendChild(followEditorWrapper);
		}

		(
			document.getElementById('follow-editor-checkbox') as HTMLInputElement
		).checked = this.map._docLayer._followEditor;
	}

	removeUserFromHeaderAvatars(viewId: number) {
		var index = null;
		this.options.listUser.forEach(function (item, idx) {
			if (item.viewId == viewId) {
				index = idx;
			}
		});

		L.DomUtil.remove(
			document.querySelector(
				'#userListSummary [data-view-id="' + viewId + '"]',
			),
		);
		L.DomUtil.remove(
			document.querySelector(
				'#userListPopover .user-list-item[data-view-id="' + viewId + '"]',
			),
		);
		this.options.listUser.splice(index, 1);
		this.renderHeaderAvatars();
	}

	updateUserListCount() {
		var actionbar = w2ui.actionbar;
		var userlistItem = actionbar && actionbar.get('userlist');
		if (userlistItem == null) {
			return;
		}

		var count = $(userlistItem.html).find('#userlist_table tbody tr').length;
		if (count > 1) {
			userlistItem.text = this.options.nUsers.replace('%n', count.toString());
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
	}

	deselectUser(e: UserEvent) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem === null) {
			return;
		}

		$('#user-' + e.viewId).removeClass('selected-user');
		L.DomUtil.removeClass(
			document.querySelector(
				'#userListPopover .user-list-item[data-view-id="' + e.viewId + '"]',
			),
			'selected-user',
		);
	}

	onOpenUserList() {
		setTimeout(() => {
			var cBox = $('#follow-checkbox')[0];
			var docLayer = this.map._docLayer;
			var editorId = docLayer._editorId;
			var viewId = docLayer._followThis;
			var followUser = docLayer._followUser;

			if (cBox) (cBox as HTMLInputElement).checked = docLayer._followEditor;

			if (docLayer.editorId !== -1 && this.map._viewInfo[editorId])
				$('#current-editor').text(this.map._viewInfo[editorId].username);
			else $('#currently-msg').hide();

			if (followUser) this.selectUser(viewId);
		}, 100);
	}

	onAddView(e: UserEvent) {
		var userlistItem = w2ui['actionbar'].get('userlist');
		var username = this.escapeHtml(e.username);
		var showPopup = false;

		if (userlistItem !== null)
			showPopup =
				$(userlistItem.html).find('#userlist_table tbody tr').length > 0;

		if (showPopup) {
			$('#tb_actionbar_item_userlist').w2overlay({
				class: 'cool-font',
				html: this.options.userJoinedPopupMessage.replace('%user', username),
				style: 'padding: 5px',
			});
			clearTimeout(this.options.userPopupTimeout);
			this.options.userPopupTimeout = setTimeout(() => {
				$('#tb_actionbar_item_userlist').w2overlay('');
				clearTimeout(this.options.userPopupTimeout);
				this.options.userPopupTimeout = null;
			}, 3000);
		}

		var color = L.LOUtil.rgbToHex(this.map.getViewColor(e.viewId));
		if (e.viewId === this.map._docLayer._viewId) {
			username = _('You');
			color = '#000';
		}

		// Mention readonly sessions in userlist
		if (e.readonly) {
			username += ' (' + _('Readonly') + ')';
		}

		if (userlistItem !== null) {
			var newhtml = $(userlistItem.html)
				.find('#userlist_table tbody')
				.append(this.getUserItem(e.viewId, username, e.extraInfo, color))
				.parent()
				.parent()[0].outerHTML;
			userlistItem.html = newhtml;
			this.updateUserListCount();
		}

		this.options.listUser.push({
			viewId: e.viewId,
			userName: username,
			extraInfo: e.extraInfo,
			color: color,
		});
		this.renderHeaderAvatars();
	}

	onRemoveView(e: UserEvent) {
		var username = this.escapeHtml(e.username);
		$('#tb_actionbar_item_userlist').w2overlay({
			class: 'cool-font',
			html: this.options.userLeftPopupMessage.replace('%user', username),
			style: 'padding: 5px',
		});
		clearTimeout(this.options.userPopupTimeout);
		this.options.userPopupTimeout = setTimeout(() => {
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
			userlistItem.html = $(userlistItem.html)
				.find('#user-' + e.viewId)
				.remove()
				.end()[0].outerHTML;
			this.updateUserListCount();
			this.removeUserFromHeaderAvatars(e.viewId);
		}
	}
}

L.control.userList = function () {
	return new UserList();
};

L.control.createUserListWidget = function () {
	return (
		'<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
		'<hr><table class="cool-font" id="editor-btn">' +
		'<tr>' +
		'<td><label id="follow-container"><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"><span class="checkmark"></span></label></td>' +
		'<td>' +
		_('Always follow the editor') +
		'</td>' +
		'</tr>' +
		'</table>' +
		'<p id="currently-msg">' +
		_('Current') +
		' - <b><span id="current-editor"></span></b></p>' +
		'</div>'
	);
};
