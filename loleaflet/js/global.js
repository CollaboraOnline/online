/* -*- js-indent-level: 8 -*- */
(function (global) {

	global.fakeWebSocketCounter = 0;
	global.FakeWebSocket = function () {
		this.binaryType = 'arraybuffer';
		this.bufferedAmount = 0;
		this.extensions = '';
		this.protocol = '';
		this.readyState = 1;
		this.id = window.fakeWebSocketCounter++;
		this.sendCounter = 0;
		this.onclose = function() {
		};
		this.onerror = function() {
		};
		this.onmessage = function() {
		};
		this.onopen = function() {
		};
	}

	global.FakeWebSocket.prototype.close = function() {
	}

	global.FakeWebSocket.prototype.send = function(data) {
		this.sendCounter++;
		window.postMobileMessage(data);
	}

	// If not debug, don't print anything on the console
	// except in tile debug mode (Ctrl-Shift-Alt-d)
	console.log2 = console.log;
	if (global.loleafletLogging !== 'true') {
		var methods = ['warn', 'info', 'debug', 'trace', 'log', 'assert', 'time', 'timeEnd'];
		for (var i = 0; i < methods.length; i++) {
			console[methods[i]] = function() {};
		}
	}

	// fix jquery-ui
	// var jQuery = require('jquery');
	global.require = function (path) {
		if (path=='jquery') {
			return global.jQuery;
		}
	};

	global.getParameterByName = function (name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : results[1].replace(/\+/g, ' ');
	};

	global._ = function (string) {
		// In the mobile app case we can't use the stuff from l10n-for-node, as that assumes HTTP.
		if (window.ThisIsTheiOSApp) {
			// We use another approach just for iOS for now.
			if (window.LOCALIZATIONS.hasOwnProperty(string)) {
				// window.postMobileDebug('_(' + string + '): YES: ' + window.LOCALIZATIONS[string]);
				var result = window.LOCALIZATIONS[string];
				if (window.LANG === 'de-CH') {
					result = result.replace(/ß/g, 'ss');
				}
				return result;
			} else {
				// window.postMobileDebug('_(' + string + '): NO');
				return string;
			}
		} else if (window.ThisIsAMobileApp) {
			// And bail out without translations on other mobile platforms.
			return string;
		} else {
			return string.toLocaleString();
		}
	};

	var docParams, wopiParams;
	var filePath = global.getParameterByName('file_path');
	var wopiSrc = global.getParameterByName('WOPISrc');
	if (wopiSrc != '') {
		global.docURL = decodeURIComponent(wopiSrc);
		wopiSrc = '?WOPISrc=' + wopiSrc + '&compat=/ws';
		if (global.accessToken !== '') {
			wopiParams = { 'access_token': global.accessToken, 'access_token_ttl': global.accessTokenTTL };
		}
		else if (global.accessHeader !== '') {
			wopiParams = { 'access_header': global.accessHeader };
		}
		docParams = Object.keys(wopiParams).map(function(key) {
			return encodeURIComponent(key) + '=' + encodeURIComponent(wopiParams[key])
		}).join('&');
	} else {
		global.docURL = filePath;
	}

	if (window.ThisIsAMobileApp) {
		global.socket = new global.FakeWebSocket();
		window.TheFakeWebSocket = global.socket;
	} else {
		var websocketURI = global.host + global.serviceRoot + '/lool/' + encodeURIComponent(global.docURL + (docParams ? '?' + docParams : '')) + '/ws' + wopiSrc;

		try {
			global.socket = new WebSocket(websocketURI);
		} catch (err) {
			console.log(err);
		}
	}

	global.queueMsg = [];
	if (global.socket && global.socket.readyState !== 3) {
		global.socket.onopen = function () {
			if (global.socket.readyState === 1) {
				var ProtocolVersionNumber = '0.1';
				global.socket.send('loolclient ' + ProtocolVersionNumber);
				global.socket.send('load url=' + encodeURIComponent(global.docURL));
			}
		}

		global.socket.onerror = function (event) {
			console.log(event);
		}

		global.socket.onclose = function (event) {
			console.log(event);
		}

		global.socket.onmessage = function (event) {
			if (typeof global.socket._onMessage === 'function') {
				global.socket._onMessage(event);
			} else {
				global.queueMsg.push(event.data);
			}
		}

		global.socket.binaryType = 'arraybuffer';

		if (window.ThisIsAMobileApp) {
			// This corresponds to the initial GET request when creating a WebSocket
			// connection and tells the app's code that it is OK to start invoking
			// TheFakeWebSocket's onmessage handler. The app code that handles this
			// special message knows the document to be edited anyway, and can send it
			// on as necessary to the Online code.
			window.postMobileMessage('HULLO');
			// A FakeWebSocket is immediately open.
			this.socket.onopen();
		}
	}
}(window));
