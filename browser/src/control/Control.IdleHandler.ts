/*
	* Class for idle handling of the view.
*/

/* global app L */

declare var isAnyVexDialogActive: any;
declare var mode: any;
declare var ThisIsTheAndroidApp: any;
declare var postMobileMessage: any;

/**/

class IdleHandler {
    _serverRecycling: boolean = false;
    _documentIdle: boolean = false;
    _active: boolean = true;
    map: any;
	dimId: 'inactive_user_message';

	isDimActive(): boolean {
		return !!document.getElementById(this.dimId);
	}

	_activate() {
		if (this._serverRecycling || this._documentIdle) {
			return false;
		}

		if (!this._active) {
			// Only activate when we are connected.
			if (app.socket.connected()) {
				app.socket.sendMessage('useractive');
				this._active = true;
				var docLayer = this.map._docLayer;
				if (docLayer && docLayer.isCalc() && docLayer.options.sheetGeometryDataEnabled) {
					docLayer.requestSheetGeometryData();
				}
				app.socket.sendMessage('commandvalues command=.uno:ViewAnnotations');

				if (this.isDimActive()) {
					this.map.jsdialog.closeDialog(this.dimId, false);
					return true;
				}
			} else {
				this.map.loadDocument();
			}
		}

		if (window.mode.isDesktop() && !isAnyVexDialogActive()) {
			this.map.focus();
		}

		return false;
	}

	_dim(message: string) {
		this._active = false;

		var restartConnectionFn = function() {
			if (app.idleHandler._documentIdle)
			{
				window.app.console.debug('idleness: reactivating');
				app.idleHandler._documentIdle = false;
				app.idleHandler.map._docLayer._setCursorVisible();
				return app.idleHandler._activate();
			}
			return false;
		};

		this.map._textInput.hideCursor();

		this.map.uiManager.showInfoModal('inactive_user_message');
		document.getElementById('inactive_user_message').textContent = message;
		document.getElementById('inactive_user_message').tabIndex = 0;
		document.getElementById('inactive_user_message').focus(); // We hid the OK button, we need to set focus manually on the popup.

		if (message === '') {
			document.getElementById(this.map.uiManager.generateModalId('inactive_user_message')).style.display = 'none';
			L.LOUtil.onRemoveHTMLElement(document.getElementById('inactive_user_message'), function() { restartConnectionFn(); }.bind(this));
		}
		else {
			var overlayId = this.map.uiManager.generateModalId('inactive_user_message') + '-overlay';
			L.LOUtil.onRemoveHTMLElement(document.getElementById(overlayId), function() { restartConnectionFn(); }.bind(this));
		}

		this.map._doclayer && this.map._docLayer._onMessage('textselection:', null);
		this.map.fire('postMessage', {msgId: 'User_Idle'});
	}

	notifyActive() {
		if (window.ThisIsTheAndroidApp) {
			window.postMobileMessage('LIGHT_SCREEN');
		}
	}

	_deactivate() {
		if (this._serverRecycling || this._documentIdle || !this.map._docLoaded) {
			return;
		}

		if (!this._active || isAnyVexDialogActive() || (this.map.jsdialog && this.map.jsdialog.hasDialogOpened())) {
			// A dialog is already dimming the screen and probably
			// shows an error message. Leave it alone.
			this._active = false;
			this.map._docLayer && this.map._docLayer._onMessage('textselection:', null);
			if (app.socket.connected()) {
				app.socket.sendMessage('userinactive');
			}

			return;
		}
	}
}

// Initiate the class.
app.idleHandler = new IdleHandler();
