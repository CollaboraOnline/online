/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* eslint-disable @typescript-eslint/no-empty-function */

class SocketBase {
	private ProtocolVersionNumber: string = '0.1';
	private ReconnectCount: number = 0;
	private WasShownLimitDialog: boolean = false;
	private WSDServer: WSDServerInfo = {
		Id: '',
		Version: '',
		Hash: '',
		Protocol: '',
		Options: '',
		Timezone: '',
	};
	private IndirectSocketReconnectCount: number = 0;

	/// Whether Trace Event recording is enabled or not. ("Enabled" here means whether it can be
	/// turned on (and off again), not whether it is on.)
	private enableTraceEventLogging: boolean = false;

	// Will be set from lokitversion message
	private TunnelledDialogImageCacheSize: number = 0;

	private _map: MapInterface;
	private _msgQueue: MessageInterface[];
	private _delayedMessages: DelayedMessageInterface[];
	private _slurpQueue: SlurpMessageEvent[];
	private _handlingDelayedMessages: boolean;
	private _inLayerTransaction: boolean;
	private _slurpDuringTransaction: boolean;
	private _accessTokenExpireTimeout: TimeoutHdl | undefined;
	private _reconnecting: boolean;
	private _slurpTimer: TimeoutHdl | undefined;
	private _renderEventTimer: TimeoutHdl | undefined;
	private _renderEventTimerStart: DOMHighResTimeStamp | undefined;
	private _slurpTimerDelay: number | undefined;
	private _slurpTimerLaunchTime: number | undefined;
	private timer: ReturnType<typeof setInterval> | undefined;
	private threadLocalLoggingLevelToggle: boolean;

	private socket?: SockInterface;
	public traceEvents: TraceEvents;

	constructor(map: MapInterface) {
		window.app.console.debug('socket.initialize:');
		this._map = map;
		this._slurpQueue = [];
		this._msgQueue = [];
		this._delayedMessages = [];
		this._handlingDelayedMessages = false;
		this._inLayerTransaction = false;
		this._slurpDuringTransaction = false;
		this.threadLocalLoggingLevelToggle = false;
		this._accessTokenExpireTimeout = undefined;
		this._reconnecting = false;
		this._slurpTimer = undefined;
		this._renderEventTimer = undefined;
		this._renderEventTimerStart = undefined;
		this._slurpTimerDelay = undefined;
		this._slurpTimerLaunchTime = undefined;
		this.timer = undefined;
		this.socket = undefined;
		this.traceEvents = new TraceEvents(this);
	}

	public sendMessage(msg: MessageInterface): void {
		if (!this.socket) {
			console.error('sendMessage() called with non-existent socket!');
			return;
		}

		if (this._map._debug.eventDelayWatchdog) this._map._debug.timeEventDelay();

		if (this._map._fatal) {
			// Avoid communicating when we're in fatal state
			return;
		}

		if (!app.idleHandler._active) {
			// Avoid communicating when we're inactive.
			if (typeof msg !== 'string') return;

			if (!msg.startsWith('useractive') && !msg.startsWith('userinactive')) {
				window.app.console.log(
					'Ignore outgoing message due to inactivity: "' + msg + '"',
				);
				return;
			}
		}

		if (this._map.uiManager && this._map.uiManager.isUIBlocked()) return;

		const socketState = this.socket.readyState;
		if (socketState === 2 || socketState === 3) {
			this._map.loadDocument();
		}

		if (socketState === 1) {
			this._doSend(msg);
		} else {
			// push message while trying to connect socket again.
			this._msgQueue.push(msg);
		}
	}

	public sendTraceEvent(
		name: any,
		ph: string,
		timeRange: undefined | string,
		args?: any,
		id?: number | string,
		tid?: number | string,
	): void {
		this.traceEvents.send(name, ph, timeRange, args, id, tid);
	}

	get traceEventRecordingToggle(): boolean {
		return this.traceEvents.getRecordingToggle();
	}

	public setTraceEventLogging(enabled: boolean) {
		this.traceEvents.setLogging(enabled);
	}

	public createAsyncTraceEvent(
		name: string,
		args?: any,
	): CompleteTraceEvent | null {
		return this.traceEvents.createAsync(name, args);
	}

	public _stringifyArgs(args: any): string {
		return args == null ? '' : ' args=' + JSON.stringify(args);
	}

	public createCompleteTraceEvent(
		name: string,
		args?: any,
	): CompleteTraceEvent | null {
		return this.traceEvents.createComplete(name, args);
	}

	public createCompleteTraceEventFromEvent(
		textMsg?: string,
	): CompleteTraceEvent | null {
		return this.traceEvents.createCompleteFromEvent(textMsg);
	}

	public parseServerCmd(msg: string): ServerCommand {
		return new ServerCommand(msg, this._map);
	}

	protected getWebSocketBaseURI(map: MapInterface): string {
		if (window.enableExperimentalFeatures) {
			// Use the new Cool WS URL.
			return window.makeWopiCoolWsUrl(
				window.makeWsUrl('/cool/'),
				$.param(map.options.docParams),
			);
		} else {
			return window.makeWsUrlWopiSrc(
				'/cool/',
				map.options.doc + '?' + $.param(map.options.docParams),
			);
		}
	}

	public connect(socket: SockInterface): void {
		const map = this._map;
		map.options.docParams['permission'] = app.getPermission();
		if (this.socket) {
			this.close();
		}
		if (socket && (socket.readyState === 1 || socket.readyState === 0)) {
			this.socket = socket;
		} else if (window.ThisIsAMobileApp) {
			// We have already opened the FakeWebSocket or MobileSocket over in global.js
			// With the FakeWebSocket do we then set this.socket at all?
			// With the MobileSocket we definitely do - this is load-bearing for opening password protected documents
		} else {
			try {
				this.socket = window.createWebSocket(this.getWebSocketBaseURI(map));
				window.socket = this.socket;
			} catch (e) {
				this._map.fire('error', {
					msg:
						_('Oops, there is a problem connecting to {productname}: ').replace(
							'{productname}',
							typeof brandProductName !== 'undefined'
								? brandProductName
								: 'Collabora Online Development Edition (unbranded)',
						) + e,
					cmd: 'socket',
					kind: 'failed',
					id: 3,
				});
				return;
			}
		}

		if (!this.socket) {
			console.error('connect: this.socket is still undefined!');
			return;
		}

		this.socket.onerror = this._onSocketError.bind(this);
		this.socket.onclose = this._onSocketClose.bind(this);
		this.socket.onopen = this._onSocketOpen.bind(this);
		this.socket.onmessage = this._slurpMessage.bind(this);
		this.socket.binaryType = 'arraybuffer';
		if (
			map.options.docParams.access_token &&
			parseInt(map.options.docParams.access_token_ttl as string)
		) {
			const tokenExpiryWarning = 900 * 1000; // Warn when 15 minutes remain
			clearTimeout(this._accessTokenExpireTimeout);
			this._accessTokenExpireTimeout = setTimeout(
				this._sessionExpiredWarning.bind(this),
				parseInt(map.options.docParams.access_token_ttl as string) -
					Date.now() -
					tokenExpiryWarning,
			);
		}

		// process messages for early socket connection
		this._emptyQueue();
	}

	public close(code?: number, reason?: string): void {
		if (!this.socket) {
			console.error('Tried close() on non-existent socket!');
			return;
		}
		this.socket.onerror = function () {};
		this.socket.onclose = function () {};
		this.socket.onmessage = function () {};
		this.socket.close();

		// Reset wopi's app loaded so that reconnecting again informs outerframe about initialization
		this._map['wopi'].resetAppLoaded();
		this._map.fire('docloaded', { status: false });
		clearTimeout(this._accessTokenExpireTimeout);
	}

	protected _doSend(msg: MessageInterface): void {
		if (!this.socket) {
			console.error('_doSend() called when socket is non-existent!');
			return;
		}
		// Only attempt to log text frames, not binary ones.
		if (typeof msg === 'string') this._logSocket('OUTGOING', msg);

		this.socket.send(msg);
	}

	protected _onSocketOpen(evt: Event): void {
		window.app.console.debug('_onSocketOpen:');
		app.idleHandler._serverRecycling = false;
		app.idleHandler._documentIdle = false;

		// Always send the protocol version number.
		// TODO: Move the version number somewhere sensible.

		// Note there are two socket "onopen" handlers, this one which ends up as part of
		// bundle.js and the other in browser/js/global.js. The global.js one attempts to
		// set up the connection early while bundle.js is still loading. If bundle.js
		// starts before global.js has connected, then this _onSocketOpen will do the
		// connection instead, after taking over the socket in "connect"

		// Typically in a "make run" scenario it is the global.js case that sends the
		// 'coolclient' and 'load' messages while currently in the "WASM app" case it is
		// this code that gets invoked.

		// Also send information about our performance timer epoch
		const now0 = Date.now();
		const now1 = performance.now();
		const now2 = Date.now();
		this._doSend(
			'coolclient ' +
				this.ProtocolVersionNumber +
				' ' +
				(now0 + now2) / 2 +
				' ' +
				now1,
		);

		let msg = 'load url=' + encodeURIComponent(this._map.options.doc);
		if (this._map._docLayer) {
			this._reconnecting = true;
			// we are reconnecting after a lost connection
			msg += ' part=' + this._map.getCurrentPartNumber();
		}
		if (this._map.options.timestamp) {
			msg += ' timestamp=' + this._map.options.timestamp;
		}
		if (this._map._docPassword) {
			msg += ' password=' + this._map._docPassword;
		}
		if (String.locale) {
			msg += ' lang=' + String.locale;
		}
		if (window.deviceFormFactor) {
			msg += ' deviceFormFactor=' + window.deviceFormFactor;
		}

		msg += ' timezone=' + Intl.DateTimeFormat().resolvedOptions().timeZone;

		if (this._map.options.renderingOptions) {
			const options = {
				rendering: this._map.options.renderingOptions,
			};
			msg += ' options=' + JSON.stringify(options);
		}
		const spellOnline = window.prefs.get('spellOnline');
		if (spellOnline) {
			msg += ' spellOnline=' + spellOnline;
		}

		const darkTheme = window.prefs.getBoolean('darkTheme');
		msg += ' darkTheme=' + darkTheme;

		const darkBackground = window.prefs.getBoolean(
			'darkBackgroundForTheme.' + (darkTheme ? 'dark' : 'light'),
			darkTheme,
		);
		msg += ' darkBackground=' + darkBackground;
		this._map.uiManager.initDarkBackgroundUI(darkBackground);

		msg += ' accessibilityState=' + window.getAccessibilityState();

		msg += ' clientvisiblearea=' + window.makeClientVisibleArea();

		this._doSend(msg);
		for (let i = 0; i < this._msgQueue.length; i++) {
			this._doSend(this._msgQueue[i]);
		}
		this._msgQueue = [];

		app.idleHandler._activate();
	}

	protected _onSocketClose(evt: CloseEvent): void {
		console.assert(false, 'This should not be called!');
	}

	protected _onSocketError(evt: Event): void {
		console.assert(false, 'This should not be called!');
	}

	protected _slurpMessage(evt: MessageEvent): void {
		console.assert(false, 'This should not be called!');
	}

	protected _emptyQueue(): void {
		if (window.queueMsg && window.queueMsg.length > 0) {
			for (let it = 0; it < window.queueMsg.length; it++) {
				const msg: MessageInterface = window.queueMsg[it];
				const evt: any = { data: msg, textMsg: msg };
				this._slurpMessage(evt);
			}
			window.queueMsg = [];
		}
	}

	protected _sessionExpiredWarning(): void {
		clearTimeout(this._accessTokenExpireTimeout);
		let expirymsg = window.errorMessages.sessionexpiry;
		if (
			parseInt(this._map.options.docParams.access_token_ttl as string) -
				Date.now() <=
			0
		) {
			expirymsg = window.errorMessages.sessionexpired;
		}
		const dateTime = new Date(
			parseInt(this._map.options.docParams.access_token_ttl as string),
		);
		const dateOptions: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		};
		const timerepr = dateTime.toLocaleDateString(String.locale, dateOptions);
		this._map.fire('warn', { msg: expirymsg.replace('{time}', timerepr) });

		// If user still doesn't refresh the session, warn again periodically
		this._accessTokenExpireTimeout = setTimeout(
			this._sessionExpiredWarning.bind(this),
			120 * 1000,
		);
	}

	public setUnloading(): void {
		if (this.socket && this.socket.setUnloading) this.socket.setUnloading();
	}

	public connected(): boolean {
		return this.socket !== undefined && this.socket.readyState === 1;
	}

	protected _logSocket(type: string, msg: string): void {
		const logMessage =
			this._map._debug.debugNeverStarted ||
			this._map._debug.logIncomingMessages;
		if (!logMessage) return;

		if (window.ThisIsTheGtkApp) window.postMobileDebug(type + ' ' + msg);

		const debugOn = this._map._debug.debugOn;

		if (this._map._debug.overlayOn) {
			this._map._debug.setOverlayMessage('postMessage', type + ': ' + msg);
		}

		if (!debugOn && msg.length > 256)
			// for reasonable performance.
			msg =
				msg.substring(0, 256) + '<truncated ' + (msg.length - 256) + 'chars>';

		let status = '';
		if (!window.fullyLoadedAndReady) status += '[!fullyLoadedAndReady]';
		if (!window.bundlejsLoaded) status += '[!bundlejsLoaded]';

		app.Log.log(msg, type + status);

		if (!window.protocolDebug && !debugOn) return;

		const color = type === 'OUTGOING' ? 'color:red' : 'color:#2e67cf';
		window.app.console.log(
			+new Date() +
				' %c' +
				type +
				status +
				'%c: ' +
				msg.concat(' ').replace(' ', '%c '),
			'background:#ddf;color:black',
			color,
			'color:',
		);
	}
}
