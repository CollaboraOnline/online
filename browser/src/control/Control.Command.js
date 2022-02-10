/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Feature blocking handler
 */

/* global $ vex _ */
L.Map.include({

	Locking: {
		isLockedUser: false,
		isLockReadOnly: false,
		lockedCommandList: [],
		unlockTitle: '',
		unlockLink: '',
		unlockDescription: '',
		writerHighlights: '',
		calcHighlights: '',
		impressHighlights: '',
		drawHighlights: '',
	},

	_setLockProps: function(lockInfo) {
		this.Locking.isLockedUser = !!lockInfo['IsLockedUser'];
		this.Locking.isLockReadOnly = !!lockInfo['IsLockReadOnly'];
		this.Locking.lockedCommandList = lockInfo['LockedCommandList'];
		this.Locking.unlockTitle = _(lockInfo['UnlockTitle']);
		this.Locking.unlockLink = _(lockInfo['UnlockLink']);
		this.Locking.unlockDescription = _(lockInfo['UnlockDescription']);
		this.Locking.writerHighlights = _(lockInfo['WriterHighlights']);
		this.Locking.calcHighlights = _(lockInfo['CalcHighlights']);
		this.Locking.impressHighlights = _(lockInfo['ImpressHighlights']);
		this.Locking.drawHighlights = _(lockInfo['DrawHighlights']);

	},

	// We mark the element disabled for the feature locking
	// and add overlay on the element
	disableLockedItem: function(item, DOMParentElement, buttonToDisable) {
		if (this.isLockedUser() && this.isLockedItem(item)) {
			$(DOMParentElement).data('locked', true);
			$(DOMParentElement).addClass('locking-disabled');
			$(buttonToDisable).off('click');

			var that = this;

			if (window.mode.isMobile()) {
				var overlay = L.DomUtil.create('div', 'locking-overlay', DOMParentElement);
				var lock = L.DomUtil.create('img', 'locking-overlay-lock', overlay);
				lock.src = L.LOUtil.getImageURL('lc_lock.svg');
			}

			$(DOMParentElement).click(function(event) {
				event.stopPropagation();
				that.openUnlockPopup('');
			});
		}
	},

	openUnlockPopup: function(cmd) {
		if (this.isRestrictedUser() && this.isRestrictedItem(cmd))
			return;
		var lockingOnMobile = '';

		if (window.mode.isMobile()) {
			lockingOnMobile = 'mobile';
		}
		var that = this;
		vex.dialog.confirm({
			unsafeMessage: [
				'<div class="container">',
				'<div class="item illustration"></div>',
				'<div class="item">',
				'<h1>' + this.Locking.unlockTitle + '</h1>',
				'<p>' + this.Locking.unlockDescription + '<p>',
				'<ul>',
				'<li>' + this.Locking.writerHighlights + '</li>',
				'<li>' + this.Locking.calcHighlights + '</li>',
				'<li>' + this.Locking.impressHighlights + '</li>',
				'<li>' + this.Locking.drawHighlights + '</li>',
				'</ul>',
				'</div>',
				'<div>'
			].join(''),
			showCloseButton: false,
			contentClassName: 'vex-content vex-locking ' + lockingOnMobile,
			callback: function (value) {
				if (value)
					window.open(that.Locking.unlockLink, '_blank');
			},
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('Unlock') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			]
		});
	},

	isLockedItem: function(item) {
		var commands = this._extractCommand(item);

		for (var i in commands) {
			if (this.Locking.lockedCommandList.indexOf(commands[i]) >= 0)
				return true;
		}
		return false;
	},

	isLockedUser: function() {
		return this.Locking.isLockedUser;
	},

	Restriction: {
		isRestrictedUser: false,
		restrictedCommandList: [],
	},

	_setRestrictions: function(restrictionInfo) {
		this.Restriction.isRestrictedUser = !!restrictionInfo['IsRestrictedUser'];
		this.Restriction.restrictedCommandList = restrictionInfo['RestrictedCommandList'];
	},

	isRestrictedUser: function() {
		return this.Restriction.isRestrictedUser;
	},

	hideRestrictedItems: function(item, DOMParentElement, buttonToDisable) {
		if (this.isRestrictedUser() && this.isRestrictedItem(item)) {
			$(buttonToDisable).addClass('restricted-item');
			window.app.console.log();
		}

	},

	isRestrictedItem: function(item) {
		var commands = this._extractCommand(item);

		for (var i in commands) {
			if (this.Restriction.restrictedCommandList.indexOf(commands[i]) >= 0)
				return true;
		}
		return false;
	},

	isLockReadOnly: function() {
		return this.Locking.isLockReadOnly;
	},

	isLockedReadOnlyUser: function() {
		return this.Locking.isLockedUser && this.Locking.isLockReadOnly;
	},

	_extractCommand: function(item) {
		if (item.command) // in notebookbar uno commands are stored as command
			return [item.command];
		else if (item.uno) { // in classic mode uno commands are stored as uno in menus
			if (typeof item.uno === 'string')
				return [item.uno];
			return [item.uno.textCommand , item.uno.objectCommand]; // some unos have multiple commands
		}
		else if (item.id)
			return [item.id];
		else if (item.unosheet)
			return [item.unosheet];
		else if (typeof item === 'string')
			return [item];
		return '';
	}
});
