/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Feature blocking handler
 */

/* global $ _ */

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
		this.Locking.unlockImageUrlPath = lockInfo['UnlockImageUrlPath'];
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
				L.LOUtil.setImage(lock, 'lc_lock.svg', this._docLayer._docType);
			}

			$(DOMParentElement).click(function(event) {
				event.stopPropagation();
				that.openUnlockPopup('');
			});
		}
	},

	openUnlockPopup: function(cmd) {
		if ((this.isRestrictedUser() && this.isRestrictedItem(cmd)) || this.uiManager.isAnyDialogOpen())
			return;
		var message = [
			'<div class="container">',
			'<img id="unlock-image">',
			'<div class="item">',
			'<h1>' + this.Locking.unlockTitle + '</h1>',
			'<p>' + this.Locking.unlockDescription + '<p>',
			'<ul>',
		];
		var highlights = [this.Locking.writerHighlights, this.Locking.calcHighlights, this.Locking.impressHighlights, this.Locking.drawHighlights];
		highlights.forEach(function(highlight) {
			if (highlight)
				message.push('<li>' + highlight + '</li>');
		});
		message.push('</ul>', '</div>', '<div>');

		message = message.join('');

		this.uiManager.showInfoModal('unlock-features-popup', this.Locking.unlockTitle, ' ', ' ', _('Unlock'), function() {
			window.open(this.Locking.unlockLink, '_blank');
			this.uiManager.closeModal(this.uiManager.generateModalId('unlock-features-popup'));
		}.bind(this), true);

		var paraTag = document.getElementById('unlock-features-popup').querySelectorAll('p')[0];
		if (paraTag)
			paraTag.outerHTML = message;
		else {
			var popup = document.getElementById('unlock-features-popup');
			var el = document.createElement('p');
			popup.insertBefore(el, popup.firstChild);
			el.outerHTML = message;
		}

		var unlockImage = L.DomUtil.get('unlock-image');
		L.DomUtil.setStyle(unlockImage, 'width', '100%');
		L.DomUtil.setStyle(unlockImage, 'height', 'auto');
		if (this.Locking.unlockImageUrlPath) {
			unlockImage.src = 'remote/static' + this.Locking.unlockImageUrlPath;
		} else {
			unlockImage.src = 'images/lock-illustration.svg';
		}
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
		if (!item)
			return '';

		var commandArray = [];
		if (item.lockUno || item.uno) { // in classic mode uno commands are stored as uno in menus
			var uno = item.lockUno ? item.lockUno : item.uno;
			if (typeof uno === 'string')
				commandArray.push(uno);
			else { // some unos have multiple commands
				commandArray.push(uno.textCommand);
				commandArray.push(uno.objectCommand);
				if (item.unosheet)
					commandArray.push(item.unosheet);
			}
		}
		else if (item.command) // in notebookbar uno commands are stored as command
			commandArray.push(item.command);
		else if (item.id)
			commandArray.push(item.id);
		else if (typeof item === 'string')
			commandArray.push(item);

		for (var command in commandArray) {
			if (!commandArray[command].startsWith('.uno:'))
				commandArray[command] = '.uno:' + commandArray[command];
		}
		return commandArray;
	}
});
