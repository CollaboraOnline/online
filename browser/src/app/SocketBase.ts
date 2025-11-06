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

	// we need typing of this function in TraceEvents.ts
	public sendMessage(msg: MessageInterface): void {
		console.assert(false, 'This should not be called!');
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
		console.assert(false, 'This should not be called!');
	}

	protected _onSocketOpen(evt: Event): void {
		console.assert(false, 'This should not be called!');
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
		console.assert(false, 'This should not be called!');
	}

	protected _sessionExpiredWarning(): void {
		console.assert(false, 'This should not be called!');
	}
}
