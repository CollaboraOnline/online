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
		return window.makeWsUrlWopiSrc(
			'/cool/',
			map.options.doc + '?' + $.param(map.options.docParams),
		);
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

	// The problem: if we process one websocket message at a time, the
	// browser -loves- to trigger a re-render as we hit the main-loop,
	// this takes ~200ms on a large screen, and worse we get
	// producer/consumer issues that can fill a multi-second long
	// buffer of web-socket messages in the client that we can't
	// process so - slurp and then emit at idle - its faster to delay!
	protected _slurpMessage(evt: MessageEvent): void {
		const e = evt as SlurpMessageEvent;
		this._extractTextImg(e);

		// Some messages - we want to process & filter early.
		const docLayer = this._map ? this._map._docLayer : undefined;
		if (docLayer && docLayer.filterSlurpedMessage(e)) return;

		const predictedTiles = TileManager.predictTilesToSlurp();
		// scale delay, to a max of 50ms, according to the number of
		// tiles predicted to arrive.
		const delayMS = Math.max(Math.min(predictedTiles, 50), 1);

		if (!this._slurpQueue) this._slurpQueue = [];
		this._slurpQueue.push(e);
		this._queueSlurpEventEmission(delayMS);
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

	protected _getParameterByName(url: string, name: string): string {
		// Escape all regex characters.
		const escape = (str: string): string => {
			return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		};
		const regex = new RegExp('[\\?&]' + escape(name) + '=([^&#]*)');
		const results = regex.exec(url);
		return results === null ? '' : results[1].replace(/\+/g, ' ');
	}

	protected _utf8ToString(data: Uint8Array): string {
		let strBytes = '';
		for (let it = 0; it < data.length; it++) {
			strBytes += String.fromCharCode(data[it]);
		}
		return strBytes;
	}

	// Returns true if, and only if, we are ready to start loading
	// the tiles and rendering the document.
	protected _isReady(): boolean {
		if (window.bundlejsLoaded == false || window.fullyLoadedAndReady == false) {
			return false;
		}

		if (
			typeof this._map == 'undefined' ||
			isNaN(this._map.options.tileWidthTwips) ||
			isNaN(this._map.options.tileHeightTwips)
		) {
			return false;
		}

		const center = this._map.getCenter();
		if (isNaN(center.lat) || isNaN(center.lng) || isNaN(this._map.getZoom())) {
			return false;
		}

		return true;
	}

	protected _queueSlurpEventEmission(delayMS: number): void {
		let now = Date.now();
		if (this._slurpTimer && this._slurpTimerDelay != delayMS) {
			// The timer already exists, but now want to change timeout _slurpTimerDelay to delayMS.
			// Cancel it and reschedule by replacement with another timer using the desired delayMS
			// adjusted as if used at the original launch time.
			clearTimeout(this._slurpTimer);
			this._slurpTimer = undefined;
			this._slurpTimerDelay = delayMS;

			now = Date.now();
			if (this._slurpTimerLaunchTime === undefined) {
				console.assert(
					false,
					'_slurpTimerLaunchTime is undefined when _slurpTimer exists!',
				);
				return;
			}
			const sinceLaunchMS = now - this._slurpTimerLaunchTime;
			delayMS -= sinceLaunchMS;
			if (delayMS <= 0) delayMS = 1;
		}

		if (!this._slurpTimer) {
			if (!this._slurpTimerLaunchTime) {
				// The initial launch of the timer, rescheduling replacements retain
				// the launch time
				this._slurpTimerLaunchTime = now;
				this._slurpTimerDelay = delayMS;
			}
			this._slurpTimer = setTimeout(
				function (this: SocketBase) {
					this._slurpTimer = undefined;
					this._slurpTimerLaunchTime = undefined;
					this._slurpTimerDelay = undefined;
					if (this._inLayerTransaction) {
						this._slurpDuringTransaction = true;
						return;
					}
					this._emitSlurpedEvents();
				}.bind(this),
				delayMS,
			);
		}
	}

	protected _emitSlurpedEvents(): void {
		if (this._map._debug.eventDelayWatchdog) this._map._debug.timeEventDelay();

		const queueLength = this._slurpQueue.length;
		const completeEventWholeFunction = this.createCompleteTraceEvent(
			'emitSlurped-' + String(queueLength),
			{ '_slurpQueue.length': String(queueLength) },
		);
		if (this._map && this._map._docLayer) {
			TileManager.beginTransaction();
			this._inLayerTransaction = true;

			// Queue an instant timeout early to try to measure the
			// re-rendering delay before we get back to the main-loop.
			if (this.traceEventRecordingToggle) {
				if (!this._renderEventTimer)
					this._renderEventTimer = setTimeout(function (this: SocketBase) {
						if (this._renderEventTimerStart === undefined) {
							console.assert(
								false,
								'_renderEventTimerStart is undefined when renderEvent is run!',
							);
							return;
						}
						const now = performance.now();
						const delta = now - this._renderEventTimerStart;
						if (delta >= 2 /* ms */) {
							// significant
							this.sendTraceEvent(
								name,
								'X',
								'ts=' +
									Math.round(this._renderEventTimerStart * 1000) +
									' dur=' +
									Math.round((now - this._renderEventTimerStart) * 1000),
							);
							this._renderEventTimerStart = undefined;
						}
						this._renderEventTimer = undefined;
					}, 0);
			}
		}
		// window.app.console.log('Slurp events ' + that._slurpQueue.length);
		let complete = true;
		try {
			for (let i = 0; i < queueLength; ++i) {
				const evt = this._slurpQueue[i];

				if (evt.isComplete()) {
					let textMsg;
					if (typeof evt.data === 'string') {
						textMsg = evt.data.replace(/\s+/g, '.');
					} else if (typeof evt.data === 'object') {
						textMsg = evt.textMsg.replace(/\s+/g, '.');
					}

					const completeEventOneMessage =
						this.createCompleteTraceEventFromEvent(textMsg);
					try {
						// it is - are you ?
						this._onMessage(evt);
					} catch (e: any) {
						// unpleasant - but stops this one problem event
						// stopping an unknown number of others.
						const msg =
							'Exception ' + e + ' emitting event ' + evt.data + '\n' + e.stack;
						window.app.console.error(msg);

						// When debugging let QA know something is up.
						if (window.enableDebug || window.L.Browser.cypressTest)
							this._map.uiManager.showInfoModal(
								'cool_alert',
								'',
								msg,
								'',
								_('Close'),
								function () {
									/* Do nothing. */
								},
								false,
							);

						// If we're cypress testing, fail the run. Cypress will fail anyway, but this way we may get
						// a nice error in the logs rather than guessing that the run failed from our popup blocking input...
						if (
							window.L.Browser.cypressTest &&
							window.parent !== window &&
							e !== null
						) {
							console.log('Sending event error to Cypress...', e);
							window.parent.postMessage(e);
						}
					} finally {
						if (completeEventOneMessage) completeEventOneMessage.finish();
					}
				} else {
					// Stop emitting, re-start when we async images load.
					this._slurpQueue = this._slurpQueue.slice(i, queueLength);
					complete = false;
					break;
				}
			}
		} finally {
			if (completeEventWholeFunction) completeEventWholeFunction.finish();
		}

		if (complete)
			// Finished all elements in the queue.
			this._slurpQueue = [];

		if (this._map) {
			const completeCallback = () => {
				// Let other layers / overlays catch up.
				this._map.fire('messagesdone');

				this._renderEventTimerStart = performance.now();

				this._inLayerTransaction = false;
				if (this._slurpDuringTransaction) {
					this._slurpDuringTransaction = false;
					this._queueSlurpEventEmission(1);
				}
			};

			if (this._inLayerTransaction && this._map._docLayer) {
				// Resume with redraw if dirty due to previous _onMessage() calls.
				TileManager.endTransaction(completeCallback);
			} else {
				completeCallback();
			}
		}
	}

	protected _onMessage(e: SlurpMessageEvent): void {
		console.assert(false, 'This should not be called!');
	}

	protected _extractTextImg(e: SlurpMessageEvent): void {
		console.assert(false, 'This should not be called!');
	}

	// make profiling easier
	protected _extractCopyObject(e: SlurpMessageEvent): void {
		let index: number;

		e.imgBytes = new Uint8Array(e.data as ArrayBufferLike);

		// search for the first newline which marks the end of the message
		index = e.imgBytes.indexOf(10);
		if (index < 0) index = e.imgBytes.length;

		e.textMsg = String.fromCharCode.apply(
			null,
			e.imgBytes.subarray(0, index) as unknown as number[],
		);

		e.imgIndex = index + 1;
	}

	// convert to string of bytes without blowing the stack if data is large.
	protected _strFromUint8(prefix: string, data: Uint8Array): string {
		let i: number;
		const chunk = 4096;
		let strBytes = prefix;
		for (i = 0; i < data.length; i += chunk)
			strBytes += String.fromCharCode.apply(
				null,
				data.slice(i, i + chunk) as unknown as number[],
			);
		strBytes += String.fromCharCode.apply(
			null,
			data.slice(i) as unknown as number[],
		);
		return strBytes;
	}

	protected _extractImage(e: SlurpMessageEvent): string {
		if (!e.imgBytes) {
			console.assert(
				false,
				'Called _extractImage with and event that does not have imgBytes member!',
			);
			return '';
		}

		if (e.imgIndex === undefined) {
			console.assert(false, '_extractImage: event does not have imgIndex!');
			return '';
		}

		const data = e.imgBytes.subarray(e.imgIndex);
		let prefix = '';
		// FIXME: so we prepend the PNG pre-byte here having removed it in TileCache::appendBlob
		if (data[0] != 0x89) prefix = String.fromCharCode(0x89);
		const img =
			'data:image/png;base64,' + window.btoa(this._strFromUint8(prefix, data));
		if (
			window.L.Browser.cypressTest &&
			window.prefs.getBoolean('image_validation_test')
		) {
			if (!window.imgDatas) window.imgDatas = [];
			window.imgDatas.push(img);
		}
		return img;
	}
}
