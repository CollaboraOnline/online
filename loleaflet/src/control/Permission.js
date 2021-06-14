/* -*- js-indent-level: 8 -*- */
/*
 * Document permission handler
 */
/* global app $ _ vex */
L.Map.include({
	setPermission: function (perm) {
		var button = $('#mobile-edit-button');
		button.off('click');
		button.hide();
		var that = this;
		if (perm === 'edit') {
			if (this._isFilePlainText() || window.mode.isMobile() || window.mode.isTablet()) {
				button.show();
				button.on('click', function () {
					that._switchToEditMode();
				});

				// temporarily, before the user touches the floating action button
				this._enterReadOnlyMode('readonly');
			}
			else if (this.options.canTryLock) {
				// This is a success response to an attempt to lock using mobile-edit-button
				this._switchToEditMode();
			}
			else {
				this._enterEditMode(perm);
			}
		}
		else if (perm === 'view' || perm === 'readonly') {
			if (window.ThisIsTheAndroidApp) {
				button.on('click', function () {
					that._requestFileCopy();
				});
			} else if (!this.options.canTryLock && (window.mode.isMobile() || window.mode.isTablet())) {
				$('#mobile-edit-button').hide();
			}

			this._enterReadOnlyMode(perm);
		}
	},

	onLockFailed: function(reason) {
		if (this.options.canTryLock === undefined) {
			// This is the initial notification. This status is not permanent.
			// Allow to try to lock the file for edit again.
			this.options.canTryLock = true;

			var alertMsg = _('The document could not be locked, and is opened in read-only mode.');
			if (reason) {
				alertMsg += '\n' + _('Server returned this reason:') + '\n"' + reason + '"';
			}
			vex.dialog.alert({ message: alertMsg });

			var button = $('#mobile-edit-button');
			// TODO: modify the icon here
			button.show();
			button.off('click');

			button.on('click', function () {
				app.socket.sendMessage('attemptlock');
			});
		}
		else if (this.options.canTryLock) {
			// This is a failed response to an attempt to lock using mobile-edit-button
			alertMsg = _('The document could not be locked.');
			if (reason) {
				alertMsg += '\n' + _('Server returned this reason:') + '\n"' + reason + '"';
			}
			vex.dialog.alert({ message: alertMsg });
		}
		// do nothing if this.options.canTryLock is defined and is false
	},

	_getFileExtension: function (filename) {
		return filename.substring(filename.lastIndexOf('.'));
	},

	_isFilePlainText: function () {
		var fileName = this['wopi'].BaseFileName;
		// use this feature for only integration.
		if (!fileName) return false;
		var extension = this._getFileExtension(fileName);
		return extension === '.csv' || extension === '.txt';
	},

	_proceedEditMode: function() {
		this.options.canTryLock = false; // don't respond to lockfailed anymore
		$('#mobile-edit-button').hide();
		this._enterEditMode('edit');
		if (window.mode.isMobile() || window.mode.isTablet()) {
			this.fire('editorgotfocus');
			this.fire('closemobilewizard');
			// In the iOS/android app, just clicking the mobile-edit-button is
			// not reason enough to pop up the on-screen keyboard.
			if (!(window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp))
				this.focus();
		}
	},

	_offerSaveAs: function() {
		var that = this;
		var fileName = this['wopi'].BaseFileName;
		if (!fileName) return false;
		var extension = this._getFileExtension(fileName);
		var saveAsFormat = extension === '.csv' ? 'ods' : 'odt';
		vex.dialog.prompt({
			message: _('Enter a file name'),
			placeholder: _('filename'),
			callback: function (value) {
				if (!value) return;
				that.saveAs(value + '.' + saveAsFormat, saveAsFormat);
			}
		});
	},

	// from read-only to edit mode
	_switchToEditMode: function () {
		// This will be handled by the native mobile app instead
		if (this._isFilePlainText() && !window.ThisIsAMobileApp) {
			var that = this;
			vex.dialog.open({
				message: _('This document may contain formatting or content that cannot be saved in the current file format.'),
				overlayClosesOnClick: false,
				callback: L.bind(function (value) {
					if (value) {
						// offer save-as instead
						this._offerSaveAs();
					} else {
						this._proceedEditMode();
					}
				}, that),
				buttons: [
					$.extend({}, vex.dialog.buttons.YES, { text: _('Save as ODF format') }),
					$.extend({}, vex.dialog.buttons.NO, { text: _('Continue editing')})
				]
			});
		} else {
			this._proceedEditMode();
		}
	},

	_requestFileCopy: function() {
		if (window.docPermission === 'readonly') {
			window.postMobileMessage('REQUESTFILECOPY');
		} else {
			this._switchToEditMode();
		}
	},

	_enterEditMode: function (perm) {
		this._permission = perm;

		app.socket.sendMessage('requestloksession');
		if (!L.Browser.touch) {
			this.dragging.disable();
		}

		this.fire('updatepermission', {perm : perm});

		if (this._docLayer._docType === 'text') {
			this.setZoom(10);
		}

		if (window.ThisIsTheiOSApp && window.mode.isTablet() && this._docLayer._docType === 'spreadsheet')
			this.showCalcInputBar(0);

		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('EDITMODE on');
	},

	_enterReadOnlyMode: function (perm) {
		this._permission = perm;

		this.dragging.enable();
		// disable all user interaction, will need to add keyboard too
		if (this._docLayer) {
			this._docLayer._onUpdateCursor();
			this._docLayer._clearSelections();
			this._docLayer._onUpdateTextSelection();
		}
		this.fire('updatepermission', {perm : perm});
		this.fire('closemobilewizard');

		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('EDITMODE off');
	},

	enableSelection: function () {
		if (this.isPermissionEdit()) {
			return;
		}
		app.socket.sendMessage('requestloksession');
		this.dragging.disable();
	},

	disableSelection: function () {
		if (this.isPermissionEdit()) {
			return;
		}
		this.dragging.enable();
	},

	isPermissionEditForComments: function() {
		// Currently we allow user to perform comment operations
		// even in the view/readonly mode(initial mobile mode)
		// allow comment operations if user has edit permission for doc
		return window.docPermission === 'edit';
	},

	isPermissionReadOnly: function() {
		return this._permission === 'readonly';
	},

	isPermissionEdit: function() {
		return this._permission === 'edit';
	}
});
