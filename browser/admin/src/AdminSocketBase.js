/* -*- js-indent-level: 8 -*- */
/*
	Abstract class
*/

/* global _ Util DlgYesNo Base */

var AdminSocketBase = Base.extend({
	socket: null,

	constructor: function (host) {
		// because i am abstract
		if (this.constructor === AdminSocketBase) {
			throw new Error('Cannot instantiate abstract class');
		}

		// We do not allow such child class to instantiate websocket that do not implement
		// onSocketMessage and onSocketOpen.
		if (typeof this.onSocketMessage === 'function' && typeof this.onSocketOpen === 'function') {
			this.socket = new WebSocket(host);
			this.socket.onopen = this.onSocketOpen.bind(this);
			this.socket.onclose = this.onSocketClose.bind(this);
			this.socket.onmessage = this.onSocketMessage.bind(this);
			this.socket.onerror = this.onSocketError.bind(this);
			this.socket.binaryType = 'arraybuffer';
		}

		this.pageWillBeRefreshed = false;
		var onBeforeFunction = function() {
			this.pageWillBeRefreshed = true;
		};
		window.onbeforeunload = onBeforeFunction.bind(this);
	},

	onSocketOpen: function () {
		// Authenticate
		var cookie = Util.getCookie('jwt');
		this.socket.send('auth ' + cookie);
	},

	onSocketMessage: function () {
		/* Implemented by child */
	},

	onSocketClose: function () {
		this.socket.onerror = function () { };
		this.socket.onclose = function () { };
		this.socket.onmessage = function () { };
		this.socket.close();

		if (this.pageWillBeRefreshed === false) {
			var dialog = (new DlgYesNo())
				.title(_('Refresh'))
				.text(_('Server has been shut down; please reload the page.'))
				.yesButtonText(_('OK'))
				.type('warning')
				.yesFunction(function() { window.location.reload(); });
			dialog.open();
		}
	},

	onSocketError: function () {
		var dialog = (new DlgYesNo())
			.title(_('Connection error'))
			.text(_('Connection error'))
			.yesButtonText(_('OK'))
			.type('warning')
			.yesFunction(function() { window.location.reload(); });
		dialog.open();
	}
});
