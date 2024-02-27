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
	username: string;
	extraInfo: UserExtraInfo;
	color: string;
	readonly: boolean;
	you: boolean;
	following: boolean;
}

interface UserEvent extends User {
	viewId: number;
}

class UserList extends L.Control {
	options: {
		userLimitHeader: number;
		userLimitHeaderWhenFollowing: number;
		userPopupTimeout: null | ReturnType<typeof setTimeout>;
		userJoinedPopupMessage: string;
		userLeftPopupMessage: string;
		followingChipText: string;
		nUsers?: string;
		oneUser?: string;
		noUser?: string;
	} = {
		userLimitHeader: 6,
		userLimitHeaderWhenFollowing: 3,
		userPopupTimeout: null,
		userJoinedPopupMessage: '<div>' + _('%user has joined') + '</div>',
		userLeftPopupMessage: '<div>' + _('%user has left') + '</div>',
		followingChipText:
			'<div><b>' +
			_('Following %user') +
			'</b></div><div>' +
			_('Click to stop following') +
			'</div>',
		nUsers: undefined,
		oneUser: undefined,
		noUser: undefined,
	};

	users: Map<number, User> = new Map();

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

		const user = this.users.get(viewId);

		if (user === undefined) {
			return;
		}

		user.following = true;

		this.renderAll();
	}

	getFollowedUser(): undefined | [number, any] {
		if (
			this.map._docLayer._followThis === -1 ||
			!this.map._docLayer._followUser
		) {
			return undefined;
		}

		const followedUser = this.users.get(this.map._docLayer._followThis);

		if (followedUser === undefined) {
			return undefined;
		}

		return [this.map._docLayer._followThis, followedUser];
	}

	unfollowAll() {
		this.followUser(this.map._docLayer._viewId);
	}

	followUser(viewId: number) {
		const myViewId = this.map._docLayer._viewId;
		const followingViewId = this.map._docLayer._followThis;

		const follow = viewId !== myViewId && viewId !== followingViewId;

		$('#userListPopover').hide();
		var docLayer = this.map._docLayer;

		if (!follow) {
			this.map._goToViewId(myViewId);
			this.map._setFollowing(false, null);
			w2ui['actionbar'].uncheck('userlist');
			this.renderAll();
			return;
		} else if (followingViewId !== -1) {
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
		extraInfo: UserExtraInfo,
		color: string,
		zIndex?: number | 'auto',
	) {
		if (zIndex === undefined) {
			zIndex = 'auto';
		}

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
		} else {
			img = L.DomUtil.create('div', 'user-info');
			img.style.backgroundColor = '#eee';
			img.style.backgroundImage =
				'url("' +
				L.LOUtil.getImageURL('user.svg', this.map._docLayer._docType) +
				'")';
		}

		img.style.zIndex = zIndex;
		img.style.borderColor = color;
		img.style.backgroundColor = 'var(--color-background-lighter)';

		img.setAttribute('data-view-id', viewId);
		L.LOUtil.checkIfImageExists(img);
		return img;
	}

	getUserItem(
		viewId: number,
		username: string,
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

		iconTd.appendChild(this.createAvatar(viewId, extraInfo, color));
		nameTd.textContent = username;

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

	getSortedUsers(): Generator<[number, User], undefined, undefined> {
		return function* (
			this: UserList,
		): Generator<[number, User], undefined, undefined> {
			const self = this.users.get(this.map._docLayer._viewId);

			if (this.users.get(this.map._docLayer._viewId) === undefined) {
				return;
			}

			const followedUser = this.getFollowedUser();

			if (followedUser !== undefined) {
				yield followedUser;
			}

			yield [this.map._docLayer._viewId, self];

			const readonlyUsers: [number, User][] = [];

			for (const [viewId, user] of Array.from(this.users.entries()).reverse()) {
				const isSelf = viewId === this.map._docLayer._viewId;
				const isFollowed =
					followedUser !== undefined && viewId === followedUser[0];
				if (isSelf || isFollowed) {
					continue;
				}

				if (user.readonly) {
					readonlyUsers.push([viewId, user]);
					continue;
				}

				yield [viewId, user];
			}

			yield* readonlyUsers;
		}.bind(this)();
	}

	renderHeaderAvatars() {
		const userListElementBackground = document.getElementById(
			'userListSummaryBackground',
		);
		const userListElement = document.getElementById('userListSummary');

		if (
			window.mode.isMobile() ||
			this.hideUserList() ||
			this.users.size === 1
		) {
			userListElement.removeAttribute('accesskey');
			userListElementBackground.style.display = 'none';
			return;
		}

		let displayCount: number;

		if (this.getFollowedUser() === undefined) {
			displayCount = this.options.userLimitHeader;
		} else {
			displayCount = this.options.userLimitHeaderWhenFollowing;
		}

		const avatarUsers = Array.from(this.getSortedUsers()).slice(
			0,
			displayCount,
		);
		const followed = this.getFollowedUser();

		userListElement.setAttribute('accesskey', 'UP');

		userListElement.replaceChildren(
			...avatarUsers.map(([viewId, user], index) => {
				const img = this.createAvatar(
					viewId,
					user.extraInfo,
					user.color,
					displayCount - index,
				);

				if (followed !== undefined && followed[0] === viewId) {
					img.classList.add('following');
				}

				return img;
			}),
		);

		userListElementBackground.style.display = 'block';
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

		const user = this.users.get(e.viewId);

		if (user === undefined) {
			return;
		}

		user.following = false;

		this.renderAll();
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
		let color;
		let username;
		let you;

		if (e.viewId === this.map._docLayer._viewId) {
			username = _('You');
			color = '#000';
			you = true;
		} else {
			username = this.escapeHtml(e.username);
			color = L.LOUtil.rgbToHex(this.map.getViewColor(e.viewId));
			you = false;
		}

		this.users.set(e.viewId, {
			you: you,
			username: username,
			extraInfo: e.extraInfo,
			color: color,
			readonly: e.readonly,
			following: false,
		});

		if (!you) {
			this.showJoinLeaveMessage('join', username, color);
		}

		this.renderAll();
	}

	onRemoveView(e: UserEvent) {
		const user = this.users.get(e.viewId);
		this.users.delete(e.viewId);

		if (e.viewId === this.map._docLayer._followThis) {
			this.unfollowAll();
		}

		if (user !== undefined) {
			this.showJoinLeaveMessage('leave', user.username, user.color);
		}

		this.renderAll();
	}

	renderAll() {
		this.updateUserListCount();
		this.renderHeaderAvatars();
		this.renderHeaderAvatarPopover();
		this.renderUserList();
		this.renderFollowingChip();
	}

	showJoinLeaveMessage(
		type: 'join' | 'leave',
		username: string,
		_color: string /* TODO: make this display in user colors */,
	) {
		let message;

		if (type === 'join') {
			message = this.options.userJoinedPopupMessage.replace('%user', username);
		} else {
			message = this.options.userLeftPopupMessage.replace('%user', username);
		}

		$('#tb_actionbar_item_userlist').w2overlay({
			class: 'cool-font',
			html: message,
			style: 'padding: 5px',
		});

		clearTimeout(this.options.userPopupTimeout);
		this.options.userPopupTimeout = setTimeout(
			() => $('#tb_actionbar_item_userlist').w2overlay(''),
			3000,
		);
	}

	renderUserList() {
		const headerUserList = Array.from(this.getSortedUsers());

		const userItems = headerUserList.map(([viewId, user]) => {
			let username = user.username;

			if (user.readonly) {
				username += ' (' + _('Readonly') + ')';
			}

			return this.getUserItem(viewId, username, user.extraInfo, user.color);
		});

		const userlistItem = w2ui['actionbar'].get('userlist');
		const userlistElement = $(userlistItem.html).find('#userlist_table tbody');
		userlistElement.children().replaceWith(userItems);
		const newHtml = userlistElement.parent().parent()[0].outerHTML;
		userlistItem.html = newHtml;
	}

	renderHeaderAvatarPopover() {
		// Popover rendering
		const users = Array.from(this.getSortedUsers());
		const popoverElement = document.getElementById('userListPopover');

		const userElements = users.map(([viewId, user], index) => {
			const userLabel = L.DomUtil.create('div', 'user-list-item--name');
			userLabel.innerText = user.username;

			const userFollowingLabel = L.DomUtil.create(
				'div',
				'user-list-item--following-label',
			);
			userFollowingLabel.innerText = _('Following');

			const userLabelContainer = L.DomUtil.create(
				'div',
				'user-list-item--name-container',
			);
			userLabelContainer.appendChild(userLabel);
			userLabelContainer.appendChild(userFollowingLabel);

			const listItem = L.DomUtil.create('div', 'user-list-item');
			listItem.setAttribute('data-view-id', viewId);
			listItem.setAttribute('role', 'button');

			if (user.following) {
				$(listItem).addClass('selected-user');
			}

			listItem.appendChild(
				this.createAvatar(viewId, user.extraInfo, user.color),
			);
			listItem.appendChild(userLabelContainer);
			listItem.addEventListener('click', () => {
				this.followUser(viewId);
			});

			return listItem;
		});

		const followEditorWrapper = L.DomUtil.create('div', '');
		followEditorWrapper.id = 'follow-editor';
		const followEditorCheckbox = L.DomUtil.create(
			'input',
			'follow-editor-checkbox',
			followEditorWrapper,
		);
		followEditorCheckbox.id = 'follow-editor-checkbox';
		followEditorCheckbox.setAttribute('type', 'checkbox');
		followEditorCheckbox.onchange = function (event: Event) {
			(window as any).editorUpdate(event);
			this.renderFollowingChip();
		};
		const followEditorCheckboxLabel = L.DomUtil.create(
			'label',
			'follow-editor-label',
			followEditorWrapper,
		);
		followEditorCheckboxLabel.innerText = _('Always follow the editor');
		followEditorCheckboxLabel.setAttribute('for', 'follow-editor-checkbox');

		popoverElement.replaceChildren(...userElements, followEditorWrapper);

		(
			document.getElementById('follow-editor-checkbox') as HTMLInputElement
		).checked = this.map._docLayer._followEditor;
	}

	renderFollowingChip() {
		const followingChipBackground = document.getElementById(
			'followingChipBackground',
		);
		const followingChip = document.getElementById('followingChip');

		const following = this.getFollowedUser();

		if (following === undefined || !this.map._docLayer._followUser) {
			followingChipBackground.style.display = 'none';
			return;
		}

		let displayedAvatarCount: number;

		if (this.getFollowedUser() === undefined) {
			displayedAvatarCount = this.options.userLimitHeader;
		} else {
			displayedAvatarCount = this.options.userLimitHeaderWhenFollowing;
		}

		const topAvatarZIndex = displayedAvatarCount;

		followingChip.innerHTML =
			'<div id="text">' +
			this.options.followingChipText.replace('%user', following[1].username);
		followingChip.style.borderColor = following[1].color;

		followingChip.onclick = () => {
			this.unfollowAll();
		};

		followingChipBackground.style.display = 'block';
		followingChipBackground.style.zIndex = topAvatarZIndex.toString();
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
