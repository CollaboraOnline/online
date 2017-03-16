/*
	Abstract class
*/

/* global Util vex Base */
/* eslint no-unused-vars:0 */
var AdminSocketBase = Base.extend({
	socket: null,

	constructor: function(host) {
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
	},

	onSocketOpen: function() {
		// Authenticate
		cookie = Util.getCookie('jwt');
		this.socket.send('auth ' + cookie);
	},

	onSocketMessage: function() {
		/* Implemented by child */
	},

	onSocketClose: function() {
		this.socket.onerror = function() {};
		this.socket.onclose = function() {};
		this.socket.onmessage = function() {};
		this.socket.close();
	},

	onSocketError: function() {
		vex.dialog.alert(_('Connection error'));
	}
});
