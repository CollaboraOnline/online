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
	cachedHeaderAvatar?: HTMLImageElement;
	cachedUserListAvatar?: HTMLImageElement;
}

interface UserEvent {
	viewId: number;
	username: string;
	extraInfo: UserExtraInfo;
	readonly: boolean;
}

class UserList extends L.Control {
	options: {
		userLimitHeader: number;
		userLimitHeaderWhenFollowing: number;
		userPopupTimeout: null | ReturnType<typeof setTimeout>;
		userJoinedPopupMessage: string;
		userLeftPopupMessage: string;
		followingChipTextUser: string;
		followingChipTextEditor: string;
		followingChipTooltipText: string;
		userAvatarAlt: string;
		nUsers?: string;
		oneUser?: string;
		noUser?: string;
	} = {
		userLimitHeader: 6,
		userLimitHeaderWhenFollowing: 3,
		userPopupTimeout: null,
		userJoinedPopupMessage: _('{user} has joined'),
		userLeftPopupMessage: _('{user} has left'),
		followingChipTextUser: _('Following {user}'),
		followingChipTextEditor: _('Following the editor'),
		followingChipTooltipText: _('Stop following'),
		userAvatarAlt: _('Avatar for {user}'),
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

		if (window.mode.isMobile() || window.mode.isTablet()) {
			this.options.nUsers = '%n';
			this.options.oneUser = '1';
			this.options.noUser = '0';
		} else {
			this.options.nUsers = _('%n users');
			this.options.oneUser = _('1 user');
			this.options.noUser = _('0 users');
		}

		const userListElement = document.getElementById('userListSummary');
		userListElement.setAttribute('aria-label', _('User List Summary'));

		this.registerHeaderAvatarEvents();
	}

	selectUser(viewId: number) {
		const user = this.users.get(viewId);

		if (user === undefined) {
			console.debug("User doesn't exist: " + viewId);
			return;
		}

		this.renderAll();
	}

	getFollowedUser(): undefined | [number, User] {
		const followedId = app.getFollowedViewId();
		const myViewId =
			this.map && this.map._docLayer && this.map._docLayer._viewId;

		if (
			myViewId === followedId ||
			followedId === -1 ||
			!app.isFollowingUser()
		) {
			return undefined;
		}

		const followedUser = this.users.get(followedId);

		if (followedUser === undefined) {
			return undefined;
		}

		return [followedId, followedUser];
	}

	unfollowAll() {
		app.setFollowingOff();
	}

	followUser(viewId: number, instantJump: boolean = true) {
		const myViewId = this.map._docLayer._viewId;
		const followingViewId = app.getFollowedViewId();
		const followMyself = viewId === followingViewId;

		app.setFollowingUser(viewId);

		if (followMyself) {
			this.map._setFollowing(true, myViewId, instantJump);
			this.renderAll();
			return;
		} else if (viewId !== -1) {
			this.map._setFollowing(true, viewId, instantJump);
		} else {
			this.unfollowAll();
			this.map._setFollowing(false, -1);
		}

		this.selectUser(viewId);
	}

	createAvatar(
		cachedElement: HTMLImageElement | undefined,
		viewId: number,
		username: string,
		extraInfo: UserExtraInfo,
		color: string,
		zIndex?: number | 'auto',
	) {
		if (zIndex === undefined) {
			zIndex = 'auto';
		}

		let img = cachedElement;

		if (img === undefined) {
			img = L.DomUtil.create('img', 'avatar-img') as HTMLImageElement;
		}

		L.LOUtil.setUserImage(img, this.map, viewId);

		img.alt = this.options.userAvatarAlt.replace('{user}', username);

		img.style.zIndex = zIndex.toString();
		img.style.borderColor = color;
		img.style.backgroundColor = 'var(--color-background-lighter)';

		img.setAttribute('data-view-id', viewId.toString());

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

		const avatarElement = this.createAvatar(
			undefined,
			viewId,
			username,
			extraInfo,
			color,
		);
		iconTd.appendChild(avatarElement);
		nameTd.textContent = username;

		return content;
	}

	openDropdown() {
		const userListSummary = document.getElementById(
			'userListSummaryBackground',
		);
		const userListPopover = document.getElementById('userlist-dropdown');
		// checking case ''(empty string) is because when element loads first time it does not have any inline display style
		const canShowDropdown =
			!userListPopover &&
			userListSummary &&
			userListSummary.style.display !== 'none';
		if (canShowDropdown) {
			JSDialog.OpenDropdown(
				'userlist',
				document.getElementById('userListSummary'),
				JSDialog.MenuDefinitions.get('UsersListMenu'),
			);
		}
	}

	registerHeaderAvatarEvents() {
		document.getElementById('userListSummary').addEventListener(
			'click',
			function (e: MouseEvent) {
				e.stopPropagation();
				this.openDropdown();
			}.bind(this),
		);
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

		if (this.getFollowedUser() === undefined && !app.isFollowingEditor()) {
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
					user.cachedHeaderAvatar,
					viewId,
					user.username,
					user.extraInfo,
					user.color,
					displayCount - index,
				);
				user.cachedHeaderAvatar = img;

				if (followed !== undefined && followed[0] === viewId) {
					img.classList.add('following');
				} else {
					img.classList.remove('following');
				}

				return img;
			}),
		);

		userListElementBackground.style.display = 'block';
	}

	updateUserListCount() {
		const count = this.users.size;
		let text = '';
		if (count > 1) {
			text = this.options.nUsers.replace('%n', count.toString());
		} else if (count === 1) {
			text = this.options.oneUser;
		} else {
			text = this.options.noUser;
		}

		if (this.map.mobileTopBar) {
			if (!this.hideUserList() && count > 1)
				this.map.mobileTopBar.showItem('userlist', true);
			else this.map.mobileTopBar.showItem('userlist', false);
		}
	}

	deselectUser(e: UserEvent) {
		const user = this.users.get(e.viewId);

		if (user === undefined) {
			console.debug("User doesn't exist: " + e.viewId);
			return;
		}

		this.renderAll();
	}

	onAddView(e: UserEvent) {
		let color;
		let username;
		let you;

		if (e.viewId === this.map._docLayer._viewId) {
			username = _('You');
			color = 'var(--color-main-text)';
			you = true;
		} else {
			username = e.username;
			color = L.LOUtil.rgbToHex(this.map.getViewColor(e.viewId));
			you = false;
		}

		this.users.set(e.viewId, {
			you: you,
			username: username,
			extraInfo: e.extraInfo,
			color: color,
			readonly: e.readonly,
		});

		this.showJoinLeaveMessage('join', e.viewId, username, color);

		this.renderAll();
	}

	onRemoveView(e: UserEvent) {
		const user = this.users.get(e.viewId);
		this.users.delete(e.viewId);

		if (e.viewId === app.getFollowedViewId()) {
			this.unfollowAll();
		}

		if (user !== undefined) {
			this.showJoinLeaveMessage('leave', e.viewId, user.username, user.color);
		}

		this.renderAll();
	}

	renderAll() {
		this.updateUserListCount();
		this.renderHeaderAvatars();
		const popoverElement = document.getElementById('userlist-entries');
		if (popoverElement) this.renderHeaderAvatarPopover(popoverElement);
		this.renderFollowingChip();
	}

	showTooltip(text: string) {
		const userList = $('#userListHeader');
		if (userList) {
			userList.get(0).title = text;
			userList.tooltip({
				content: text,
			});
			userList.tooltip('enable');
			userList.tooltip('open');
		}
	}

	hideTooltip() {
		const userList = $('#userListHeader');
		if (userList) {
			userList.get(0).title = undefined;
			userList.tooltip('option', 'disabled', true);
		}
	}

	showJoinLeaveMessage(
		type: 'join' | 'leave',
		viewId: number,
		username: string, // As the user no longer exists when we are showing a leave message, we can't get this from the viewId
		_color: string /* TODO: make this display in user colors */,
	) {
		let message;

		if (viewId === this.map._docLayer._viewId) {
			return;
		}

		if (type === 'join') {
			message = this.options.userJoinedPopupMessage.replace('{user}', username);
		} else {
			message = this.options.userLeftPopupMessage.replace('{user}', username);
		}

		const sanitizer = document.createElement('div');
		sanitizer.innerText = message;

		this.showTooltip(sanitizer.innerHTML);

		clearTimeout(this.options.userPopupTimeout);
		this.options.userPopupTimeout = setTimeout(() => {
			this.hideTooltip();
		}, 3000);
	}

	renderHeaderAvatarPopover(popoverElement: Element) {
		// Popover rendering
		const users = Array.from(this.getSortedUsers());

		const following = this.getFollowedUser();

		const userElements = users.map(([viewId, user]) => {
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

			if (following !== undefined && viewId == following[0]) {
				$(listItem).addClass('selected-user');
			}

			const avatar = this.createAvatar(
				user.cachedUserListAvatar,
				viewId,
				user.username,
				user.extraInfo,
				user.color,
			);
			user.cachedUserListAvatar = avatar;

			listItem.appendChild(avatar);
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
			'follow-editor-checkbox jsdialog ui-checkbox',
			followEditorWrapper,
		);
		followEditorCheckbox.id = 'follow-editor-checkbox';
		followEditorCheckbox.setAttribute('type', 'checkbox');
		followEditorCheckbox.onchange = (event: Event) => {
			(window as any).editorUpdate(event);
			this.renderAll();
		};
		(followEditorCheckbox as HTMLInputElement).checked =
			app.isFollowingEditor();

		const followEditorCheckboxLabel = L.DomUtil.create(
			'label',
			'follow-editor-label',
			followEditorWrapper,
		);
		followEditorCheckboxLabel.innerText = _('Always follow the editor');
		followEditorCheckboxLabel.setAttribute('for', 'follow-editor-checkbox');

		popoverElement.replaceChildren(...userElements, followEditorWrapper);
	}

	renderFollowingChip() {
		const followingChipBackground = document.getElementById(
			'followingChipBackground',
		);
		const followingChip = document.getElementById('followingChip');

		const following = this.getFollowedUser();

		if (following === undefined && !app.isFollowingEditor()) {
			followingChipBackground.style.display = 'none';
			return;
		}

		const topAvatarZIndex = this.options.userLimitHeaderWhenFollowing;

		if (app.isFollowingEditor()) {
			followingChip.innerText = this.options.followingChipTextEditor;
			followingChip.style.borderColor = 'var(--color-main-text)';
		} else {
			followingChip.innerText = this.options.followingChipTextUser.replace(
				'{user}',
				following[1].username,
			);
			followingChip.style.borderColor = following[1].color;
		}

		followingChip.onclick = () => {
			this.unfollowAll();
			this.renderAll();
		};

		followingChip.title = this.options.followingChipTooltipText;
		$(followingChip).tooltip();

		followingChipBackground.style.display = 'block';
		followingChipBackground.style.zIndex = topAvatarZIndex.toString();
	}
}

L.control.userList = function () {
	return new UserList();
};

L.control.createUserListWidget = function () {
	// TODO: this is not interactive
	const userlistElement = L.DomUtil.create('div');
	app.map.userList.renderHeaderAvatarPopover(userlistElement);
	return userlistElement;
};
