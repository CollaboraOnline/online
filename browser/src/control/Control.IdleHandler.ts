/*
	* Class for idle handling of the view.
*/

/* global app L */

declare var mode: any;
declare var ThisIsTheAndroidApp: any;
declare var postMobileMessage: any;
declare var idleTimeoutSecs: number;
declare var outOfFocusTimeoutSecs: number;

/**/

class IdleHandler {
    _serverRecycling: boolean = false;
    _documentIdle: boolean = false;
	_lastActivity: number = Date.now();
	_inactivityTimer: ReturnType<typeof setTimeout> = null;
	_outOfFocusTimer: ReturnType<typeof setTimeout> = null;
    _active: boolean = true;
    map: any;
	dimId: string = 'inactive_user_message';

	getIdleMessage(): string {
		if (this.map['wopi'] && this.map['wopi'].DisableInactiveMessages) {
			return '';
		} else if (window.mode.isDesktop()) {
			return _('Idle document - please click to reload and resume editing');
		} else {
			return _('Idle document - please tap to reload and resume editing');
		}
	}

	isDimActive(): boolean {
		return !!document.getElementById(this.map.uiManager.generateModalId(this.dimId));
	}

	// time from the last activity in [s]
	getElapsedFromActivity(): number {
		return (Date.now() - this._lastActivity) / 1000;
	}

	_activate() {
		window.app.console.debug('IdleHandler: _activate()');

		if (this._serverRecycling || this._documentIdle) {
			return false;
		}

		this._startInactiveTimer();
		this._stopOutOfFocusTimer();

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

		if (window.mode.isDesktop() && !this.map.uiManager.isAnyDialogOpen()) {
			this.map.focus();
		}

		return false;
	}

	_startInactiveTimer() {
		if (this._serverRecycling || this._documentIdle || !this.map._docLoaded) {
			return;
		}

		clearTimeout(this._inactivityTimer);

		this._inactivityTimer = setTimeout(() => {
			this._dimIfInactive();
		}, 1 * 60 * 1000); // Check once a minute
	}

	_startOutOfFocusTimer() {
		if (this._serverRecycling || this._documentIdle || !this.map._docLoaded) {
			return;
		}

		this._stopOutOfFocusTimer();

		this._outOfFocusTimer = setTimeout(() => {
			this._dim();
		}, window.outOfFocusTimeoutSecs * 1000);
	}

	_stopOutOfFocusTimer() {
		clearTimeout(this._outOfFocusTimer);
	}

	_dimIfInactive() {
		if (this.map._docLoaded && (this.getElapsedFromActivity() >= window.idleTimeoutSecs)) {
			this._dim();
		} else {
			this._startInactiveTimer();
		}
	}

	_dim() {
		const message = this.getIdleMessage();

		window.app.console.debug('IdleHandler: _dim()');

		this._active = false;
		var map = this.map;

		var restartConnectionFn = function() {
			if (app.idleHandler._documentIdle)
			{
				window.app.console.debug('idleness: reactivating');
				map.fire('postMessage', {msgId: 'User_Active'});
				app.idleHandler._documentIdle = false;
				app.idleHandler.map._docLayer._setCursorVisible();
			}
			return app.idleHandler._activate();
		};

		this.map._textInput.hideCursor();

		this.map.uiManager.showInfoModal(this.dimId);
		document.getElementById(this.dimId).textContent = message;

		if (message === '') {
			document.getElementById(this.map.uiManager.generateModalId(this.dimId)).style.display = 'none';
			L.LOUtil.onRemoveHTMLElement(document.getElementById(this.dimId), function() { restartConnectionFn(); }.bind(this));
		}
		else {
			var overlayId = this.map.uiManager.generateModalId(this.dimId) + '-overlay';
			L.LOUtil.onRemoveHTMLElement(document.getElementById(overlayId), function() { restartConnectionFn(); }.bind(this));
		}

		this.map._doclayer && this.map._docLayer._onMessage('textselection:', null);
		this.map.fire('postMessage', {msgId: 'User_Idle'});
	}

	notifyActive() {
		this._lastActivity = Date.now();

		if (window.ThisIsTheAndroidApp) {
			window.postMobileMessage('LIGHT_SCREEN');
		}
	}

	_deactivate() {
		window.app.console.debug('IdleHandler: _deactivate()');

		if (this._serverRecycling || this._documentIdle || !this.map._docLoaded) {
			return;
		}

		if (window.mode.isDesktop() && (!this._active || this.isDimActive())) {
			// A dialog is already dimming the screen and probably
			// shows an error message. Leave it alone.
			this._active = false;
			this.map._docLayer && this.map._docLayer._onMessage('textselection:', null);
			if (app.socket.connected()) {
				app.socket.sendMessage('userinactive');
			}

			return;
		}

		this._startOutOfFocusTimer();
	}
}

// Initiate the class.
app.idleHandler = new IdleHandler();
