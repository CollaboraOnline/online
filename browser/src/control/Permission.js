/* -*- js-indent-level: 8 -*- */
/*
 * Document permission handler
 */
/* global app $ _ */
L.Map.include({
	readonlyStartingFormats: {
		'txt': { canEdit: true, odfFormat: 'odt' },
		'csv': { canEdit: true, odfFormat: 'ods' },
		'xlsb': { canEdit: false, odfFormat: 'ods' }
	},

	setPermission: function (perm) {
		var button = $('#mobile-edit-button');
		button.off('click');
		button.attr('tabindex', 0);
		button.attr('role', 'button');
		button.attr('title', _('Edit document'));
		button.attr('aria-label', _('Edit document'));
		// app.file.fileBasedView is new view that has continuous scrolling
		// used for PDF and we dont permit editing for PDFs
		// this._shouldStartReadOnly() is a check for files that should start in readonly mode and even on desktop browser
		// we warn the user about loosing the rich formatting and offer an option to
		// save as ODF instead of the current format
		//
		// For mobile we need to display the edit button for all the cases except for PDF
		// we offer save-as to another place where the user can edit the document
		var isPDF = app.file.fileBasedView && app.file.editComment;
		if (!isPDF && (this._shouldStartReadOnly() || window.mode.isMobile() || window.mode.isTablet())) {
			button.show();
		} else {
			button.hide();
		}
		var that = this;
		if (perm === 'edit') {
			if (this._shouldStartReadOnly() || window.mode.isMobile() || window.mode.isTablet()) {
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
			if (this.isLockedReadOnlyUser()) {
				button.on('click', function () {
					that.openUnlockPopup();
				});
			}
			else if (window.ThisIsTheAndroidApp) {
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
			this.uiManager.showConfirmModal('lock_failed_message', '', alertMsg, _('OK'), function() {
				app.socket.sendMessage('attemptlock');
			}, true);
		}
		else if (this.options.canTryLock) {
			// This is a failed response to an attempt to lock using mobile-edit-button
			alertMsg = _('The document could not be locked.');
			if (reason) {
				alertMsg += '\n' + _('Server returned this reason:') + '\n"' + reason + '"';
			}
			this.uiManager.showConfirmModal('lock_failed_message', '', alertMsg, _('OK'), null, true);
		}
		// do nothing if this.options.canTryLock is defined and is false
	},

	_getFileExtension: function (filename) {
		return filename.substring(filename.lastIndexOf('.') + 1);
	},

	_shouldStartReadOnly: function () {
		if (this.isLockedReadOnlyUser())
			return true;
		var fileName = this['wopi'].BaseFileName;
		// use this feature for only integration.
		if (!fileName) return false;
		var extension = this._getFileExtension(fileName);
		if (!Object.prototype.hasOwnProperty.call(this.readonlyStartingFormats, extension))
			return false;
		return true;
	},

	_proceedEditMode: function() {
		var fileName = this['wopi'].BaseFileName;
		if (fileName) {
			var extension = this._getFileExtension(fileName);
			var extensionInfo = this.readonlyStartingFormats[extension];
			if (extensionInfo && !extensionInfo.canEdit)
				return;
		}
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
		var fileName = this['wopi'].BaseFileName;
		if (!fileName) return false;
		var extension = this._getFileExtension(fileName);
		var extensionInfo = this.readonlyStartingFormats[extension];
		var saveAsFormat = extensionInfo.odfFormat;

		var defaultValue = fileName.substring(0, fileName.lastIndexOf('.')) + '.' + saveAsFormat;
		this.uiManager.showInputModal('save-as-modal', '', _('Enter a file name'), defaultValue, _('OK'), function() {
			var value = document.getElementById('save-as-modal').querySelectorAll('#input-modal-input')[0].value;
			if (!value)
				return;
			else if (value.substring(value.lastIndexOf('.') + 1) !== saveAsFormat) {
				value += '.' + saveAsFormat;
			}
			this.saveAs(value, saveAsFormat);
		}.bind(this));
	},

	// from read-only to edit mode
	_switchToEditMode: function () {
		// This will be handled by the native mobile app instead
		if (this._shouldStartReadOnly() && !window.ThisIsAMobileApp) {
			var fileName = this['wopi'].BaseFileName;
			var extension = this._getFileExtension(fileName);
			var extensionInfo = this.readonlyStartingFormats[extension];

			var yesButtonText = !this['wopi'].UserCanNotWriteRelative ? _('Save as ODF format'): null;
			var noButtonText = extensionInfo.canEdit ? _('Continue editing') : _('Continue read only');

			if (!yesButtonText) {
				yesButtonText = noButtonText;
				noButtonText = null;
			}

			var yesFunction = !noButtonText ? function() { this._proceedEditMode(); }.bind(this) : function() { this._offerSaveAs(); }.bind(this);
			var noFunction = function() { this._proceedEditMode(); }.bind(this);

			this.uiManager.showYesNoButton(
				'switch-to-edit-mode-modal', // id.
				'', // Title.
				_('This document may contain formatting or content that cannot be saved in the current file format.'), // Message.
				yesButtonText,
				noButtonText,
				yesFunction,
				noFunction,
				false // Cancellable.
			);
		} else {
			this._proceedEditMode();
		}
	},

	_requestFileCopy: function() {
		if (!this.canUserWrite()) {
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

		if ((window.mode.isMobile() || window.mode.isTablet()) && this._textInput && this.getDocType() === 'text') {
			this._textInput.setSwitchedToEditMode();
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
		this.fire('closealldialogs');

		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('EDITMODE off');
	},

	enableSelection: function () {
		if (this.isEditMode()) {
			return;
		}
		app.socket.sendMessage('requestloksession');
		this.dragging.disable();
	},

	disableSelection: function () {
		if (this.isEditMode()) {
			return;
		}
		this.dragging.enable();
	},

	// Can user make changes to the document or not
	// i.e: user can not make changes(even can not add comments) is document is shared as read only
	canUserWrite: function() {
		return app.file.permission === 'edit';
	},

	// If user has write access he can always add comments
	isPermissionEditForComments: function() {
		return this.canUserWrite() || app.file.editComment;
	},

	// Is user currently in read only mode (i.e: initial mobile read only view mode, user may have write access)
	isReadOnlyMode: function() {
		return this._permission === 'readonly';
	},

	// Is user currently in editing mode
	isEditMode: function() {
		return this._permission === 'edit';
	}
});
